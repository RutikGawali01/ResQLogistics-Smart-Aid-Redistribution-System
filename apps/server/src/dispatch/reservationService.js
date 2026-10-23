import mongoose from 'mongoose';
import { Donation } from '../models/Donation.js';
import { Shelter } from '../models/Shelter.js';
import { Rider } from '../models/Rider.js';
import { Assignment } from '../models/Assignment.js';
import { Reservation } from '../models/Reservation.js';
import { Event } from '../models/Event.js';
import { ASSIGNMENT_STATUS, SOCKET_EVENTS } from '@aidflow/shared';
import { broadcastEvent } from '../socket/index.js';

export class ConcurrencyConflictError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ConcurrencyConflictError';
    this.statusCode = 409;
    this.details = details;
  }
}

/**
 * Claims a reservation on a donation atomically using MongoDB conditional updates.
 * Prevents duplicate or overlapping reservations for the same quantity.
 *
 * @param {Object} params
 * @param {string} params.donationId - ID of the donation to reserve
 * @param {string} params.shelterId - Target recipient shelter ID
 * @param {number} params.quantity - Quantity to reserve
 * @param {string} params.userId - User claiming the reservation
 * @param {string} [params.assignmentId] - Optional linked assignment ID
 * @param {number} [params.timeoutMinutes=15] - Expiration deadline window in minutes
 * @returns {Promise<{ reservation: Object, updatedDonation: Object }>}
 */
export async function claimAtomicReservation({
  donationId,
  shelterId,
  quantity,
  userId,
  assignmentId = null,
  timeoutMinutes = 15
}) {
  const numQuantity = Number(quantity);
  if (!donationId || !shelterId || !numQuantity || numQuantity <= 0) {
    throw new Error('Valid donationId, shelterId, and positive quantity are required');
  }

  // 1. Concurrency-safe atomic check & decrement
  // Uses $gte guard on availableQuantity to prevent concurrent double-booking
  const updatedDonation = await Donation.findOneAndUpdate(
    {
      _id: donationId,
      availableQuantity: { $gte: numQuantity }
    },
    {
      $inc: { availableQuantity: -numQuantity }
    },
    { new: true }
  );

  if (!updatedDonation) {
    throw new ConcurrencyConflictError(
      `Cannot claim reservation of ${numQuantity} units: Donation ${donationId} has insufficient available quantity (concurrency conflict).`,
      { donationId, requestedQuantity: numQuantity }
    );
  }

  // Update donation status if completely depleted
  if (updatedDonation.availableQuantity <= 0) {
    await Donation.updateOne({ _id: donationId }, { status: 'RESERVED' });
  } else {
    await Donation.updateOne({ _id: donationId }, { status: 'PARTIALLY_RESERVED' });
  }

  // 2. Persist Reservation in MongoDB with explicit expiresAt deadline
  const expiresAt = new Date(Date.now() + timeoutMinutes * 60000);
  const reservation = await Reservation.create({
    donationId: updatedDonation._id,
    shelterId,
    reservedByUserId: userId,
    quantity: numQuantity,
    requestedQuantity: numQuantity,
    status: 'REQUESTED',
    expiresAt,
    assignmentId: assignmentId || null
  });

  // 3. Log event history
  await Event.logEvent({
    entityType: 'RESERVATION',
    entityId: reservation._id,
    eventType: 'RESERVATION_CLAIMED',
    actorId: userId,
    metadata: {
      donationId,
      shelterId,
      quantity: numQuantity,
      expiresAt: expiresAt.toISOString(),
      remainingAvailable: updatedDonation.availableQuantity
    }
  });

  return { reservation, updatedDonation };
}

/**
 * Safely releases a reservation and restores available quantity to the donation.
 * Idempotent: Only releases if status is currently REQUESTED or CONFIRMED.
 *
 * @param {Object} params
 * @param {string} params.reservationId
 * @param {string} [params.reason='User cancelled']
 * @param {string} [params.actorId]
 * @returns {Promise<Object>}
 */
