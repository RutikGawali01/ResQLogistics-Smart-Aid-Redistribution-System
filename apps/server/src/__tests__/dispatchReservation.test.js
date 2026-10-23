import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { Donation } from '../models/Donation.js';
import { Shelter } from '../models/Shelter.js';
import { Rider } from '../models/Rider.js';
import { Assignment } from '../models/Assignment.js';
import { generateToken } from '../middleware/auth.js';
import {
  commitDispatchReservation,
  ConcurrencyConflictError
} from '../dispatch/reservationService.js';
import { calculateDispatchAllocations } from '@aidflow/shared';

describe('AidFlow Dispatch Engine & Concurrency-Safe Reservation Suite', () => {
  let app;
  let adminToken;
  let testUser;

  beforeAll(async () => {
    app = createApp();
    await connectDatabase();

    testUser = await User.findOne({ email: 'admin@aidflow.org' });
    if (!testUser) {
      testUser = await User.create({
        email: `dispatch_admin_${Date.now()}@aidflow.org`,
        name: 'Dispatch Admin',
        role: 'ADMIN',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890'
      });
    }
    adminToken = generateToken(testUser);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('1. Separation of Pure Calculation from Database Mutations', () => {
    it('calculating a plan DOES NOT mutate donation or rider state in the database', async () => {
      // Create a test donation
      const testDonation = await Donation.create({
        donorId: testUser._id,
        title: 'Fresh Bread & Rolls',
        aidType: 'BAKERY',
        quantity: 100,
        availableQuantity: 100,
        unit: 'LOAVES',
        safeUseDeadline: new Date(Date.now() + 5 * 3600000),
        pickupLocation: {
          address: 'Bakery Wharf',
          latitude: 37.7749,
          longitude: -122.4194
        }
      });

      // Fetch or provide shelters and riders
      const mockShelter = {
        id: 'mock_shl_1',
        name: 'Mock Shelter',
        isOpen: true,
        currentDemand: 80,
        receivingCapacity: 80,
        availableResources: ['ROOM_TEMPERATURE'],
        location: { latitude: 37.7800, longitude: -122.4000 }
      };

      const mockRider = {
        id: 'mock_rdr_1',
        name: 'Mock Rider',
        isAvailable: true,
        capacity: 50,
        availableCapacity: 50,
        currentLocation: { latitude: 37.7749, longitude: -122.4194 }
      };

      // Run pure calculation
      const planResult = calculateDispatchAllocations({
        donations: [testDonation.toJSON()],
        shelters: [mockShelter],
        riders: [mockRider]
      });

      expect(planResult.success).toBe(true);
      expect(planResult.metrics.allocatedTotal).toBe(50);

      // Verify that the database document has NOT changed at all
      const unmodifiedDonation = await Donation.findById(testDonation._id);
      expect(unmodifiedDonation.availableQuantity).toBe(100);
      expect(unmodifiedDonation.status).toBe('AVAILABLE');
    });

    it('REST endpoint POST /api/dispatch/calculate returns pure plan without committing DB reservations', async () => {
      const res = await request(app)
        .post('/api/dispatch/calculate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          donations: [
            {
              id: 'calc_don_1',
              title: 'Canned Goods',
              aidType: 'NON_PERISHABLE',
              availableQuantity: 50,
              unit: 'CANS',
              safeUseDeadline: new Date(Date.now() + 24 * 3600000).toISOString(),
              pickupLocation: { latitude: 37.7749, longitude: -122.4194 }
            }
          ],
          shelters: [
            {
              id: 'calc_shl_1',
              name: 'Community Center',
              isOpen: true,
              currentDemand: 50,
              receivingCapacity: 50,
              availableResources: ['DRY_STORAGE', 'ROOM_TEMPERATURE'],
              location: { latitude: 37.7800, longitude: -122.4000 }
            }
          ],
          riders: [
            {
              id: 'calc_rdr_1',
              name: 'Bike Courier',
              isAvailable: true,
              capacity: 30,
              availableCapacity: 30,
              currentLocation: { latitude: 37.7749, longitude: -122.4194 }
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics).toBeDefined();
      expect(res.body.data.metrics.allocatedTotal).toBe(30);
      expect(res.body.data.metrics.unallocatedTotal).toBe(20);
      expect(res.body.data.metrics.reconciled).toBe(true);
    });
  });

  describe('2. Concurrency-Safe Database Reservation Commit', () => {
    it('commits allocations into persistent reservations and decrements available quantities', async () => {
      const donation = await Donation.create({
        donorId: testUser._id,
        title: 'Nutritious Hot Meals',
        aidType: 'PREPARED_MEALS',
        quantity: 60,
        availableQuantity: 60,
        unit: 'MEALS',
        safeUseDeadline: new Date(Date.now() + 4 * 3600000),
        pickupLocation: {
          address: 'Community Center',
          latitude: 37.7749,
          longitude: -122.4194
        }
      });

      const shelter = await Shelter.create({
        managerId: testUser._id,
        name: 'South of Market Relief Hub',
        currentDemand: 80,
        receivingCapacity: 100,
        availableResources: ['ROOM_TEMPERATURE', 'REFRIGERATION'],
        location: {
          address: '4th St',
          latitude: 37.7800,
          longitude: -122.4000
        }
      });

      const rider = await Rider.create({
        userId: new mongoose.Types.ObjectId(),
        name: 'Test Courier',
        capacity: 50,
        availableCapacity: 50,
        isAvailable: true,
        currentLocation: {
          latitude: 37.7749,
          longitude: -122.4194
        }
      });

      // Build an allocation leg
      const leg = {
        id: 'leg_test_1',
        donationId: donation._id.toString(),
        shelter: { id: shelter._id.toString() },
        rider: { id: rider._id.toString() },
        allocatedQuantity: 30,
        timing: {
          safetyDeadline: donation.safeUseDeadline.toISOString()
        }
      };

      // Commit reservation
      const commitRes = await commitDispatchReservation([leg]);
      expect(commitRes.success).toBe(true);
      expect(commitRes.committedCount).toBe(1);

      // Verify DB mutations
      const updatedDonation = await Donation.findById(donation._id);
      expect(updatedDonation.availableQuantity).toBe(30); // 60 - 30

      const updatedShelter = await Shelter.findById(shelter._id);
      expect(updatedShelter.currentDemand).toBe(50); // 80 - 30

      const updatedRider = await Rider.findById(rider._id);
      expect(updatedRider.availableCapacity).toBe(20); // 50 - 30

      // Verify Assignment was created
      const createdAssignment = await Assignment.findById(commitRes.assignments[0]._id);
      expect(createdAssignment).toBeDefined();
      expect(createdAssignment.allocatedQuantity).toBe(30);
      expect(createdAssignment.status).toBe('PENDING_ACCEPTANCE');
    });

    it('rejects concurrent over-allocation with ConcurrencyConflictError when quantity is insufficient', async () => {
      const limitedDonation = await Donation.create({
        donorId: testUser._id,
        title: 'Scarce Medicine Kits',
        aidType: 'MEDICAL',
        quantity: 10,
        availableQuantity: 10,
        unit: 'KITS',
        safeUseDeadline: new Date(Date.now() + 24 * 3600000),
        pickupLocation: {
          address: 'Clinic',
          latitude: 37.7749,
          longitude: -122.4194
        }
      });

      const shelter = await Shelter.findOne({ isOpen: true });

      // Leg asking for 25 units when only 10 available
      const overAllocatedLeg = {
        donationId: limitedDonation._id.toString(),
        shelter: { id: shelter._id.toString() },
        allocatedQuantity: 25
      };

      await expect(
        commitDispatchReservation([overAllocatedLeg])
      ).rejects.toThrow(ConcurrencyConflictError);

      // Verify the donation quantity was NOT decremented
      const unchangedDonation = await Donation.findById(limitedDonation._id);
      expect(unchangedDonation.availableQuantity).toBe(10);
    });

    it('POST /api/dispatch/commit-plan returns 409 CONFLICT on concurrent quantity exhaustion', async () => {
      const scarceDonation = await Donation.create({
        donorId: testUser._id,
        title: 'Emergency Rations',
        aidType: 'NON_PERISHABLE',
        quantity: 5,
        availableQuantity: 5,
        unit: 'BOXES',
        safeUseDeadline: new Date(Date.now() + 48 * 3600000),
        pickupLocation: {
          address: 'Red Cross Depot',
          latitude: 37.7749,
          longitude: -122.4194
        }
      });

      const shelter = await Shelter.findOne({ isOpen: true });

      const res = await request(app)
        .post('/api/dispatch/commit-plan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          plan: [
            {
              donationId: scarceDonation._id.toString(),
              shelter: { id: shelter._id.toString() },
              allocatedQuantity: 20 // exceeds 5 available
            }
          ]
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });
});
