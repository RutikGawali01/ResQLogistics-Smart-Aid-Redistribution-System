import mongoose from 'mongoose';
import {
  calculateDispatchAllocations,
  validateHandlingCompatibility,
  validateSafetyDeadline,
  estimateDispatchTiming,
  ASSIGNMENT_STATUS
} from '@aidflow/shared';

// Lazy-load models from shared mongoose connection or server models
async function getModels() {
  if (mongoose.models.Donation && mongoose.models.Shelter && mongoose.models.Rider && mongoose.models.Assignment && mongoose.models.Reservation && mongoose.models.Event) {
    return {
      Donation: mongoose.models.Donation,
      Shelter: mongoose.models.Shelter,
      Rider: mongoose.models.Rider,
      Assignment: mongoose.models.Assignment,
      Reservation: mongoose.models.Reservation,
      Event: mongoose.models.Event
    };
  }
  return await import('../../server/src/models/index.js');
}

/**
 * 1. Expire unanswered reservations and safely release quantities when eligible.
 * Idempotent: Uses atomic findOneAndUpdate({ _id, status: 'REQUESTED' }).
 *
 * @param {Object} [options]
 * @param {Date} [options.now=new Date()]
 * @returns {Promise<{ processedCount: number, releasedQuantities: Array }>}
 */
export async function processExpiredReservations({ now = new Date() } = {}) {
  const { Donation, Shelter, Rider, Assignment, Reservation, Event } = await getModels();
  const currentTime = new Date(now);

  const expiredReservations = await Reservation.find({
    status: 'REQUESTED',
    expiresAt: { $lte: currentTime }
  });

  const releasedQuantities = [];

  for (const res of expiredReservations) {
    // Atomic update to EXPIRED prevents duplicate releases across concurrent worker instances or restarts
    const updatedRes = await Reservation.findOneAndUpdate(
      { _id: res._id, status: 'REQUESTED' },
      { $set: { status: 'EXPIRED' } },
      { new: true }
    );

    if (!updatedRes) continue; // Already processed by another worker tick

    // Safely release quantity back to Donation
    const updatedDonation = await Donation.findByIdAndUpdate(
      res.donationId,
      {
        $inc: { availableQuantity: res.quantity },
        $set: { status: 'AVAILABLE' }
      },
      { new: true }
    );

    // If linked to assignment in PENDING_ACCEPTANCE, cancel assignment and free rider
    if (res.assignmentId) {
      const assignment = await Assignment.findById(res.assignmentId);
      if (assignment && assignment.status === ASSIGNMENT_STATUS.PENDING_ACCEPTANCE) {
        if (assignment.riderId) {
          await Rider.findByIdAndUpdate(assignment.riderId, {
            $inc: { availableCapacity: assignment.allocatedQuantity },
            $set: { isAvailable: true, status: 'AVAILABLE' }
          });
        }

        assignment.status = ASSIGNMENT_STATUS.UNASSIGNED;
        assignment.riderId = null;
        assignment.notes = (assignment.notes || '') + ` [Reservation expired at ${currentTime.toISOString()}; unassigned]`;
        await assignment.save();
      }
    }

    // Return shelter demand
    if (res.shelterId) {
      await Shelter.findByIdAndUpdate(res.shelterId, {
        $inc: { currentDemand: res.quantity }
      });
    }

    // Record event
    await Event.logEvent({
      entityType: 'RESERVATION',
      entityId: res._id,
      eventType: 'RESERVATION_EXPIRED',
      metadata: {
        donationId: res.donationId,
        shelterId: res.shelterId,
        releasedQuantity: res.quantity,
        newAvailableQuantity: updatedDonation?.availableQuantity
      }
    });

    releasedQuantities.push({
      reservationId: res._id,
      donationId: res.donationId,
      releasedQuantity: res.quantity
    });
  }

  return {
    processedCount: releasedQuantities.length,
    releasedQuantities
  };
}

/**
 * 2. Detect overdue assignments and stalled rider responses.
 *
 * Checks:
 * - Riders that did not accept PENDING_ACCEPTANCE offers before the deadline / response window.
 * - In-transit deliveries that passed the donation's safeUseDeadline. (Never extend food safety deadlines!)
 *
 * @param {Object} [options]
 * @param {Date} [options.now=new Date()]
 * @param {number} [options.riderTimeoutMinutes=15]
 * @returns {Promise<Object>}
 */
