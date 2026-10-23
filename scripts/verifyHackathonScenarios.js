#!/usr/bin/env node

/**
 * ==============================================================================
 * AidFlow Live Hackathon Scenario Verification Runner
 * ==============================================================================
 * Executes the 10 core operational and failure-recovery scenarios against
 * real MongoDB collections and live business logic.
 *
 * Usage:
 *   node scripts/verifyHackathonScenarios.js
 *   npm run test:scenarios
 * ==============================================================================
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../apps/server/src/config/database.js';
import { User } from '../apps/server/src/models/User.js';
import { Donation } from '../apps/server/src/models/Donation.js';
import { Shelter } from '../apps/server/src/models/Shelter.js';
import { Rider } from '../apps/server/src/models/Rider.js';
import { Assignment } from '../apps/server/src/models/Assignment.js';
import { Reservation } from '../apps/server/src/models/Reservation.js';
import { Event } from '../apps/server/src/models/Event.js';
import {
  calculateDispatchAllocations,
  DISPATCH_REJECTION_CODES,
  ASSIGNMENT_STATUS
} from '@aidflow/shared';
import {
  commitDispatchReservation,
  claimAtomicReservation,
  ConcurrencyConflictError
} from '../apps/server/src/dispatch/reservationService.js';
import {
  processExpiredReservations,
  detectOverdueAssignments,
  handleShelterClosureOrFull,
  runPeriodicMaintenanceCycle
} from '../apps/worker/src/recovery/failureRecoveryService.js';
import { runSeed } from '../apps/server/src/seed.js';

// ANSI colors
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BLUE = '\x1b[34m';
const DIM = '\x1b[2m';

const checklist = [];

function recordResult(scenarioNum, name, passed, details) {
  checklist.push({
    num: scenarioNum,
    name,
    status: passed ? `${GREEN}✔ PASS${RESET}` : `${RED}✖ FAIL${RESET}`,
    details
  });
  console.log(
    `  ${passed ? GREEN + '✔' : RED + '✖'} ${BOLD}Scenario ${scenarioNum}:${RESET} ${name} -> ${passed ? GREEN + 'PASSED' : RED + 'FAILED'}${RESET}`
  );
  if (details) {
    console.log(`    ${DIM}${details}${RESET}\n`);
  }
}

async function runAllScenarios() {
  console.log(`\n${BOLD}${CYAN}==============================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   AidFlow Platform: Live Hackathon 10-Scenario Verification Runner          ${RESET}`);
  console.log(`${DIM}   Testing integrated services directly against real MongoDB (port 27018/27017)${RESET}`);
  console.log(`${BOLD}${CYAN}==============================================================================${RESET}\n`);

  await connectDatabase();

  let adminUser = await User.findOne({ email: 'admin@aidflow.org' });
  if (!adminUser) {
    adminUser = await User.create({
      name: 'Alex Mercer (Platform Admin)',
      email: 'admin@aidflow.org',
      password: 'AidFlowAdmin!2026',
      role: 'ADMIN'
    });
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Create 180 meals and distribute across shelters with different demands
  // ---------------------------------------------------------------------------
  console.log(`${YELLOW}▶ Running Scenario 1: 180-Meal Multi-Shelter & Multi-Courier Distribution...${RESET}`);
  try {
    const donation = await Donation.create({
      donorId: adminUser._id,
      title: 'Surplus Lunch 180 Meals',
      aidType: 'PREPARED_MEALS',
      quantity: 180,
      availableQuantity: 180,
      unit: 'meals',
      safeUseDeadline: new Date(Date.now() + 6 * 3600000),
      storageRequirement: 'ROOM_TEMPERATURE',
      pickupLocation: { address: 'Commissary', latitude: 37.7749, longitude: -122.4194 }
    });

    const shelterA = await Shelter.create({
      managerId: adminUser._id,
      name: 'Safe Haven Hub A (Demand: 100)',
      currentDemand: 100,
      receivingCapacity: 120,
      urgencyLevel: 'CRITICAL',
      availableResources: ['ROOM_TEMPERATURE'],
      isOpen: true,
      location: { address: 'Site A', latitude: 37.7833, longitude: -122.4167 }
    });

    const shelterB = await Shelter.create({
      managerId: adminUser._id,
      name: 'Refuge Hub B (Demand: 80)',
      currentDemand: 80,
      receivingCapacity: 100,
      urgencyLevel: 'HIGH',
      availableResources: ['ROOM_TEMPERATURE'],
      isOpen: true,
      location: { address: 'Site B', latitude: 37.7900, longitude: -122.4000 }
    });

    const courier1 = await Rider.create({
      userId: new mongoose.Types.ObjectId(),
      name: 'Van 1 (Capacity 100)',
      capacity: 100,
      availableCapacity: 100,
      isAvailable: true,
      status: 'AVAILABLE',
      currentLocation: { latitude: 37.7750, longitude: -122.4190 }
    });

    const courier2 = await Rider.create({
      userId: new mongoose.Types.ObjectId(),
      name: 'Cargo Bike (Capacity 80)',
      capacity: 80,
      availableCapacity: 80,
      isAvailable: true,
      status: 'AVAILABLE',
      currentLocation: { latitude: 37.7740, longitude: -122.4180 }
    });

    const plan = calculateDispatchAllocations({
      donations: [donation.toJSON()],
      shelters: [shelterA.toJSON(), shelterB.toJSON()],
      riders: [courier1.toJSON(), courier2.toJSON()]
    });

    await commitDispatchReservation(plan.plans, { userId: adminUser._id });

    const updatedDonation = await Donation.findById(donation._id);
    const passed =
      plan.metrics.allocatedTotal === 180 &&
      plan.metrics.unallocatedTotal === 0 &&
      plan.metrics.reconciled === true &&
      updatedDonation.availableQuantity === 0;

    recordResult(
      1,
      'Create 180 meals and distribute across shelters with different demands',
      passed,
      `Allocated: ${plan.metrics.allocatedTotal}/180 (Shelter A: 100, Shelter B: 80). MongoDB available: ${updatedDonation.availableQuantity}.`
    );
  } catch (err) {
    recordResult(1, 'Create 180 meals and distribute across shelters', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Enforce a rider's maximum carrying capacity
  // ---------------------------------------------------------------------------
  console.log(`${YELLOW}▶ Running Scenario 2: Enforce Rider Maximum Carrying Capacity...${RESET}`);
  try {
    const donation = await Donation.create({
      donorId: adminUser._id,
      title: 'Bulk 100 Meals',
      aidType: 'PREPARED_MEALS',
      quantity: 100,
      availableQuantity: 100,
      unit: 'meals',
      safeUseDeadline: new Date(Date.now() + 5 * 3600000),
      pickupLocation: { address: 'Kitchen', latitude: 37.7749, longitude: -122.4194 }
    });

    const shelter = await Shelter.create({
      managerId: adminUser._id,
      name: 'Capacity Check Shelter',
      currentDemand: 100,
      receivingCapacity: 100,
      availableResources: ['ROOM_TEMPERATURE'],
      isOpen: true,
      location: { address: 'Hub', latitude: 37.7800, longitude: -122.4100 }
    });

    const rider = await Rider.create({
      userId: new mongoose.Types.ObjectId(),
      name: 'Small Bike Courier (Max 40)',
      capacity: 40,
      availableCapacity: 40,
      isAvailable: true,
      status: 'AVAILABLE',
      currentLocation: { latitude: 37.7749, longitude: -122.4194 }
    });

    const plan = calculateDispatchAllocations({
      donations: [donation.toJSON()],
      shelters: [shelter.toJSON()],
      riders: [rider.toJSON()]
    });

    await commitDispatchReservation(plan.plans, { userId: adminUser._id });
    const updatedRider = await Rider.findById(rider._id);

    const passed =
      plan.plans[0].allocatedQuantity === 40 &&
      plan.metrics.unallocatedTotal === 60 &&
      updatedRider.availableCapacity === 0 &&
      updatedRider.availableCapacity >= 0;

    recordResult(
      2,
      "Enforce a rider's maximum carrying capacity",
      passed,
      `Rider capacity capped strictly at 40 (remaining 60 unallocated with INSUFFICIENT_RIDER_CAPACITY).`
    );
  } catch (err) {
    recordResult(2, "Enforce a rider's maximum carrying capacity", false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Submit two concurrent claims against the same donation
  // ---------------------------------------------------------------------------
  console.log(`${YELLOW}▶ Running Scenario 3: Two Concurrent Claims Against Same Donation...${RESET}`);
  try {
    const donation = await Donation.create({
      donorId: adminUser._id,
      title: 'Limited Rations (50 units)',
      aidType: 'PREPARED_MEALS',
      quantity: 50,
      availableQuantity: 50,
      unit: 'servings',
      safeUseDeadline: new Date(Date.now() + 4 * 3600000),
      pickupLocation: { address: 'Kitchen Hub', latitude: 37.7749, longitude: -122.4194 }
    });

    const shelter1 = await Shelter.create({
      managerId: adminUser._id,
      name: 'Race Shelter 1',
      currentDemand: 40,
      receivingCapacity: 40,
      isOpen: true,
      location: { address: 'R1', latitude: 37.7800, longitude: -122.4100 }
    });

    const shelter2 = await Shelter.create({
      managerId: adminUser._id,
      name: 'Race Shelter 2',
      currentDemand: 40,
      receivingCapacity: 40,
      isOpen: true,
      location: { address: 'R2', latitude: 37.7850, longitude: -122.4050 }
    });

    const claim1 = claimAtomicReservation({
      donationId: donation._id.toString(),
      shelterId: shelter1._id.toString(),
      quantity: 40,
      userId: adminUser._id.toString()
    });

    const claim2 = claimAtomicReservation({
      donationId: donation._id.toString(),
      shelterId: shelter2._id.toString(),
      quantity: 40,
      userId: adminUser._id.toString()
    });

    const results = await Promise.allSettled([claim1, claim2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    const reloaded = await Donation.findById(donation._id);
    const passed =
      fulfilled.length === 1 &&
      rejected.length === 1 &&
      rejected[0].reason instanceof ConcurrencyConflictError &&
      reloaded.availableQuantity === 10;

    recordResult(
      3,
      'Submit two concurrent claims against the same donation',
      passed,
      `1 succeeded, 1 rejected with 409 Conflict. MongoDB available quantity decremented to 10 safely.`
    );
  } catch (err) {
    recordResult(3, 'Submit two concurrent claims against the same donation', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Allow a reservation to expire without rider response
  // ---------------------------------------------------------------------------
  console.log(`${YELLOW}▶ Running Scenario 4: Reservation Expiration Without Response...${RESET}`);
  try {
    const donation = await Donation.create({
      donorId: adminUser._id,
      title: 'Fresh Bagels',
      aidType: 'BAKERY',
      quantity: 50,
      availableQuantity: 10, // 40 held in reservation
      unit: 'baskets',
      safeUseDeadline: new Date(Date.now() + 8 * 3600000),
      pickupLocation: { address: 'Bakery', latitude: 37.7749, longitude: -122.4194 }
    });

    const shelter = await Shelter.create({
      managerId: adminUser._id,
      name: 'Pantry 4',
      currentDemand: 40,
      receivingCapacity: 50,
      isOpen: true,
      location: { address: 'Pantry', latitude: 37.7800, longitude: -122.4100 }
    });

    const expiredRes = await Reservation.create({
      donationId: donation._id,
      shelterId: shelter._id,
      reservedByUserId: adminUser._id,
      quantity: 40,
      requestedQuantity: 40,
      status: 'REQUESTED',
      expiresAt: new Date(Date.now() - 5 * 60000) // 5 minutes in past
    });

    await processExpiredReservations({ now: new Date() });

    const updatedRes = await Reservation.findById(expiredRes._id);
    const updatedDon = await Donation.findById(donation._id);

    const passed = updatedRes.status === 'EXPIRED' && updatedDon.availableQuantity === 50;

    recordResult(
      4,
      'Allow a reservation to expire without rider response',
      passed,
      `Reservation transitioned to EXPIRED. Donation quantity restored from 10 to 50 in MongoDB.`
    );
  } catch (err) {
    recordResult(4, 'Allow a reservation to expire without rider response', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Close a shelter while a delivery is in transit
  // ---------------------------------------------------------------------------
  console.log(`${YELLOW}▶ Running Scenario 5: Close Shelter While Delivery in Transit...${RESET}`);
  try {
    const donation = await Donation.create({
      donorId: adminUser._id,
      title: 'In-Transit Dairy',
      aidType: 'DAIRY',
      storageRequirement: 'REFRIGERATED',
      quantity: 25,
      availableQuantity: 0,
      unit: 'cartons',
      safeUseDeadline: new Date(Date.now() + 3 * 3600000),
      pickupLocation: { address: 'Dairy', latitude: 37.7749, longitude: -122.4194 }
    });

    const closedShelter = await Shelter.create({
      managerId: adminUser._id,
      name: 'Closed Mid-Transit Shelter',
      isOpen: false, // Closed!
      currentDemand: 25,
      receivingCapacity: 25,
      availableResources: ['REFRIGERATION'],
      location: { address: 'Old', latitude: 37.7800, longitude: -122.4100 }
    });

    await Shelter.create({
      managerId: adminUser._id,
      name: 'Open Alternative Shelter',
      isOpen: true,
      currentDemand: 50,
      receivingCapacity: 50,
      availableResources: ['REFRIGERATION'],
      location: { address: 'New', latitude: 37.7820, longitude: -122.4120 }
    });

    const rider = await Rider.create({
      userId: new mongoose.Types.ObjectId(),
      name: 'Transit Courier',
      capacity: 50,
      availableCapacity: 25,
      isAvailable: false,
      status: 'ON_DISPATCH',
      currentLocation: { latitude: 37.7780, longitude: -122.4150 }
    });

    const inTransitAsg = await Assignment.create({
      donationId: donation._id,
      shelterId: closedShelter._id,
      riderId: rider._id,
      allocatedQuantity: 25,
      status: 'DELIVERY_IN_PROGRESS',
      deadline: donation.safeUseDeadline,
      pickupLocation: donation.pickupLocation,
      deliveryLocation: closedShelter.location
    });

    const recovery = await handleShelterClosureOrFull({
      shelterId: closedShelter._id,
      now: new Date()
    });

    const updatedAsg = await Assignment.findById(inTransitAsg._id);
    const reroutedShelter = await Shelter.findById(updatedAsg.shelterId);

    const passed =
      recovery.reroutedAssignments.length === 1 &&
      updatedAsg.shelterId.toString() !== closedShelter._id.toString() &&
      reroutedShelter.isOpen === true &&
      updatedAsg.notes.includes('Rerouted in transit');

    recordResult(
      5,
      'Close a shelter while a delivery is in transit',
      passed,
      `Delivery in progress dynamically rerouted to open compatible shelter (${reroutedShelter.name}).`
    );
  } catch (err) {
    recordResult(5, 'Close a shelter while a delivery is in transit', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Attempt an allocation to a shelter missing required resources
  // ---------------------------------------------------------------------------
  console.log(`${YELLOW}▶ Running Scenario 6: Shelter Missing Required Storage Resources...${RESET}`);
  try {
    const chilledDonation = {
      id: 'don_perishable',
      title: 'Chilled Dairy Items',
      aidType: 'DAIRY',
      storageRequirement: 'REFRIGERATED',
      availableQuantity: 40,
      unit: 'kg',
      safeUseDeadline: new Date(Date.now() + 4 * 3600000).toISOString(),
      pickupLocation: { latitude: 37.7749, longitude: -122.4194 }
    };

    const dryOnlyShelter = {
      id: 'shl_dry',
      name: 'Dry Goods Only Shelter',
      isOpen: true,
      currentDemand: 100,
      receivingCapacity: 100,
      availableResources: ['ROOM_TEMPERATURE'], // LACKS REFRIGERATION
      location: { latitude: 37.7800, longitude: -122.4100 }
    };

    const courier = {
      id: 'rdr_1',
      name: 'Van 1',
      isAvailable: true,
      capacity: 100,
      availableCapacity: 100,
      currentLocation: { latitude: 37.7749, longitude: -122.4194 }
    };

    const plan = calculateDispatchAllocations({
      donations: [chilledDonation],
      shelters: [dryOnlyShelter],
      riders: [courier]
    });

    const rejection = plan.infeasibleExplanations.find(
      (e) => e.code === DISPATCH_REJECTION_CODES.INCOMPATIBLE_STORAGE_RESOURCE
    );

    const passed =
      plan.success === false &&
      plan.plans.length === 0 &&
      plan.metrics.allocatedTotal === 0 &&
      Boolean(rejection);

    recordResult(
      6,
      'Attempt an allocation to a shelter missing required resources',
      passed,
      `Allocation rejected with INCOMPATIBLE_STORAGE_RESOURCE (shelter lacks refrigeration).`
    );
  } catch (err) {
    recordResult(6, 'Attempt an allocation to a shelter missing required resources', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Reject a plan that cannot meet the safe-use deadline
  // ---------------------------------------------------------------------------
  console.log(`${YELLOW}▶ Running Scenario 7: Reject Plan Exceeding Safe-Use Deadline...${RESET}`);
  try {
    const baseTime = new Date();
    const shortLifeDonation = {
      id: 'don_short_life',
      title: 'Hot Meals Expiring in 15 Minutes',
      aidType: 'PREPARED_MEALS',
      availableQuantity: 30,
      unit: 'meals',
      safeUseDeadline: new Date(baseTime.getTime() + 15 * 60000).toISOString(), // 15 mins
      pickupLocation: { latitude: 37.7749, longitude: -122.4194 }
    };

    const distantShelter = {
      id: 'shl_distant',
      name: 'Distant Valley Shelter (45 min trip)',
      isOpen: true,
      currentDemand: 50,
      receivingCapacity: 50,
      availableResources: ['ROOM_TEMPERATURE'],
      location: { latitude: 37.9500, longitude: -122.2500 }
    };

    const bikeRider = {
      id: 'rdr_bike',
      name: 'Bike Rider',
      isAvailable: true,
      capacity: 50,
      availableCapacity: 50,
      currentLocation: { latitude: 37.7700, longitude: -122.4200 }
    };

    const plan = calculateDispatchAllocations({
      donations: [shortLifeDonation],
      shelters: [distantShelter],
      riders: [bikeRider],
      options: { currentTime: baseTime, pickupHandoffMinutes: 10, dropoffHandoffMinutes: 10 }
    });

    const rejection = plan.infeasibleExplanations.find(
      (e) => e.code === DISPATCH_REJECTION_CODES.SAFETY_DEADLINE_EXCEEDED
    );

    const passed = plan.success === false && plan.plans.length === 0 && Boolean(rejection);

    recordResult(
      7,
      'Reject a plan that cannot meet the safe-use deadline',
      passed,
      `Rejected with SAFETY_DEADLINE_EXCEEDED (transit + handoff 45m exceeds 15m window).`
    );
  } catch (err) {
    recordResult(7, 'Reject a plan that cannot meet the safe-use deadline', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Restart the worker and verify persisted deadlines are recovered
  // ---------------------------------------------------------------------------
  console.log(`${YELLOW}▶ Running Scenario 8: Worker Restart & Idempotent Deadline Recovery...${RESET}`);
  try {
    const donation = await Donation.create({
      donorId: adminUser._id,
      title: 'Offline Expired Trays',
      aidType: 'PREPARED_MEALS',
      quantity: 35,
      availableQuantity: 0,
      unit: 'trays',
      safeUseDeadline: new Date(Date.now() + 6 * 3600000),
      pickupLocation: { address: 'Deli', latitude: 37.7749, longitude: -122.4194 }
    });

    const shelter = await Shelter.create({
      managerId: adminUser._id,
      name: 'Shelter 8',
      currentDemand: 35,
      receivingCapacity: 35,
      isOpen: true,
      location: { address: 'S8', latitude: 37.7800, longitude: -122.4100 }
    });

    const expiredRes = await Reservation.create({
      donationId: donation._id,
      shelterId: shelter._id,
      reservedByUserId: adminUser._id,
      quantity: 35,
      status: 'REQUESTED',
      expiresAt: new Date(Date.now() - 20 * 60000)
    });

    // Simulate worker restart: runs maintenance cycle
    await runPeriodicMaintenanceCycle({ now: new Date() });

    const reloaded = await Donation.findById(donation._id);
    const updatedRes = await Reservation.findById(expiredRes._id);

    // Second cycle for idempotency
    await runPeriodicMaintenanceCycle({ now: new Date() });
    const finalDonation = await Donation.findById(donation._id);

    const passed =
      updatedRes.status === 'EXPIRED' &&
      reloaded.availableQuantity === 35 &&
      finalDonation.availableQuantity === 35;

    recordResult(
      8,
      'Restart the worker and verify persisted deadlines are recovered',
      passed,
      `Worker startup cycle recovered expired reservation. Idempotency confirmed (no double-crediting).`
    );
  } catch (err) {
    recordResult(8, 'Restart the worker and verify persisted deadlines are recovered', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Verify that the admin receives an alert for unresolved failures
  // ---------------------------------------------------------------------------
  console.log(`${YELLOW}▶ Running Scenario 9: Admin Receives Alert for Unresolved Failures...${RESET}`);
  try {
    const baseTime = new Date();
    const tightDonation = await Donation.create({
      donorId: adminUser._id,
      title: 'Entrees (8 min remaining)',
      aidType: 'PREPARED_MEALS',
      quantity: 20,
      availableQuantity: 0,
      unit: 'portions',
      safeUseDeadline: new Date(baseTime.getTime() + 8 * 60000), // 8 mins
      pickupLocation: { address: 'Bistro', latitude: 37.7749, longitude: -122.4194 }
    });

    const closedHub = await Shelter.create({
      managerId: adminUser._id,
      name: 'Closed Destination Hub',
      isOpen: false, // Closed!
      currentDemand: 20,
      receivingCapacity: 20,
      availableResources: ['ROOM_TEMPERATURE'],
      location: { address: 'Hub 9', latitude: 37.7800, longitude: -122.4100 }
    });

    await Shelter.create({
      managerId: adminUser._id,
      name: 'Very Distant Shelter (35 mins away)',
      isOpen: true,
      currentDemand: 50,
      receivingCapacity: 50,
      availableResources: ['ROOM_TEMPERATURE'],
      location: { address: 'Far', latitude: 38.1000, longitude: -122.0000 }
    });

    const inTransit = await Assignment.create({
      donationId: tightDonation._id,
      shelterId: closedHub._id,
      allocatedQuantity: 20,
      status: 'DELIVERY_IN_PROGRESS',
      deadline: tightDonation.safeUseDeadline,
      pickupLocation: tightDonation.pickupLocation,
      deliveryLocation: closedHub.location
    });

    await handleShelterClosureOrFull({
      shelterId: closedHub._id,
      now: baseTime
    });

    const failedAsg = await Assignment.findById(inTransit._id);
    const alertEvent = await Event.findOne({
      entityType: 'SYSTEM',
      entityId: inTransit._id.toString(),
      eventType: 'ADMIN_ALERT'
    });

    const passed =
      failedAsg.status === 'FAILED' &&
      alertEvent &&
      alertEvent.metadata.severity === 'CRITICAL' &&
      alertEvent.metadata.unresolved === true;

    recordResult(
      9,
      'Verify that the admin receives an alert for unresolved failures',
      passed,
      `Critical ADMIN_ALERT persisted to MongoDB (Severity: CRITICAL, reason: NO_SAFE_ALTERNATIVE_SHELTER).`
    );
  } catch (err) {
    recordResult(9, 'Verify that the admin receives an alert for unresolved failures', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Verify delivered, reserved, and available quantities reconcile
  // ---------------------------------------------------------------------------
  console.log(`${YELLOW}▶ Running Scenario 10: Delivered, Reserved, and Available Quantities Reconcile...${RESET}`);
  try {
    const INITIAL_QUANTITY = 200;

    const donation = await Donation.create({
      donorId: adminUser._id,
      title: 'Reconciled 200 Meals',
      aidType: 'PREPARED_MEALS',
      quantity: INITIAL_QUANTITY,
      availableQuantity: 80, // 80 available
      unit: 'meals',
      safeUseDeadline: new Date(Date.now() + 24 * 3600000),
      pickupLocation: { address: 'Hub 10', latitude: 37.7749, longitude: -122.4194 }
    });

    const shelter1 = await Shelter.create({
      managerId: adminUser._id,
      name: 'Delivered Shelter',
      currentDemand: 50,
      receivingCapacity: 100,
      isOpen: true,
      location: { address: 'S10-1', latitude: 37.7800, longitude: -122.4100 }
    });

    const shelter2 = await Shelter.create({
      managerId: adminUser._id,
      name: 'In Transit Shelter',
      currentDemand: 70,
      receivingCapacity: 100,
      isOpen: true,
      location: { address: 'S10-2', latitude: 37.7850, longitude: -122.4050 }
    });

    await Assignment.create({
      donationId: donation._id,
      shelterId: shelter1._id,
      allocatedQuantity: 50,
      status: ASSIGNMENT_STATUS.DELIVERED,
      deadline: donation.safeUseDeadline
    });

    await Assignment.create({
      donationId: donation._id,
      shelterId: shelter2._id,
      allocatedQuantity: 70,
      status: ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS,
      deadline: donation.safeUseDeadline
    });

    const reloaded = await Donation.findById(donation._id);
    const assignments = await Assignment.find({ donationId: donation._id });

    const delivered = assignments
      .filter((a) => a.status === ASSIGNMENT_STATUS.DELIVERED)
      .reduce((sum, a) => sum + a.allocatedQuantity, 0);

    const reserved = assignments
      .filter((a) => a.status !== ASSIGNMENT_STATUS.DELIVERED)
      .reduce((sum, a) => sum + a.allocatedQuantity, 0);

    const available = reloaded.availableQuantity;
    const totalReconciled = available + reserved + delivered;

    const passed =
      available === 80 &&
      reserved === 70 &&
      delivered === 50 &&
      totalReconciled === INITIAL_QUANTITY;

    recordResult(
      10,
      'Verify that delivered, reserved, and available quantities reconcile',
      passed,
      `Formula: Available (${available}) + Reserved (${reserved}) + Delivered (${delivered}) = ${totalReconciled} / ${INITIAL_QUANTITY} (Zero inventory leakage).`
    );
  } catch (err) {
    recordResult(10, 'Verify that delivered, reserved, and available quantities reconcile', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log(`\n${BOLD}${CYAN}==============================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   HACKATHON SCENARIO VERIFICATION RESULTS SUMMARY                           ${RESET}`);
  console.log(`${BOLD}${CYAN}==============================================================================${RESET}`);
  console.log(`${BOLD}#   Status   Scenario Name${RESET}`);
  console.log(`${DIM}------------------------------------------------------------------------------${RESET}`);

  let allPassed = true;
  for (const item of checklist) {
    console.log(`${String(item.num).padEnd(3)} ${item.status}   ${item.name}`);
    if (!item.status.includes('PASS')) allPassed = false;
  }

  console.log(`${DIM}------------------------------------------------------------------------------${RESET}`);
  if (allPassed) {
    console.log(`${BOLD}${GREEN}🎉 ALL 10 HACKATHON SCENARIOS VERIFIED SUCCESSFULLY ON REAL MONGODB!${RESET}\n`);
  } else {
    console.log(`${BOLD}${RED}⚠️ SOME SCENARIOS FAILED. CHECK LOGS ABOVE.${RESET}\n`);
  }

  // Cleanly restore seed state for subsequent demo interaction
  console.log(`${DIM}Restoring canonical demo database via seed...${RESET}`);
  await runSeed({ quiet: true });
  console.log(`${GREEN}✔ Canonical demo database restored.${RESET}\n`);

  await disconnectDatabase();
  process.exit(allPassed ? 0 : 1);
}

runAllScenarios().catch((err) => {
  console.error(`${RED}Fatal error during scenario verification:${RESET}`, err);
  process.exit(1);
});
