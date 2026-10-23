import mongoose from 'mongoose';
import { Donation } from '../models/Donation.js';
import { Shelter } from '../models/Shelter.js';
import { Rider } from '../models/Rider.js';
import { Assignment } from '../models/Assignment.js';
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
 * Commits a calculated dispatch plan into persistent database reservations.
 *
 * This operation is strictly separated from calculation to uphold pure functional calculation,
 * and executes optimistic concurrency checks on remaining available quantities.
 *
 * @param {Array<Object>|Object} plan - Array of allocation legs or single plan object
 * @param {Object} [options]
 * @param {string} [options.actorId] - ID of admin or manager committing the reservation
 * @returns {Promise<Object>} Committed assignments and updated entity states
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
      await Donation.updateOne(
        { _id: donationId },
        { status: 'RESERVED' }
      );
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

    const assignment = await Assignment.create({
      donationId: updatedDonation._id,
      shelterId,
      riderId: riderDoc ? riderDoc._id : null,
      allocatedQuantity: quantity,
      status: riderDoc ? ASSIGNMENT_STATUS.PENDING_ACCEPTANCE : ASSIGNMENT_STATUS.UNASSIGNED,
      deadline: leg.timing?.safetyDeadline ? new Date(leg.timing.safetyDeadline) : new Date(Date.now() + 86400000),
      pickupLocation: pickupLoc,
      deliveryLocation: deliveryLoc,
      timeline: {
        assignedAt: new Date()
      },
      notes: `Dispatch Engine Plan Leg [Score: ${leg.rankingScore || 'N/A'}]`
    });

    createdAssignments.push(assignment);
    committedLegs.push({
      legId: leg.id,
      assignmentId: assignment._id,
      donationId: updatedDonation._id,
      shelterId,
      riderId: riderDoc ? riderDoc._id : null,
      allocatedQuantity: quantity,
      remainingDonationAvailable: updatedDonation.availableQuantity,
      status: assignment.status
    });

    if (riderDoc) {
      broadcastEvent(SOCKET_EVENTS.ASSIGNMENT_OFFERED, assignment);
    }
  }

  return {
    success: true,
    committedCount: createdAssignments.length,
    committedLegs,
    assignments: createdAssignments
  };
}