export async function releaseReservation({ reservationId, reason = 'Cancelled', actorId = null }) {
  const reservation = await Reservation.findOneAndUpdate(
    {
      _id: reservationId,
      status: { $in: ['REQUESTED', 'CONFIRMED'] }
    },
    {
      $set: { status: 'CANCELLED' }
    },
    { new: true }
  );

  if (!reservation) {
    return { success: false, reason: 'Reservation not found or already released/expired' };
  }

  // Restore quantity to donation
  const updatedDonation = await Donation.findByIdAndUpdate(
    reservation.donationId,
    {
      $inc: { availableQuantity: reservation.quantity },
      $set: { status: 'AVAILABLE' }
    },
    { new: true }
  );

  // If linked to assignment in PENDING_ACCEPTANCE, reset assignment
  if (reservation.assignmentId) {
    const assignment = await Assignment.findById(reservation.assignmentId);
    if (assignment && assignment.status === ASSIGNMENT_STATUS.PENDING_ACCEPTANCE) {
      if (assignment.riderId) {
        await Rider.findByIdAndUpdate(assignment.riderId, {
          $inc: { availableCapacity: assignment.allocatedQuantity },
          $set: { isAvailable: true, status: 'AVAILABLE' }
        });
      }
      assignment.status = ASSIGNMENT_STATUS.UNASSIGNED;
      assignment.riderId = null;
      await assignment.save();
    }
  }

  await Event.logEvent({
    entityType: 'RESERVATION',
    entityId: reservation._id,
    eventType: 'RESERVATION_RELEASED',
    actorId,
    metadata: {
      reason,
      releasedQuantity: reservation.quantity,
      newAvailableQuantity: updatedDonation?.availableQuantity
    }
  });

  return { success: true, reservation, updatedDonation };
}

/**
 * Commits a calculated dispatch plan into persistent database reservations.
 *
 * This operation is strictly separated from calculation to uphold pure functional calculation,
 * and executes optimistic concurrency checks on remaining available quantities.
 *
 * @param {Array<Object>|Object} plan - Array of allocation legs or single plan object
 * @param {Object} [options]
 * @param {string} [options.actorId] - ID of admin or manager committing the reservation
 * @returns {Promise<Object>} Committed assignments, reservations, and updated entity states
 */