export async function detectOverdueAssignments({ now = new Date(), riderTimeoutMinutes = 15 } = {}) {
  const { Donation, Shelter, Rider, Assignment, Event } = await getModels();
  const currentTime = new Date(now);

  const stalledCutoff = new Date(currentTime.getTime() - riderTimeoutMinutes * 60000);

  // A. Stalled Rider Acceptance
  const pendingAssignments = await Assignment.find({
    status: ASSIGNMENT_STATUS.PENDING_ACCEPTANCE,
    $or: [
      { deadline: { $lte: currentTime } },
      { 'timeline.assignedAt': { $lte: stalledCutoff } }
    ]
  });

  const stalledRiderReassignments = [];
  for (const asg of pendingAssignments) {
    const stalledRiderId = asg.riderId;
    if (stalledRiderId) {
      await Rider.findByIdAndUpdate(stalledRiderId, {
        $inc: { availableCapacity: asg.allocatedQuantity },
        $set: { isAvailable: true, status: 'AVAILABLE' }
      });
    }

    asg.status = ASSIGNMENT_STATUS.UNASSIGNED;
    asg.riderId = null;
    asg.notes = (asg.notes || '') + ` [Rider acceptance timed out at ${currentTime.toISOString()}; reassigned to pool]`;
    await asg.save();

    await Event.logEvent({
      entityType: 'ASSIGNMENT',
      entityId: asg._id,
      eventType: 'RIDER_STALLED',
      metadata: {
        stalledRiderId,
        allocatedQuantity: asg.allocatedQuantity,
        donationId: asg.donationId
      }
    });

    stalledRiderReassignments.push(asg._id);
  }

  // B. Overdue Active Deliveries & Food Safety Deadline Checks
  const activeAssignments = await Assignment.find({
    status: {
      $in: [
        ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS,
        ASSIGNMENT_STATUS.PICKED_UP,
        ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS
      ]
    },
    deadline: { $lte: currentTime }
  });

  const safetyFailedAssignments = [];
  for (const asg of activeAssignments) {
    const donation = await Donation.findById(asg.donationId);
    const safeDeadline = donation?.safeUseDeadline || asg.deadline;

    // Strict constraint: Never extend food safety deadlines to force successful delivery
    if (safeDeadline && currentTime.getTime() > new Date(safeDeadline).getTime()) {
      asg.status = ASSIGNMENT_STATUS.FAILED;
      asg.cancellationReason = `Food safety deadline exceeded at ${currentTime.toISOString()}. Delivery terminated.`;
      asg.timeline = asg.timeline || {};
      asg.timeline.cancelledAt = currentTime;
      await asg.save();

      if (asg.riderId) {
        await Rider.findByIdAndUpdate(asg.riderId, {
          $inc: { availableCapacity: asg.allocatedQuantity },
          $set: { isAvailable: true, status: 'AVAILABLE' }
        });
      }

      // Create Admin Alert
      await Event.logEvent({
        entityType: 'SYSTEM',
        entityId: asg._id,
        eventType: 'ADMIN_ALERT',
        actorRole: 'ADMIN',
        metadata: {
          severity: 'CRITICAL',
          reason: 'FOOD_SAFETY_DEADLINE_EXPIRED',
          assignmentId: asg._id,
          donationId: asg.donationId,
          riderId: asg.riderId,
          message: `Food safety deadline (${new Date(safeDeadline).toISOString()}) expired during active delivery. Assignment marked FAILED.`,
          unresolved: true
        }
      });

      safetyFailedAssignments.push(asg._id);
    }
  }

  return {
    stalledRiderReassignmentsCount: stalledRiderReassignments.length,
    safetyFailedAssignmentsCount: safetyFailedAssignments.length,
    stalledRiderReassignments,
    safetyFailedAssignments
  };
}

/**
 * 3. Handle a shelter becoming closed or full during transit.
 *
 * - Unpicked-up deliveries: Safely cancel, release quantities back to donation, and trigger redispatch.
 * - In-transit deliveries (picked-up): Search for alternative compatible shelter respecting capacity,
 *   rider position, and food safety deadline.
 * - If no safe alternative shelter exists: Terminate with FAILED and generate an Admin Alert.
 *
 * @param {Object} params
 * @param {string} params.shelterId - Closed or full shelter ID
 * @param {Date} [params.now=new Date()]
 * @returns {Promise<Object>} Recovery result
 */
