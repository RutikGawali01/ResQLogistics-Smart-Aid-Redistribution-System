import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { runSeed } from '../seed.js';
import { ASSIGNMENT_STATUS, ERROR_CODES, ROLES } from '@aidflow/shared';

describe('AidFlow Core Models & REST API Integration Tests', () => {
  let app;
  let adminToken;
  let donorToken;
  let otherDonorToken;
  let riderToken;
  let shelterManagerToken;

  let seededData;

  beforeAll(async () => {
    app = createApp();
    await connectDatabase();
    seededData = await runSeed({ quiet: true });

    // Helper to log in and get JWT token
    const loginUser = async (email, password = 'Password123!') => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password });
      return res.body.data?.token;
    };

    adminToken = await loginUser('admin@aidflow.org', 'AidFlowAdmin!2026');
    donorToken = await loginUser('sarah@freshmarket.com');
    otherDonorToken = await loginUser('marco@goldengrain.com');
    riderToken = await loginUser('carlos.rider@aidflow.org');
    shelterManagerToken = await loginUser('elena@downtownhope.org');
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('1. Health & Response Contract', () => {
    it('returns healthy status adhering to shared response envelope', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.database).toBe('connected');
      expect(res.body.timestamp).toBeDefined();
    });

    it('returns 404 with standardized error envelope for non-existent routes', async () => {
      const res = await request(app).get('/api/non-existent-route');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('2. Donations Endpoints & Ownership', () => {
    let createdDonationId;

    it('creates a new donation with availableQuantity initialized to quantity', async () => {
      const payload = {
        title: 'Fresh Organic Apples & Oranges',
        aidType: 'PRODUCE',
        quantity: 50,
        unit: 'kg',
        handlingRequirements: 'ROOM_TEMPERATURE',
        safeUseDeadline: new Date(Date.now() + 86400000 * 3).toISOString(),
        pickupLocation: {
          address: '500 Market St, San Francisco, CA',
          latitude: 37.79,
          longitude: -122.40,
          contactName: 'Fresh Produce Dock'
        }
      };

      const res = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.quantity).toBe(50);
      expect(res.body.data.availableQuantity).toBe(50);
      expect(res.body.data.status).toBe('AVAILABLE');
      createdDonationId = res.body.data.id;
    });

    it('rejects donation creation with invalid negative quantity (422)', async () => {
      const res = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          title: 'Negative Food Package',
          aidType: 'PRODUCE',
          quantity: -10,
          unit: 'kg',
          safeUseDeadline: new Date().toISOString(),
          pickupLocation: {
            address: '100 Main St',
            latitude: 37.79,
            longitude: -122.40
          }
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('rejects client attempt to directly set protected availableQuantity on create', async () => {
      const res = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          title: 'Attempting to inject protected availableQuantity',
          aidType: 'PRODUCE',
          quantity: 50,
          availableQuantity: 9999, // Protected field!
          unit: 'kg',
          safeUseDeadline: new Date().toISOString(),
          pickupLocation: {
            address: '100 Main St',
            latitude: 37.79,
            longitude: -122.40
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.PROTECTED_FIELD_MODIFICATION);
    });

    it('lists donations with filtering by aidType and status', async () => {
      const res = await request(app)
        .get('/api/donations?aidType=PRODUCE&status=AVAILABLE')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((d) => d.status === 'AVAILABLE')).toBe(true);
    });

    it('retrieves single donation by ID', async () => {
      const res = await request(app)
        .get(`/api/donations/${createdDonationId}`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdDonationId);
    });

    it('rejects unauthorized donation update by non-owner (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/donations/${createdDonationId}`)
        .set('Authorization', `Bearer ${otherDonorToken}`) // Not owner!
        .send({
          title: 'Hacked Title by Another Donor'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('rejects client attempt to directly set protected fields during update (400)', async () => {
      const res = await request(app)
        .patch(`/api/donations/${createdDonationId}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          availableQuantity: 0 // Client cannot directly set availableQuantity
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.PROTECTED_FIELD_MODIFICATION);
    });

    it('allows valid donation update by owner and maintains availableQuantity integrity', async () => {
      const res = await request(app)
        .patch(`/api/donations/${createdDonationId}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          title: 'Updated Organic Apples Crate',
          quantity: 60
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated Organic Apples Crate');
      expect(res.body.data.quantity).toBe(60);
      expect(res.body.data.availableQuantity).toBe(60);
    });
  });

  describe('3. Shelter Demand & Status Endpoints', () => {
    let shelterId;

    beforeAll(() => {
      shelterId = seededData.shelter1._id.toString();
    });

    it('retrieves shelters list with demand metadata', async () => {
      const res = await request(app)
        .get('/api/shelters?isOpen=true')
        .set('Authorization', `Bearer ${shelterManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].currentDemand).toBeDefined();
      expect(res.body.data[0].receivingCapacity).toBeDefined();
    });

    it('updates shelter currentDemand and receivingCapacity (PATCH /api/shelters/:id/demand)', async () => {
      const res = await request(app)
        .patch(`/api/shelters/${shelterId}/demand`)
        .set('Authorization', `Bearer ${shelterManagerToken}`)
        .send({
          currentDemand: 180,
          receivingCapacity: 220
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentDemand).toBe(180);
      expect(res.body.data.receivingCapacity).toBe(220);
    });

    it('rejects negative demand values with validation error (422)', async () => {
      const res = await request(app)
        .patch(`/api/shelters/${shelterId}/demand`)
        .set('Authorization', `Bearer ${shelterManagerToken}`)
        .send({
          currentDemand: -20
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('updates shelter isOpen and urgencyLevel (PATCH /api/shelters/:id/status)', async () => {
      const res = await request(app)
        .patch(`/api/shelters/${shelterId}/status`)
        .set('Authorization', `Bearer ${shelterManagerToken}`)
        .send({
          isOpen: true,
          urgencyLevel: 'CRITICAL'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isOpen).toBe(true);
      expect(res.body.data.urgencyLevel).toBe('CRITICAL');
    });

    it('rejects unauthorized manager modifying another shelter (403)', async () => {
      const res = await request(app)
        .patch(`/api/shelters/${shelterId}/status`)
        .set('Authorization', `Bearer ${donorToken}`) // Donor role not authorized
        .send({
          isOpen: false
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });

  describe('4. Rider Capacity & Availability Endpoints', () => {
    let riderId;

    beforeAll(() => {
      riderId = seededData.rider1._id.toString();
    });

    it('retrieves riders list with capacity metadata', async () => {
      const res = await request(app)
        .get('/api/riders')
        .set('Authorization', `Bearer ${riderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].capacity).toBeDefined();
      expect(res.body.data[0].availableCapacity).toBeDefined();
      expect(res.body.data[0].isAvailable).toBeDefined();
    });

    it('updates rider availability (PATCH /api/riders/:id/availability)', async () => {
      const res = await request(app)
        .patch(`/api/riders/${riderId}/availability`)
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
          isAvailable: true,
          status: 'AVAILABLE'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isAvailable).toBe(true);
      expect(res.body.data.status).toBe('AVAILABLE');
    });

    it('rejects client attempt to directly set protected availableCapacity on rider', async () => {
      const res = await request(app)
        .patch(`/api/riders/${riderId}/capacity`)
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
          availableCapacity: 500 // Protected field!
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.PROTECTED_FIELD_MODIFICATION);
    });

    it('updates rider capacity and adjusts availableCapacity preserving active cargo', async () => {
      const res = await request(app)
        .patch(`/api/riders/${riderId}/capacity`)
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
          capacity: 55
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.capacity).toBe(55);
      // rider1 is carrying 40 kg from active dispatch, so available is 55 - 40 = 15 kg
      expect(res.body.data.availableCapacity).toBe(15);
    });

    it('rejects reducing capacity below active cargo payload (422)', async () => {
      const res = await request(app)
        .patch(`/api/riders/${riderId}/capacity`)
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
          capacity: 35 // less than the 40 kg currently assigned
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('updates live location coordinates (POST /api/riders/:id/location)', async () => {
      const res = await request(app)
        .post(`/api/riders/${riderId}/location`)
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
          latitude: 37.789,
          longitude: -122.408,
          address: 'Powell St Station',
          speedKmh: 20
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.location.latitude).toBe(37.789);
    });
  });

  describe('5. Assignment Retrieval & Allocation Validation', () => {
    it('creates an assignment and decrements donation availableQuantity', async () => {
      const donationId = seededData.donation1._id.toString();
      const shelterId = seededData.shelter1._id.toString();
      const initialAvailable = seededData.donation1.availableQuantity;

      const res = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          donationId,
          shelterId,
          allocatedQuantity: 20,
          status: ASSIGNMENT_STATUS.PENDING_ACCEPTANCE
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.allocatedQuantity).toBe(20);

      // Verify donation availableQuantity is decremented
      const donRes = await request(app)
        .get(`/api/donations/${donationId}`)
        .set('Authorization', `Bearer ${donorToken}`);
      expect(donRes.body.data.availableQuantity).toBe(initialAvailable - 20);
    });

    it('rejects assignment creation if allocatedQuantity exceeds available quantity (409)', async () => {
      const donationId = seededData.donation1._id.toString();
      const shelterId = seededData.shelter1._id.toString();

      const res = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          donationId,
          shelterId,
          allocatedQuantity: 99999 // Exceeds available!
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.CONFLICT);
    });

    it('rejects unauthenticated transition requests with 401', async () => {
      const assignmentId = seededData.assignment1._id.toString();
      const res = await request(app)
        .patch(`/api/assignments/${assignmentId}/state`)
        .send({
          targetStatus: ASSIGNMENT_STATUS.ACCEPTED
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('rejects invalid state transition according to state machine rules', async () => {
      const assignmentId = seededData.assignment1._id.toString();

      // Current state is PICKUP_IN_PROGRESS. Jumping directly to DELIVERED without PICKED_UP is invalid.
      const res = await request(app)
        .patch(`/api/assignments/${assignmentId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetStatus: ASSIGNMENT_STATUS.DELIVERED
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
    });

    it('executes valid sequential state transition from PICKUP_IN_PROGRESS to PICKED_UP', async () => {
      const assignmentId = seededData.assignment1._id.toString();

      const res = await request(app)
        .patch(`/api/assignments/${assignmentId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetStatus: ASSIGNMENT_STATUS.PICKED_UP
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ASSIGNMENT_STATUS.PICKED_UP);
    });
  });

  describe('6. Event History Retrieval', () => {
    it('retrieves event history for an assignment (GET /api/assignments/:id/events)', async () => {
      const assignmentId = seededData.assignment1._id.toString();
      const res = await request(app)
        .get(`/api/assignments/${assignmentId}/events`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].entityType).toBe('ASSIGNMENT');
    });

    it('retrieves system-wide event audit log (GET /api/events)', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].eventType).toBeDefined();
    });
  });
});