export async function commitDispatchReservation(plan, options = {}) {
  const legs = Array.isArray(plan)
    ? plan
    : plan.plans && Array.isArray(plan.plans)
    ? plan.plans
    : [plan];

  if (legs.length === 0) {
    throw new Error('No allocation legs provided to commit reservations');
  }

  const createdAssignments = [];
  const createdReservations = [];
  const committedLegs = [];

  for (const leg of legs) {
    const donationId = leg.donationId;
    const shelterId = leg.shelter?.id || leg.shelterId;
    const riderId = leg.rider?.id || leg.riderId || null;
    const quantity = Number(leg.allocatedQuantity);

    if (!donationId || !shelterId || !quantity || quantity <= 0) {
      throw new Error(`Invalid allocation leg format: ${JSON.stringify(leg)}`);
    }

    // 1. Concurrency-safe atomic decrement of donation available quantity
    // Using atomic findOneAndUpdate with $gte guard against concurrent double-allocation
    const updatedDonation = await Donation.findOneAndUpdate(
      {
        _id: donationId,
        availableQuantity: { $gte: quantity }
      },
      {
        $inc: { availableQuantity: -quantity }
      },
      { new: true }
    );

    if (!updatedDonation) {
      throw new ConcurrencyConflictError(
        `Failed to commit allocation of ${quantity} units: Donation ${donationId} does not have sufficient available quantity (concurrency conflict).`,
        { donationId, requestedQuantity: quantity }
      );
    }

    // Update donation status if completely reserved
    if (updatedDonation.availableQuantity <= 0) {
      await Donation.updateOne({ _id: donationId }, { status: 'RESERVED' });
    } else {
      await Donation.updateOne({ _id: donationId }, { status: 'PARTIALLY_RESERVED' });
    }

    // 2. Decrement shelter demand
    let shelterDoc = null;
    if (mongoose.Types.ObjectId.isValid(shelterId)) {
      shelterDoc = await Shelter.findByIdAndUpdate(
        shelterId,
        {
          $inc: { currentDemand: -quantity }
        },
        { new: true }
      );
    }

    // 3. Concurrency-safe decrement of rider capacity if rider assigned
    let riderDoc = null;
    if (riderId && mongoose.Types.ObjectId.isValid(riderId)) {
      riderDoc = await Rider.findOneAndUpdate(
        {
          _id: riderId,
          availableCapacity: { $gte: quantity }
        },
        {
          $inc: { availableCapacity: -quantity }
        },
        { new: true }
      );

      if (riderDoc && riderDoc.availableCapacity <= 0) {
        await Rider.updateOne(
          { _id: riderId },
          { isAvailable: false, status: 'ON_DISPATCH' }
        );
      }
    }

    // 4. Create persistent Assignment record
    const pickupLoc = leg.route?.pickupAddress
      ? {
          address: leg.route.pickupAddress,
          latitude: updatedDonation.pickupLocation?.latitude || 37.7749,
          longitude: updatedDonation.pickupLocation?.longitude || -122.4194
        }
      : updatedDonation.pickupLocation || {
          address: 'Pickup Depot',
          latitude: 37.7749,
          longitude: -122.4194
        };

    const deliveryLoc = leg.route?.deliveryAddress
      ? {
          address: leg.route.deliveryAddress,
          latitude: shelterDoc?.location?.latitude || 37.7915,
          longitude: shelterDoc?.location?.longitude || -122.3980
        }
      : shelterDoc?.location || {
          address: 'Shelter Hub',
          latitude: 37.7915,
          longitude: -122.3980
        };

    const deadlineDate = leg.timing?.safetyDeadline
      ? new Date(leg.timing.safetyDeadline)
      : updatedDonation.safeUseDeadline || new Date(Date.now() + 86400000);

    const assignment = await Assignment.create({
      donationId: updatedDonation._id,
      shelterId,
      riderId: riderDoc ? riderDoc._id : null,
      allocatedQuantity: quantity,
      status: riderDoc ? ASSIGNMENT_STATUS.PENDING_ACCEPTANCE : ASSIGNMENT_STATUS.UNASSIGNED,
      deadline: deadlineDate,
      pickupLocation: pickupLoc,
      deliveryLocation: deliveryLoc,
      timeline: {
        assignedAt: new Date()
      },
      notes: `Dispatch Engine Plan Leg [Score: ${leg.rankingScore || 'N/A'}]`
    });

    // 5. Persist Reservation record in MongoDB with explicit response timeout
    const reservationExpiresAt = new Date(Date.now() + 15 * 60000); // 15 min response window
    const reservation = await Reservation.create({
      assignmentId: assignment._id,
      donationId: updatedDonation._id,
      shelterId,
      reservedByUserId: options.actorId || updatedDonation.donorId,
      quantity,
      requestedQuantity: quantity,
      status: riderDoc ? 'REQUESTED' : 'CONFIRMED',
      expiresAt: reservationExpiresAt
    });

    createdAssignments.push(assignment);
    createdReservations.push(reservation);
    committedLegs.push({
      legId: leg.id,
      assignmentId: assignment._id,
      reservationId: reservation._id,
      donationId: updatedDonation._id,
      shelterId,
      riderId: riderDoc ? riderDoc._id : null,
      allocatedQuantity: quantity,
      remainingDonationAvailable: updatedDonation.availableQuantity,
      status: assignment.status
    });

    // 6. Record in Event history
    await Event.logEvent({
      entityType: 'ASSIGNMENT',
      entityId: assignment._id,
      eventType: 'ASSIGNMENT_CREATED',
      actorId: options.actorId,
      metadata: {
        donationId: updatedDonation._id,
        shelterId,
        riderId: riderDoc?._id,
        allocatedQuantity: quantity,
        reservationId: reservation._id
      }
    });

    if (riderDoc) {
      broadcastEvent(SOCKET_EVENTS.ASSIGNMENT_OFFERED, assignment);
    }
  }

  return {
    success: true,
    committedCount: createdAssignments.length,
    committedLegs,
    assignments: createdAssignments,
    reservations: createdReservations
  };
}