export async function handleShelterClosureOrFull({ shelterId, now = new Date() }) {
  const { Donation, Shelter, Rider, Assignment, Event } = await getModels();
  const currentTime = new Date(now);

  const affectedAssignments = await Assignment.find({
    shelterId,
    status: {
      $in: [
        ASSIGNMENT_STATUS.PENDING_ACCEPTANCE,
        ASSIGNMENT_STATUS.ACCEPTED,
        ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS,
        ASSIGNMENT_STATUS.PICKED_UP,
        ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS
      ]
    }
  });

  const reroutedAssignments = [];
  const cancelledPrePickup = [];
  const failedNoAlternative = [];

  for (const asg of affectedAssignments) {
    const isPickedUp =
      asg.status === ASSIGNMENT_STATUS.PICKED_UP ||
      asg.status === ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS;

    // CASE A: NOT YET PICKED UP -> Safely cancel and release quantity back to donation
    if (!isPickedUp) {
      asg.status = ASSIGNMENT_STATUS.CANCELLED;
      asg.cancellationReason = 'Target shelter closed or reached capacity before pickup';
      asg.timeline = asg.timeline || {};
      asg.timeline.cancelledAt = currentTime;
      await asg.save();

      // Free rider capacity
      if (asg.riderId) {
        await Rider.findByIdAndUpdate(asg.riderId, {
          $inc: { availableCapacity: asg.allocatedQuantity },
          $set: { isAvailable: true, status: 'AVAILABLE' }
        });
      }

      // Restore available quantity to donation for redispatch
      await Donation.findByIdAndUpdate(asg.donationId, {
        $inc: { availableQuantity: asg.allocatedQuantity },
        $set: { status: 'AVAILABLE' }
      });

      await Event.logEvent({
        entityType: 'ASSIGNMENT',
        entityId: asg._id,
        eventType: 'ASSIGNMENT_CANCELLED_SHELTER_CLOSED',
        metadata: {
          shelterId,
          donationId: asg.donationId,
          releasedQuantity: asg.allocatedQuantity
        }
      });

      cancelledPrePickup.push(asg._id);
      continue;
    }

    // CASE B: IN TRANSIT -> Search for alternative compatible shelter
    const donation = await Donation.findById(asg.donationId);
    const rider = asg.riderId ? await Rider.findById(asg.riderId) : null;
    const riderLocation = rider?.currentLocation || asg.pickupLocation || { latitude: 37.7749, longitude: -122.4194 };

    // Query candidate alternative shelters
    const candidateShelters = await Shelter.find({
      _id: { $ne: shelterId },
      isOpen: true,
      receivingCapacity: { $gte: asg.allocatedQuantity },
      currentDemand: { $gt: 0 }
    });

    let bestAlternative = null;
    let bestAlternativeTiming = null;

    for (const altShelter of candidateShelters) {
      // 1. Compatibility check
      const compat = validateHandlingCompatibility(donation, altShelter);
      if (!compat.compatible) continue;

      // 2. Timing check from rider's current position to alternative shelter
      const timing = estimateDispatchTiming(
        riderLocation,
        riderLocation, // Already in transit; leg1 is 0
        altShelter.location
      );

      // 3. Safety deadline check (Strict: Never extend food safety deadline)
      const safetyCheck = validateSafetyDeadline(
        currentTime,
        donation.safeUseDeadline || asg.deadline,
        timing.totalTripMinutes
      );

      if (safetyCheck.safe) {
        bestAlternative = altShelter;
        bestAlternativeTiming = timing;
        break; // Found feasible alternative
      }
    }

    if (bestAlternative) {
      // Reroute assignment
      const previousShelterId = asg.shelterId;
      asg.shelterId = bestAlternative._id;
      asg.deliveryLocation = bestAlternative.location;
      asg.notes = (asg.notes || '') + ` [Rerouted in transit from closed shelter ${previousShelterId} to ${bestAlternative.name}]`;
      await asg.save();

      // Decrement alternative shelter demand
      await Shelter.findByIdAndUpdate(bestAlternative._id, {
        $inc: { currentDemand: -asg.allocatedQuantity }
      });

      await Event.logEvent({
        entityType: 'ASSIGNMENT',
        entityId: asg._id,
        eventType: 'ASSIGNMENT_REROUTED',
        metadata: {
          assignmentId: asg._id,
          previousShelterId,
          newShelterId: bestAlternative._id,
          allocatedQuantity: asg.allocatedQuantity
        }
      });

      reroutedAssignments.push({
        assignmentId: asg._id,
        reroutedToShelterId: bestAlternative._id,
        shelterName: bestAlternative.name
      });
    } else {
      // No safe alternative shelter exists before food safety deadline!
      asg.status = ASSIGNMENT_STATUS.FAILED;
      asg.cancellationReason = 'Shelter closed in transit; no safe alternative shelter available before food safety deadline';
      asg.timeline = asg.timeline || {};
      asg.timeline.cancelledAt = currentTime;
      await asg.save();

      if (asg.riderId) {
        await Rider.findByIdAndUpdate(asg.riderId, {
          $inc: { availableCapacity: asg.allocatedQuantity },
          $set: { isAvailable: true, status: 'AVAILABLE' }
        });
      }

      // Generate Critical Admin Alert (Task 8)
      await Event.logEvent({
        entityType: 'SYSTEM',
        entityId: asg._id,
        eventType: 'ADMIN_ALERT',
        actorRole: 'ADMIN',
        metadata: {
          severity: 'CRITICAL',
          reason: 'NO_SAFE_ALTERNATIVE_SHELTER',
          assignmentId: asg._id,
          closedShelterId: shelterId,
          donationId: asg.donationId,
          riderId: asg.riderId,
          allocatedQuantity: asg.allocatedQuantity,
          message: `In-transit delivery failed: Shelter closed and no alternative shelter can safely accept ${asg.allocatedQuantity} units before food safety deadline.`,
          unresolved: true
        }
      });

      failedNoAlternative.push(asg._id);
    }
  }

  return {
    shelterId,
    affectedCount: affectedAssignments.length,
    cancelledPrePickup,
    reroutedAssignments,
    failedNoAlternative
  };
}

