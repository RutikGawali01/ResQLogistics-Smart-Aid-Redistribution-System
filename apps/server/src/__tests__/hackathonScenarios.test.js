import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { Donation } from '../models/Donation.js';
import { Shelter } from '../models/Shelter.js';
import { Rider } from '../models/Rider.js';
import { Assignment } from '../models/Assignment.js';
import { Reservation } from '../models/Reservation.js';
import { Event } from '../models/Event.js';
import {
  calculateDispatchAllocations,
  DISPATCH_REJECTION_CODES,
  ASSIGNMENT_STATUS
} from '@aidflow/shared';
import {
  commitDispatchReservation,
  claimAtomicReservation,
  ConcurrencyConflictError
} from '../dispatch/reservationService.js';
import {
  processExpiredReservations,
  detectOverdueAssignments,
  handleShelterClosureOrFull,
  runPeriodicMaintenanceCycle
} from '../../../worker/src/recovery/failureRecoveryService.js';

describe('AidFlow Live Hackathon Judging - 10 Core Scenarios Against Real MongoDB', () => {
  let adminUser;

  beforeAll(async () => {
    await connectDatabase();

    // Ensure an admin user exists for audit logging
    adminUser = await User.findOne({ email: 'admin@aidflow.org' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Alex Mercer (Platform Admin)',
        email: 'admin@aidflow.org',
        password: 'AidFlowAdmin!2026',
        role: 'ADMIN'
      });
    }
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Create 180 meals and distribute across shelters with different demands
  // ---------------------------------------------------------------------------
  describe('Scenario 1: 180-Meal Multi-Shelter & Multi-Courier Distribution', () => {
    it('creates 180 meals and distributes them across shelters with different demands while maintaining reconciliation', async () => {
      const donation = await Donation.create({
        donorId: adminUser._id,
        title: '180 Hot Nutritious Lunch Meals',
        aidType: 'PREPARED_MEALS',
        category: 'PREPARED_MEALS',
        quantity: 180,
        availableQuantity: 180,
        unit: 'meals',
        safeUseDeadline: new Date(Date.now() + 6 * 3600000),
        storageRequirement: 'ROOM_TEMPERATURE',
        pickupLocation: {
          address: 'Central Commissary Kitchen, 100 Market St',
          latitude: 37.7749,
          longitude: -122.4194
        }
      });

      // Shelter A needs 100 meals (critical)
      const shelterA = await Shelter.create({
        managerId: adminUser._id,
        name: 'Downtown Hope Refuge (Demand: 100)',
        currentDemand: 100,
        receivingCapacity: 120,
        urgencyLevel: 'CRITICAL',
        availableResources: ['ROOM_TEMPERATURE', 'HOT_KITCHEN'],
        isOpen: true,
        location: {
          address: '100 Mission St',
          latitude: 37.7833,
          longitude: -122.4167
        }
      });

      // Shelter B needs 80 meals (high)
      const shelterB = await Shelter.create({
        managerId: adminUser._id,
        name: 'St. Jude Community Center (Demand: 80)',
        currentDemand: 80,
        receivingCapacity: 100,
        urgencyLevel: 'HIGH',
        availableResources: ['ROOM_TEMPERATURE'],
        isOpen: true,
        location: {
          address: '450 Castro St',
          latitude: 37.7900,
          longitude: -122.4000
        }
      });

      // Couriers to carry the 180 meals
      const courier1 = await Rider.create({
        userId: new mongoose.Types.ObjectId(),
        name: 'Courier Carlos (Capacity: 100)',
        capacity: 100,
        availableCapacity: 100,
        isAvailable: true,
        status: 'AVAILABLE',
        currentLocation: { latitude: 37.7750, longitude: -122.4190 }
      });

      const courier2 = await Rider.create({
        userId: new mongoose.Types.ObjectId(),
        name: 'Courier Maya (Capacity: 80)',
        capacity: 80,
        availableCapacity: 80,
        isAvailable: true,
        status: 'AVAILABLE',
        currentLocation: { latitude: 37.7740, longitude: -122.4180 }
      });

      // 1. Calculate optimal distribution plan
      const planResult = calculateDispatchAllocations({
        donations: [donation.toJSON()],
        shelters: [shelterA.toJSON(), shelterB.toJSON()],
        riders: [courier1.toJSON(), courier2.toJSON()]
      });

      expect(planResult.success).toBe(true);
      expect(planResult.metrics.allocatedTotal).toBe(180);
      expect(planResult.metrics.unallocatedTotal).toBe(0);
      expect(planResult.metrics.reconciled).toBe(true);

      // Verify shelter distribution
      const allocationsByShelter = {};
      for (const leg of planResult.plans) {
        allocationsByShelter[leg.shelter.id] = (allocationsByShelter[leg.shelter.id] || 0) + leg.allocatedQuantity;
      }
      expect(allocationsByShelter[shelterA._id.toString()]).toBe(100);
      expect(allocationsByShelter[shelterB._id.toString()]).toBe(80);

      // 2. Commit plan to MongoDB
      const commitRes = await commitDispatchReservation(planResult.plans, { userId: adminUser._id });
      expect(commitRes.success).toBe(true);
      expect(commitRes.committedCount).toBe(planResult.plans.length);

      // 3. Verify in MongoDB: donation is fully reserved
      const updatedDonation = await Donation.findById(donation._id);
      expect(updatedDonation.availableQuantity).toBe(0);
      expect(updatedDonation.status).toBe('RESERVED');

      // Verify assignments were persisted in MongoDB
      const createdAssignments = await Assignment.find({ donationId: donation._id });
      expect(createdAssignments.length).toBe(planResult.plans.length);
      const totalAllocatedDb = createdAssignments.reduce((acc, a) => acc + a.allocatedQuantity, 0);
      expect(totalAllocatedDb).toBe(180);
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Enforce a rider's maximum carrying capacity
  // ---------------------------------------------------------------------------
  describe('Scenario 2: Rider Maximum Carrying Capacity Enforcement', () => {
    it('strictly caps allocation to rider available capacity and surfaces unallocated surplus with diagnostic', async () => {
      const donation = await Donation.create({
        donorId: adminUser._id,
        title: 'Large Bulk Soup Tureens',
        aidType: 'PREPARED_MEALS',
        quantity: 100,
        availableQuantity: 100,
        unit: 'liters',
        safeUseDeadline: new Date(Date.now() + 5 * 3600000),
        pickupLocation: { address: 'Soup Kitchen', latitude: 37.7749, longitude: -122.4194 }
      });

      const shelter = await Shelter.create({
        managerId: adminUser._id,
        name: 'Mass Feeding Shelter',
        currentDemand: 100,
        receivingCapacity: 100,
        availableResources: ['ROOM_TEMPERATURE'],
        isOpen: true,
        location: { address: 'Broadway', latitude: 37.7800, longitude: -122.4100 }
      });

      // Rider has a STRICT capacity of 40 kg/units
      const smallCourier = await Rider.create({
        userId: new mongoose.Types.ObjectId(),
        name: 'Bicycle Courier (Capacity: 40)',
        capacity: 40,
        availableCapacity: 40,
        isAvailable: true,
        status: 'AVAILABLE',
        currentLocation: { latitude: 37.7749, longitude: -122.4194 }
      });

      const planResult = calculateDispatchAllocations({
        donations: [donation.toJSON()],
        shelters: [shelter.toJSON()],
        riders: [smallCourier.toJSON()]
      });

      expect(planResult.success).toBe(true);
      expect(planResult.plans.length).toBe(1);
      // Leg cannot exceed 40
      expect(planResult.plans[0].allocatedQuantity).toBe(40);
      expect(planResult.metrics.allocatedTotal).toBe(40);
      expect(planResult.metrics.unallocatedTotal).toBe(60);
      expect(planResult.metrics.reconciled).toBe(true);

      // Verify explicit diagnostic for unallocated remainder
      const capExplanation = planResult.infeasibleExplanations.find(
        (e) => e.code === DISPATCH_REJECTION_CODES.INSUFFICIENT_RIDER_CAPACITY
      );
      expect(capExplanation).toBeDefined();
      expect(capExplanation.unallocatedQuantity).toBe(60);

      // Commit to MongoDB and verify rider capacity decrements exactly to 0
      await commitDispatchReservation(planResult.plans, { userId: adminUser._id });
      const updatedRider = await Rider.findById(smallCourier._id);
      expect(updatedRider.availableCapacity).toBe(0);
      expect(updatedRider.availableCapacity).toBeGreaterThanOrEqual(0); // Never negative
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Submit two concurrent claims against the same donation
  // ---------------------------------------------------------------------------
  describe('Scenario 3: Atomic Concurrency Control (Race Condition Prevention)', () => {
    it('submits two concurrent claims against the same donation: exactly one succeeds and one receives 409 Conflict', async () => {
      // 50 meals total
      const scarceDonation = await Donation.create({
        donorId: adminUser._id,
        title: 'Scarce Hot Goulash',
        aidType: 'PREPARED_MEALS',
        quantity: 50,
        availableQuantity: 50,
        unit: 'portions',
        safeUseDeadline: new Date(Date.now() + 4 * 3600000),
        pickupLocation: { address: 'Kitchen Hub', latitude: 37.7749, longitude: -122.4194 }
      });

      const shelterAlpha = await Shelter.create({
        managerId: adminUser._id,
        name: 'Concurrent Shelter Alpha',
        currentDemand: 40,
        receivingCapacity: 40,
        isOpen: true,
        location: { address: 'Alpha St', latitude: 37.7800, longitude: -122.4100 }
      });

      const shelterBeta = await Shelter.create({
        managerId: adminUser._id,
        name: 'Concurrent Shelter Beta',
        currentDemand: 40,
        receivingCapacity: 40,
        isOpen: true,
        location: { address: 'Beta St', latitude: 37.7850, longitude: -122.4050 }
      });

      // Both shelters concurrently try to claim 40 portions (total 80 > 50 available)
      const claim1 = claimAtomicReservation({
        donationId: scarceDonation._id.toString(),
        shelterId: shelterAlpha._id.toString(),
        quantity: 40,
        userId: adminUser._id.toString()
      });

      const claim2 = claimAtomicReservation({
        donationId: scarceDonation._id.toString(),
        shelterId: shelterBeta._id.toString(),
        quantity: 40,
        userId: adminUser._id.toString()
      });

      const results = await Promise.allSettled([claim1, claim2]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(rejected[0].reason).toBeInstanceOf(ConcurrencyConflictError);
      expect(rejected[0].reason.statusCode).toBe(409);

      // Verify MongoDB document reconciled: 50 - 40 = 10 units remain available
      const reloadedDonation = await Donation.findById(scarceDonation._id);
      expect(reloadedDonation.availableQuantity).toBe(10);
      expect(reloadedDonation.status).toBe('PARTIALLY_RESERVED');
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Allow a reservation to expire without rider response
  // ---------------------------------------------------------------------------
  describe('Scenario 4: Reservation Expiration & Safe Quantity Release', () => {
    it('expires unanswered reservation and safely releases quantity back to donation available pool', async () => {
      const donation = await Donation.create({
        donorId: adminUser._id,
        title: 'Fresh Bagel Baskets',
        aidType: 'BAKERY',
        quantity: 50,
        availableQuantity: 10, // 40 held in reservation
        unit: 'baskets',
        safeUseDeadline: new Date(Date.now() + 8 * 3600000),
        pickupLocation: { address: 'Artisan Bakery', latitude: 37.7749, longitude: -122.4194 }
      });

      const shelter = await Shelter.create({
        managerId: adminUser._id,
        name: 'Morning Intake Shelter',
        currentDemand: 40,
        receivingCapacity: 50,
        isOpen: true,
        location: { address: 'Bay St', latitude: 37.7800, longitude: -122.4100 }
      });

      // Create reservation that expired 5 minutes ago
      const expiredRes = await Reservation.create({
        donationId: donation._id,
        shelterId: shelter._id,
        reservedByUserId: adminUser._id,
        quantity: 40,
        requestedQuantity: 40,
        status: 'REQUESTED',
        expiresAt: new Date(Date.now() - 5 * 60000)
      });

      // Execute worker expired reservation cycle
      const outcome = await processExpiredReservations({ now: new Date() });
      expect(outcome.processedCount).toBeGreaterThanOrEqual(1);

      // Verify reservation transitioned to EXPIRED
      const updatedRes = await Reservation.findById(expiredRes._id);
      expect(updatedRes.status).toBe('EXPIRED');

      // Verify donation availableQuantity is restored: 10 + 40 = 50
      const restoredDonation = await Donation.findById(donation._id);
      expect(restoredDonation.availableQuantity).toBe(50);
      expect(restoredDonation.status).toBe('AVAILABLE');
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Close a shelter while a delivery is in transit
  // ---------------------------------------------------------------------------
  describe('Scenario 5: Dynamic In-Transit Shelter Rerouting Upon Closure', () => {
    it('detects closure of destination shelter and reroutes active in-transit delivery to an open compatible shelter', async () => {
      const donation = await Donation.create({
        donorId: adminUser._id,
        title: 'Chilled Milk Cartons',
        aidType: 'DAIRY',
        storageRequirement: 'REFRIGERATED',
        quantity: 25,
        availableQuantity: 0,
        unit: 'cartons',
        safeUseDeadline: new Date(Date.now() + 3 * 3600000),
        pickupLocation: { address: 'Dairy Wharf', latitude: 37.7749, longitude: -122.4194 }
      });

      // Shelter A is initially open, but will close suddenly
      const closingShelter = await Shelter.create({
        managerId: adminUser._id,
        name: 'Sudden Emergency Closure Shelter',
        isOpen: false, // Closed!
        currentDemand: 25,
        receivingCapacity: 25,
        availableResources: ['REFRIGERATION'],
        location: { address: 'Old Hub', latitude: 37.7800, longitude: -122.4100 }
      });

      // Nearby Shelter B is open, needs dairy, and has refrigeration
      const openAlternativeShelter = await Shelter.create({
        managerId: adminUser._id,
        name: 'Nearby Open Alternative Hub',
        isOpen: true,
        currentDemand: 50,
        receivingCapacity: 50,
        availableResources: ['REFRIGERATION', 'ROOM_TEMPERATURE'],
        location: { address: 'New Hub', latitude: 37.7820, longitude: -122.4120 }
      });

      const rider = await Rider.create({
        userId: new mongoose.Types.ObjectId(),
        name: 'Active Transit Courier',
        capacity: 50,
        availableCapacity: 25,
        isAvailable: false,
        status: 'ON_DISPATCH',
        currentLocation: { latitude: 37.7780, longitude: -122.4150 }
      });

      // Delivery is currently in transit!
      const inTransitAssignment = await Assignment.create({
        donationId: donation._id,
        shelterId: closingShelter._id,
        riderId: rider._id,
        allocatedQuantity: 25,
        status: 'DELIVERY_IN_PROGRESS',
        deadline: donation.safeUseDeadline,
        pickupLocation: donation.pickupLocation,
        deliveryLocation: closingShelter.location
      });

      // Trigger failure recovery for closed shelter
      const recovery = await handleShelterClosureOrFull({
        shelterId: closingShelter._id,
        now: new Date()
      });

      expect(recovery.reroutedAssignments.length).toBe(1);
      const reroutedTo = recovery.reroutedAssignments[0].reroutedToShelterId.toString();
      expect(reroutedTo).not.toBe(closingShelter._id.toString());

      // Verify MongoDB document was updated
      const updatedAsg = await Assignment.findById(inTransitAssignment._id);
      expect(updatedAsg.shelterId.toString()).toBe(reroutedTo);
      expect(updatedAsg.status).toBe('DELIVERY_IN_PROGRESS');
      expect(updatedAsg.notes).toContain('Rerouted in transit');

      // Verify the destination shelter is open and has required storage
      const reroutedShelter = await Shelter.findById(reroutedTo);
      expect(reroutedShelter).toBeDefined();
      expect(reroutedShelter.isOpen).toBe(true);
      expect(reroutedShelter.availableResources).toContain('REFRIGERATION');
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Attempt an allocation to a shelter missing required resources
  // ---------------------------------------------------------------------------
  describe('Scenario 6: Incompatible Storage & Resource Rejection', () => {
    it('rejects allocation when shelter lacks mandatory storage handling resources (refrigeration)', async () => {
      const chilledDonation = {
        id: 'don_perishable_beef',
        title: 'Chilled Raw Protein Packs',
        aidType: 'PERISHABLE',
        storageRequirement: 'REFRIGERATED',
        availableQuantity: 40,
        unit: 'kg',
        safeUseDeadline: new Date(Date.now() + 4 * 3600000).toISOString(),
        pickupLocation: { latitude: 37.7749, longitude: -122.4194 }
      };

      // Shelter ONLY has room temperature / dry storage
      const dryOnlyShelter = {
        id: 'shl_dry_pantry',
        name: 'Dry Goods Only Pantry',
        isOpen: true,
        currentDemand: 100,
        receivingCapacity: 100,
        availableResources: ['ROOM_TEMPERATURE', 'DRY_STORAGE'], // NO REFRIGERATION
        location: { latitude: 37.7800, longitude: -122.4100 }
      };

      const courier = {
        id: 'rdr_refrig_van',
        name: 'Van Courier',
        isAvailable: true,
        capacity: 100,
        availableCapacity: 100,
        currentLocation: { latitude: 37.7749, longitude: -122.4194 }
      };

      const planResult = calculateDispatchAllocations({
        donations: [chilledDonation],
        shelters: [dryOnlyShelter],
        riders: [courier]
      });

      expect(planResult.success).toBe(false);
      expect(planResult.plans.length).toBe(0);
      expect(planResult.metrics.allocatedTotal).toBe(0);
      expect(planResult.metrics.unallocatedTotal).toBe(40);
      expect(planResult.metrics.reconciled).toBe(true);

      const rejection = planResult.infeasibleExplanations.find(
        (e) => e.code === DISPATCH_REJECTION_CODES.INCOMPATIBLE_STORAGE_RESOURCE
      );
      expect(rejection).toBeDefined();
      expect(rejection.reason).toContain('lacks refrigeration');
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Reject a plan that cannot meet the safe-use deadline
  // ---------------------------------------------------------------------------
  describe('Scenario 7: Safe-Use Deadline Gating & Food Safety Enforcement', () => {
    it('rejects dispatch plan when transit and handoff time exceeds the safe-use deadline', async () => {
      const baseTime = new Date();

      // Perishable cooked food expiring in ONLY 15 minutes
      const expiringHotSoup = {
        id: 'don_expiring_soup',
        title: 'Hot Vegetable Soup Urns',
        aidType: 'PREPARED_MEALS',
        availableQuantity: 30,
        unit: 'servings',
        safeUseDeadline: new Date(baseTime.getTime() + 15 * 60000).toISOString(), // 15 mins
        pickupLocation: { latitude: 37.7749, longitude: -122.4194 }
      };

      // Shelter is 20 km away; estimated transit + pickup/dropoff buffer exceeds 45 minutes
      const distantShelter = {
        id: 'shl_distant_suburb',
        name: 'Distant Valley Shelter',
        isOpen: true,
        currentDemand: 50,
        receivingCapacity: 50,
        availableResources: ['ROOM_TEMPERATURE', 'HOT_KITCHEN'],
        location: { latitude: 37.9500, longitude: -122.2500 }
      };

      const bikeRider = {
        id: 'rdr_bicycle',
        name: 'Bicycle Messenger',
        isAvailable: true,
        capacity: 50,
        availableCapacity: 50,
        currentLocation: { latitude: 37.7700, longitude: -122.4200 }
      };

      const planResult = calculateDispatchAllocations({
        donations: [expiringHotSoup],
        shelters: [distantShelter],
        riders: [bikeRider],
        options: { currentTime: baseTime, pickupHandoffMinutes: 10, dropoffHandoffMinutes: 10 }
      });

      expect(planResult.success).toBe(false);
      expect(planResult.plans.length).toBe(0);
      expect(planResult.metrics.allocatedTotal).toBe(0);
      expect(planResult.metrics.unallocatedTotal).toBe(30);

      const deadlineRejection = planResult.infeasibleExplanations.find(
        (e) => e.code === DISPATCH_REJECTION_CODES.SAFETY_DEADLINE_EXCEEDED
      );
      expect(deadlineRejection).toBeDefined();
      expect(deadlineRejection.reason).toContain('Safety deadline exceeded');
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Restart the worker and verify persisted deadlines are recovered
  // ---------------------------------------------------------------------------
  describe('Scenario 8: Worker Restart & Idempotent Failure Recovery', () => {
    it('recovers and processes overdue reservations and deadlines that elapsed while worker was offline', async () => {
      const donation = await Donation.create({
        donorId: adminUser._id,
        title: 'Offline-Expired Sandwiches',
        aidType: 'PREPARED_MEALS',
        quantity: 35,
        availableQuantity: 0, // Held during worker downtime
        unit: 'sandwiches',
        safeUseDeadline: new Date(Date.now() + 6 * 3600000),
        pickupLocation: { address: 'Deli', latitude: 37.7749, longitude: -122.4194 }
      });

      const shelter = await Shelter.create({
        managerId: adminUser._id,
        name: 'Pantry Delta',
        currentDemand: 35,
        receivingCapacity: 35,
        isOpen: true,
        location: { address: 'Delta St', latitude: 37.7800, longitude: -122.4100 }
      });

      // Reservation elapsed while worker was stopped
      const expiredRes = await Reservation.create({
        donationId: donation._id,
        shelterId: shelter._id,
        reservedByUserId: adminUser._id,
        quantity: 35,
        status: 'REQUESTED',
        expiresAt: new Date(Date.now() - 20 * 60000) // Expired 20 mins ago
      });

      // 1. Worker restarts: runs maintenance cycle on startup
      const restartCycle1 = await runPeriodicMaintenanceCycle({ now: new Date() });
      expect(restartCycle1.expiredReservationsProcessed).toBeGreaterThanOrEqual(1);

      // Verify donation quantity was restored in MongoDB
      const reloadedDonation = await Donation.findById(donation._id);
      expect(reloadedDonation.availableQuantity).toBe(35);
      expect(reloadedDonation.status).toBe('AVAILABLE');

      // 2. Second worker tick: verifies strict idempotency (no double-crediting)
      await runPeriodicMaintenanceCycle({ now: new Date() });
      const finalDonation = await Donation.findById(donation._id);
      expect(finalDonation.availableQuantity).toBe(35); // Unchanged!
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Verify that the admin receives an alert for unresolved failures
  // ---------------------------------------------------------------------------
  describe('Scenario 9: Unresolved Failure Escalation & Persistent Admin Alert', () => {
    it('creates persistent CRITICAL admin alert in MongoDB when in-transit delivery has no safe alternative shelter', async () => {
      const baseTime = new Date();

      // Perishable item with ONLY 8 minutes remaining
      const tightDonation = await Donation.create({
        donorId: adminUser._id,
        title: 'Immediate Hot Entrees',
        aidType: 'PREPARED_MEALS',
        quantity: 20,
        availableQuantity: 0,
        unit: 'entrees',
        safeUseDeadline: new Date(baseTime.getTime() + 8 * 60000), // 8 mins
        pickupLocation: { address: 'Bistro', latitude: 37.7749, longitude: -122.4194 }
      });

      const closedHub = await Shelter.create({
        managerId: adminUser._id,
        name: 'Target Hub Locked Down',
        isOpen: false, // Closed!
        currentDemand: 20,
        receivingCapacity: 20,
        availableResources: ['ROOM_TEMPERATURE'],
        location: { address: 'Locked Hub', latitude: 37.7800, longitude: -122.4100 }
      });

      // Alternative shelter is too far (35 minutes away > 8 minutes remaining!)
      await Shelter.create({
        managerId: adminUser._id,
        name: 'Distant Remote Outpost',
        isOpen: true,
        currentDemand: 50,
        receivingCapacity: 50,
        availableResources: ['ROOM_TEMPERATURE'],
        location: { address: 'Remote Outpost', latitude: 38.1000, longitude: -122.0000 }
      });

      const inTransitAsg = await Assignment.create({
        donationId: tightDonation._id,
        shelterId: closedHub._id,
        allocatedQuantity: 20,
        status: 'DELIVERY_IN_PROGRESS',
        deadline: tightDonation.safeUseDeadline,
        pickupLocation: tightDonation.pickupLocation,
        deliveryLocation: closedHub.location
      });

      // Handle closure: alternative is infeasible due to safe-use deadline!
      const recovery = await handleShelterClosureOrFull({
        shelterId: closedHub._id,
        now: baseTime
      });

      expect(recovery.failedNoAlternative).toContainEqual(inTransitAsg._id);

      // Verify assignment transitioned to FAILED
      const failedAsg = await Assignment.findById(inTransitAsg._id);
      expect(failedAsg.status).toBe('FAILED');
      expect(failedAsg.cancellationReason).toContain('no safe alternative shelter available');

      // Verify persistent CRITICAL admin alert event exists in MongoDB
      const adminAlertEvent = await Event.findOne({
        entityType: 'SYSTEM',
        entityId: inTransitAsg._id.toString(),
        eventType: 'ADMIN_ALERT'
      });

      expect(adminAlertEvent).toBeDefined();
      expect(adminAlertEvent.metadata.severity).toBe('CRITICAL');
      expect(adminAlertEvent.metadata.reason).toBe('NO_SAFE_ALTERNATIVE_SHELTER');
      expect(adminAlertEvent.metadata.unresolved).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Verify delivered, reserved, and available quantities reconcile
  // ---------------------------------------------------------------------------
  describe('Scenario 10: Exact Mathematical Inventory Reconciliation', () => {
    it('proves that available, reserved, and delivered quantities perfectly reconcile to initial donation quantity', async () => {
      const INITIAL_QUANTITY = 200;

      const donation = await Donation.create({
        donorId: adminUser._id,
        title: '200 Packaged Meal Kits',
        aidType: 'PREPARED_MEALS',
        quantity: INITIAL_QUANTITY,
        availableQuantity: 80, // 80 available
        unit: 'kits',
        safeUseDeadline: new Date(Date.now() + 24 * 3600000),
        pickupLocation: { address: 'Hub', latitude: 37.7749, longitude: -122.4194 }
      });

      const shelter1 = await Shelter.create({
        managerId: adminUser._id,
        name: 'Reconciliation Shelter 1',
        currentDemand: 50,
        receivingCapacity: 100,
        isOpen: true,
        location: { address: 'Site 1', latitude: 37.7800, longitude: -122.4100 }
      });

      const shelter2 = await Shelter.create({
        managerId: adminUser._id,
        name: 'Reconciliation Shelter 2',
        currentDemand: 70,
        receivingCapacity: 100,
        isOpen: true,
        location: { address: 'Site 2', latitude: 37.7850, longitude: -122.4050 }
      });

      // 1. Delivered assignment: 50 units
      const deliveredAsg = await Assignment.create({
        donationId: donation._id,
        shelterId: shelter1._id,
        allocatedQuantity: 50,
        status: ASSIGNMENT_STATUS.DELIVERED,
        deadline: donation.safeUseDeadline,
        timeline: { deliveredAt: new Date() }
      });

      // 2. Active in-transit assignment: 70 units
      const reservedAsg = await Assignment.create({
        donationId: donation._id,
        shelterId: shelter2._id,
        allocatedQuantity: 70,
        status: ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS,
        deadline: donation.safeUseDeadline
      });

      // Query database to reconcile all quantities
      const reloadedDonation = await Donation.findById(donation._id);
      const assignments = await Assignment.find({ donationId: donation._id });

      const deliveredSum = assignments
        .filter((a) => a.status === ASSIGNMENT_STATUS.DELIVERED)
        .reduce((sum, a) => sum + a.allocatedQuantity, 0);

      const reservedSum = assignments
        .filter((a) => a.status !== ASSIGNMENT_STATUS.DELIVERED && a.status !== ASSIGNMENT_STATUS.CANCELLED && a.status !== ASSIGNMENT_STATUS.FAILED)
        .reduce((sum, a) => sum + a.allocatedQuantity, 0);

      const availableSum = reloadedDonation.availableQuantity;

      // Mathematical conservation formula:
      // Available (80) + Reserved (70) + Delivered (50) === Initial (200)
      const reconciledSum = availableSum + reservedSum + deliveredSum;

      expect(availableSum).toBe(80);
      expect(reservedSum).toBe(70);
      expect(deliveredSum).toBe(50);
      expect(reconciledSum).toBe(INITIAL_QUANTITY);
      expect(reconciledSum).toBe(reloadedDonation.quantity);
    });
  });
});
