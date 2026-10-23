import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import {
  processExpiredReservations,
  detectOverdueAssignments,
  handleShelterClosureOrFull,
  runPeriodicMaintenanceCycle
} from '../recovery/failureRecoveryService.js';
import {
  claimAtomicReservation,
  ConcurrencyConflictError
} from '../../../server/src/dispatch/reservationService.js';

describe('AidFlow Concurrency-Safe Reservations & Failure Recovery Suite', () => {
  let Donation, Shelter, Rider, Assignment, Reservation, Event, User;
  let testUser;

  beforeAll(async () => {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });

    const models = await import('../../../server/src/models/index.js');
    Donation = models.Donation;
    Shelter = models.Shelter;
    Rider = models.Rider;
    Assignment = models.Assignment;
    Reservation = models.Reservation;
    Event = models.Event;
    User = models.User;

    testUser = await User.findOne({ role: 'ADMIN' });
    if (!testUser) {
      testUser = await User.create({
        email: `recovery_admin_${Date.now()}@aidflow.org`,
        name: 'Recovery Admin',
        role: 'ADMIN',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890'
      });
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('1. Atomic Simultaneous Reservation Claims', () => {
    it('only one concurrent claim can reserve limited donation quantity (race condition prevention)', async () => {
      // Create a donation with only 50 units available
      const donation = await Donation.create({
        donorId: testUser._id,
        title: 'Limited Casseroles',
        aidType: 'PREPARED_MEALS',
        quantity: 50,
        availableQuantity: 50,
        unit: 'SERVINGS',
        safeUseDeadline: new Date(Date.now() + 4 * 3600000),
        pickupLocation: { address: 'Kitchen', latitude: 37.7749, longitude: -122.4194 }
      });

      const shelter1 = await Shelter.create({
        managerId: testUser._id,
        name: 'Claim Shelter Alpha',
        currentDemand: 40,
        receivingCapacity: 40,
        location: { address: 'Site A', latitude: 37.7800, longitude: -122.4100 }
      });

      const shelter2 = await Shelter.create({
        managerId: testUser._id,
        name: 'Claim Shelter Beta',
        currentDemand: 40,
        receivingCapacity: 40,
        location: { address: 'Site B', latitude: 37.7850, longitude: -122.4050 }
      });

      // Two concurrent claims each requesting 40 units (total 80 > 50 available)
      const claim1 = claimAtomicReservation({
        donationId: donation._id.toString(),
        shelterId: shelter1._id.toString(),
        quantity: 40,
        userId: testUser._id.toString()
      });

      const claim2 = claimAtomicReservation({
        donationId: donation._id.toString(),
        shelterId: shelter2._id.toString(),
        quantity: 40,
        userId: testUser._id.toString()
      });

      const results = await Promise.allSettled([claim1, claim2]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly ONE succeeds and ONE fails with ConcurrencyConflictError
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(rejected[0].reason).toBeInstanceOf(ConcurrencyConflictError);

      // Verify strict quantity reconciliation in MongoDB
      const updatedDonation = await Donation.findById(donation._id);
      expect(updatedDonation.availableQuantity).toBe(10); // 50 - 40 = 10
      expect(updatedDonation.status).toBe('PARTIALLY_RESERVED');
    });
  });

  describe('2. Expired Reservations & Safe Quantity Release', () => {
    it('expires unanswered reservations and restores available quantities to the donation', async () => {
      const donation = await Donation.create({
        donorId: testUser._id,
        title: 'Fresh Salad Bowls',
        aidType: 'PRODUCE',
        quantity: 60,
        availableQuantity: 20, // 40 already reserved
        unit: 'BOWLS',
        safeUseDeadline: new Date(Date.now() + 6 * 3600000),
        pickupLocation: { address: 'Farm Market', latitude: 37.7749, longitude: -122.4194 }
      });

      const shelter = await Shelter.create({
        managerId: testUser._id,
        name: 'Hope Pantry',
        currentDemand: 40,
        receivingCapacity: 50,
        location: { address: 'Pantry St', latitude: 37.7800, longitude: -122.4100 }
      });

      // Create an expired reservation (expired 10 minutes ago)
      const pastTime = new Date(Date.now() - 10 * 60000);
      const expiredReservation = await Reservation.create({
        donationId: donation._id,
        shelterId: shelter._id,
        reservedByUserId: testUser._id,
        quantity: 40,
        status: 'REQUESTED',
        expiresAt: pastTime
      });

      // Process expired reservations via failure recovery
      const result = await processExpiredReservations({ now: new Date() });
      expect(result.processedCount).toBeGreaterThanOrEqual(1);

      // Verify reservation transitioned to EXPIRED
      const reloadedRes = await Reservation.findById(expiredReservation._id);
      expect(reloadedRes.status).toBe('EXPIRED');

      // Verify donation availableQuantity was safely restored (20 + 40 = 60)
      const restoredDonation = await Donation.findById(donation._id);
      expect(restoredDonation.availableQuantity).toBe(60);
      expect(restoredDonation.status).toBe('AVAILABLE');

      // Verify event history logged
      const eventLog = await Event.findOne({
        entityType: 'RESERVATION',
        entityId: expiredReservation._id.toString(),
        eventType: 'RESERVATION_EXPIRED'
      });
      expect(eventLog).toBeDefined();
      expect(eventLog.metadata.releasedQuantity).toBe(40);
    });
  });

  describe('3. Worker Restart Idempotent Recovery', () => {
    it('processes expired reservations after worker restart and maintains idempotency across multiple runs', async () => {
      const donation = await Donation.create({
        donorId: testUser._id,
        title: 'Offline-Expired Meal Trays',
        aidType: 'PREPARED_MEALS',
        quantity: 30,
        availableQuantity: 0,
        unit: 'TRAYS',
        safeUseDeadline: new Date(Date.now() + 5 * 3600000),
        pickupLocation: { address: 'Catering Hub', latitude: 37.7749, longitude: -122.4194 }
      });

      const shelter = await Shelter.create({
        managerId: testUser._id,
        name: 'Shelter Gamma',
        currentDemand: 30,
        receivingCapacity: 30,
        location: { address: 'Gamma St', latitude: 37.7800, longitude: -122.4100 }
      });

      // Reservation created and expired while worker was stopped
      const expiredRes = await Reservation.create({
        donationId: donation._id,
        shelterId: shelter._id,
        reservedByUserId: testUser._id,
        quantity: 30,
        status: 'REQUESTED',
        expiresAt: new Date(Date.now() - 30 * 60000) // Expired 30 mins ago
      });

      // 1. Worker restarts: runs maintenance cycle
      const restartRun1 = await runPeriodicMaintenanceCycle({ now: new Date() });
      expect(restartRun1.expiredReservationsProcessed).toBeGreaterThanOrEqual(1);

      const reloadedDonation = await Donation.findById(donation._id);
      expect(reloadedDonation.availableQuantity).toBe(30);

      // 2. Worker runs maintenance cycle a second time: Idempotency check!
      const restartRun2 = await runPeriodicMaintenanceCycle({ now: new Date() });
      // Should NOT re-process the already EXPIRED reservation
      const reloadedRes = await Reservation.findById(expiredRes._id);
      expect(reloadedRes.status).toBe('EXPIRED');
      // Quantity should not be duplicated
      const finalDonation = await Donation.findById(donation._id);
      expect(finalDonation.availableQuantity).toBe(30);
    });
  });

  describe('4. Shelter Closure Handling & Alternative Rerouting', () => {
    it('cancels unpicked-up assignment and restores donation quantity when shelter closes before pickup', async () => {
      const donation = await Donation.create({
        donorId: testUser._id,
        title: 'Hot Soup Urns',
        aidType: 'PREPARED_MEALS',
        quantity: 25,
        availableQuantity: 0,
        unit: 'LITERS',
        safeUseDeadline: new Date(Date.now() + 3 * 3600000),
        pickupLocation: { address: 'Soup Kitchen', latitude: 37.7749, longitude: -122.4194 }
      });

      const closingShelter = await Shelter.create({
        managerId: testUser._id,
        name: 'Temporarily Closed Shelter',
        isOpen: true,
        currentDemand: 25,
        receivingCapacity: 25,
        location: { address: 'Main St', latitude: 37.7800, longitude: -122.4100 }
      });

      const assignment = await Assignment.create({
        donationId: donation._id,
        shelterId: closingShelter._id,
        allocatedQuantity: 25,
        status: 'PENDING_ACCEPTANCE',
        deadline: new Date(Date.now() + 3600000)
      });

      // Shelter closes!
      closingShelter.isOpen = false;
      await closingShelter.save();

      const recoveryResult = await handleShelterClosureOrFull({
        shelterId: closingShelter._id,
        now: new Date()
      });

      expect(recoveryResult.cancelledPrePickup).toContainEqual(assignment._id);

      const reloadedAsg = await Assignment.findById(assignment._id);
      expect(reloadedAsg.status).toBe('CANCELLED');
      expect(reloadedAsg.cancellationReason.toLowerCase()).toContain('shelter closed');

      // Available quantity is safely restored to donation for redispatch
      const reloadedDonation = await Donation.findById(donation._id);
      expect(reloadedDonation.availableQuantity).toBe(25);
    });

    it('reroutes in-transit delivery to a compatible alternative shelter with safe delivery margin', async () => {
      const baseTime = new Date();

      const donation = await Donation.create({
        donorId: testUser._id,
        title: 'Refrigerated Dairy Cartons',
        aidType: 'DAIRY',
        storageRequirement: 'REFRIGERATED',
        quantity: 20,
        availableQuantity: 0,
        unit: 'CARTONS',
        safeUseDeadline: new Date(baseTime.getTime() + 2 * 3600000), // 2 hours
        pickupLocation: { address: 'Dairy Depot', latitude: 37.7749, longitude: -122.4194 }
      });

      const closedShelter = await Shelter.create({
        managerId: testUser._id,
        name: 'Suddenly Closed Cold Storage',
        isOpen: false, // Closed!
        currentDemand: 20,
        receivingCapacity: 20,
        availableResources: ['REFRIGERATION'],
        location: { address: 'Cold St', latitude: 37.7800, longitude: -122.4100 }
      });

      // Alternative shelter nearby with refrigeration & demand
      const openAlternativeShelter = await Shelter.create({
        managerId: testUser._id,
        name: 'Nearby Relief Pantry (Alternative)',
        isOpen: true,
        currentDemand: 50,
        receivingCapacity: 50,
        availableResources: ['REFRIGERATION', 'ROOM_TEMPERATURE'],
        location: { address: 'Alternative Ave', latitude: 37.7820, longitude: -122.4120 }
      });

      const rider = await Rider.create({
        userId: new mongoose.Types.ObjectId(),
        name: 'In-Transit Courier',
        capacity: 40,
        availableCapacity: 20,
        isAvailable: false,
        status: 'ON_DISPATCH',
        currentLocation: { latitude: 37.7780, longitude: -122.4150 }
      });

      // Assignment is already in-transit (DELIVERY_IN_PROGRESS)
      const assignment = await Assignment.create({
        donationId: donation._id,
        shelterId: closedShelter._id,
        riderId: rider._id,
        allocatedQuantity: 20,
        status: 'DELIVERY_IN_PROGRESS',
        deadline: donation.safeUseDeadline,
        pickupLocation: donation.pickupLocation,
        deliveryLocation: closedShelter.location
      });

      // Trigger recovery for closed shelter
      const recoveryResult = await handleShelterClosureOrFull({
        shelterId: closedShelter._id,
        now: baseTime
      });

      expect(recoveryResult.reroutedAssignments.length).toBe(1);
      const reroutedId = recoveryResult.reroutedAssignments[0].reroutedToShelterId.toString();
      expect(reroutedId).not.toBe(closedShelter._id.toString());

      // Verify assignment was updated in MongoDB to a valid open shelter
      const reloadedAsg = await Assignment.findById(assignment._id);
      expect(reloadedAsg.shelterId.toString()).toBe(reroutedId);
      expect(reloadedAsg.status).toBe('DELIVERY_IN_PROGRESS');
      expect(reloadedAsg.notes).toContain('Rerouted in transit');

      // Verify rerouted shelter is open
      const reroutedShelter = await Shelter.findById(reroutedId);
      expect(reroutedShelter.isOpen).toBe(true);
    });

    it('generates an admin alert and marks assignment FAILED when no safe alternative shelter exists before food safety deadline', async () => {
      const baseTime = new Date();

      // Perishable item with ONLY 10 minutes until safety deadline
      const tightDeadlineDonation = await Donation.create({
        donorId: testUser._id,
        title: 'Urgent Prepared Hot Platters',
        aidType: 'PREPARED_MEALS',
        quantity: 35,
        availableQuantity: 0,
        unit: 'PLATTERS',
        safeUseDeadline: new Date(baseTime.getTime() + 10 * 60000), // 10 mins
        pickupLocation: { address: 'Buffet', latitude: 37.7749, longitude: -122.4194 }
      });

      const closedShelter = await Shelter.create({
        managerId: testUser._id,
        name: 'Closed Target Hub',
        isOpen: false,
        currentDemand: 35,
        receivingCapacity: 35,
        availableResources: ['ROOM_TEMPERATURE'],
        location: { address: 'Closed Hub', latitude: 37.7800, longitude: -122.4100 }
      });

      // The only alternative shelter is 30 km away; delivery would take ~45 minutes (> 10 mins remaining!)
      await Shelter.create({
        managerId: testUser._id,
        name: 'Distant Far Shelter',
        isOpen: true,
        currentDemand: 50,
        receivingCapacity: 50,
        availableResources: ['ROOM_TEMPERATURE'],
        location: { address: 'Distant City', latitude: 38.0000, longitude: -122.0000 }
      });

      const inTransitAsg = await Assignment.create({
        donationId: tightDeadlineDonation._id,
        shelterId: closedShelter._id,
        allocatedQuantity: 35,
        status: 'DELIVERY_IN_PROGRESS',
        deadline: tightDeadlineDonation.safeUseDeadline,
        pickupLocation: tightDeadlineDonation.pickupLocation,
        deliveryLocation: closedShelter.location
      });

      const recovery = await handleShelterClosureOrFull({
        shelterId: closedShelter._id,
        now: baseTime
      });

      expect(recovery.failedNoAlternative).toContainEqual(inTransitAsg._id);

      // Verify assignment transitioned to FAILED (safety constraints NOT silently violated)
      const failedAsg = await Assignment.findById(inTransitAsg._id);
      expect(failedAsg.status).toBe('FAILED');
      expect(failedAsg.cancellationReason).toContain('no safe alternative shelter available before food safety deadline');

      // Verify persistent CRITICAL admin alert was created
      const adminAlert = await Event.findOne({
        entityType: 'SYSTEM',
        entityId: inTransitAsg._id.toString(),
        eventType: 'ADMIN_ALERT'
      });
      expect(adminAlert).toBeDefined();
      expect(adminAlert.metadata.severity).toBe('CRITICAL');
      expect(adminAlert.metadata.reason).toBe('NO_SAFE_ALTERNATIVE_SHELTER');
      expect(adminAlert.metadata.unresolved).toBe(true);
    });
  });

  describe('5. Stalled Rider Response & Overdue Expiration', () => {
    it('detects stalled rider acceptance and returns assignment to unassigned pool', async () => {
      const donation = await Donation.create({
        donorId: testUser._id,
        title: 'Bakery Baskets',
        aidType: 'BAKERY',
        quantity: 15,
        availableQuantity: 0,
        unit: 'BASKETS',
        safeUseDeadline: new Date(Date.now() + 8 * 3600000),
        pickupLocation: { address: 'Bakery', latitude: 37.7749, longitude: -122.4194 }
      });

      const shelter = await Shelter.create({
        managerId: testUser._id,
        name: 'Bakery Dropoff',
        currentDemand: 15,
        receivingCapacity: 15,
        location: { address: 'Dropoff', latitude: 37.7800, longitude: -122.4100 }
      });

      const rider = await Rider.create({
        userId: new mongoose.Types.ObjectId(),
        name: 'Unresponsive Rider',
        capacity: 30,
        availableCapacity: 15, // 15 reserved
        isAvailable: false,
        status: 'AVAILABLE'
      });

      const stalledAssignment = await Assignment.create({
        donationId: donation._id,
        shelterId: shelter._id,
        riderId: rider._id,
        allocatedQuantity: 15,
        status: 'PENDING_ACCEPTANCE',
        deadline: new Date(Date.now() - 5 * 60000), // Deadline passed 5 mins ago
        timeline: { assignedAt: new Date(Date.now() - 25 * 60000) }
      });

      const result = await detectOverdueAssignments({ now: new Date() });
      expect(result.stalledRiderReassignments).toContainEqual(stalledAssignment._id);

      const reloadedAsg = await Assignment.findById(stalledAssignment._id);
      expect(reloadedAsg.status).toBe('UNASSIGNED');
      expect(reloadedAsg.riderId).toBeNull();

      // Rider capacity restored
      const reloadedRider = await Rider.findById(rider._id);
      expect(reloadedRider.availableCapacity).toBe(30);
      expect(reloadedRider.isAvailable).toBe(true);
    });
  });
});