/**
 * 4. Re-run dispatch for eligible unpicked-up quantities.
 *
 * @param {Object} [options]
 * @param {Date} [options.now=new Date()]
 * @returns {Promise<Object>}
 */
export async function redispatchEligibleDonations({ now = new Date() } = {}) {
  const { Donation, Shelter, Rider, Event } = await getModels();
  const currentTime = new Date(now);

  const availableDonations = await Donation.find({
    status: { $in: ['AVAILABLE', 'PARTIALLY_RESERVED'] },
    availableQuantity: { $gt: 0 },
    safeUseDeadline: { $gt: currentTime }
  }).lean();

  const openShelters = await Shelter.find({
    isOpen: true,
    currentDemand: { $gt: 0 },
    receivingCapacity: { $gt: 0 }
  }).lean();

  const availableRiders = await Rider.find({
    isAvailable: true,
    availableCapacity: { $gt: 0 }
  }).lean();

  if (availableDonations.length === 0 || openShelters.length === 0 || availableRiders.length === 0) {
    return {
      success: false,
      reason: 'Insufficient donations, shelters, or riders for automated redispatch'
    };
  }

  const dispatchResult = calculateDispatchAllocations({
    donations: availableDonations,
    shelters: openShelters,
    riders: availableRiders,
    options: { currentTime }
  });

  if (dispatchResult.success && dispatchResult.plans.length > 0) {
    await Event.logEvent({
      entityType: 'SYSTEM',
      entityId: 'DISPATCH_ENGINE',
      eventType: 'REDISPATCH_TRIGGERED',
      metadata: {
        plansCount: dispatchResult.plans.length,
        allocatedTotal: dispatchResult.metrics.allocatedTotal
      }
    });
  }

  return dispatchResult;
}

/**
 * 5. Full Periodic Maintenance Cycle.
 * Idempotent: Executed periodically and immediately upon worker restart.
 *
 * @param {Object} [options]
 * @param {Date} [options.now=new Date()]
 * @returns {Promise<Object>}
 */
export async function runPeriodicMaintenanceCycle({ now = new Date() } = {}) {
  const currentTime = new Date(now);

  // Step 1: Expire unanswered reservations
  const expiredRes = await processExpiredReservations({ now: currentTime });

  // Step 2: Detect overdue assignments and stalled rider responses
  const overdueRes = await detectOverdueAssignments({ now: currentTime });

  // Step 3: Check for closed shelters with active assignments
  const { Shelter } = await getModels();
  const closedShelters = await Shelter.find({ isOpen: false }).lean();
  const shelterRecoveryResults = [];
  for (const s of closedShelters) {
    const recovery = await handleShelterClosureOrFull({ shelterId: s._id, now: currentTime });
    if (recovery.affectedCount > 0) {
      shelterRecoveryResults.push(recovery);
    }
  }

  // Step 4: Re-dispatch eligible unpicked-up quantities
  const redispatchRes = await redispatchEligibleDonations({ now: currentTime });

  return {
    timestamp: currentTime.toISOString(),
    expiredReservationsProcessed: expiredRes.processedCount,
    stalledRidersReassigned: overdueRes.stalledRiderReassignmentsCount,
    safetyExpiredAssignments: overdueRes.safetyFailedAssignmentsCount,
    sheltersRecoveredCount: shelterRecoveryResults.length,
    shelterRecoveryResults,
    redispatchResult: redispatchRes
  };
}
