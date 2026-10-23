import { Router } from 'express';
import {
  assignmentSchema,
  assignmentTransitionSchema,
  ASSIGNMENT_STATUS,
  canTransitionAssignment,
  ERROR_CODES,
  SOCKET_EVENTS,
  ROLES
} from '@aidflow/shared';
import { validateBody } from '../middleware/validator.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { Assignment } from '../models/Assignment.js';
import { Donation } from '../models/Donation.js';
import { Shelter } from '../models/Shelter.js';
import { Rider } from '../models/Rider.js';
import { Event } from '../models/Event.js';
import { isDatabaseConnected } from '../config/database.js';
import { broadcastEvent } from '../socket/index.js';

const router = Router();

// Protect all assignment endpoints with authentication
router.use(authenticate);

const inMemoryAssignments = [
  {
    id: 'asg_seed_01',
    donationId: 'don_seed_01',
    shelterId: 'shl_seed_01',
    riderId: 'rdr_seed_01',
    allocatedQuantity: 25,
    status: ASSIGNMENT_STATUS.PENDING_ACCEPTANCE,
    deadline: new Date(Date.now() + 86400000).toISOString(),
    pickupLocation: {
      address: '742 Evergreen Terrace, Springfield',
      city: 'Springfield',
      latitude: 37.7749,
      longitude: -122.4194,
      contactName: 'Ned Flanders',
      contactPhone: '+1-555-0144'
    },
    deliveryLocation: {
      address: '100 Mission Street, San Francisco, CA',
      city: 'San Francisco',
      latitude: 37.7915,
      longitude: -122.3980,
      contactName: 'Shelter Coordinator',
      contactPhone: '+1-555-0188'
    },
    timeline: {
      assignedAt: new Date(Date.now() - 300000).toISOString()
    },
    notes: 'Fragile baked goods on top; handle with care.',
    createdAt: new Date(Date.now() - 300000).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString()
  }
];

/**
 * GET /api/assignments
 * List assignments with optional filters and role scoping
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, riderId, shelterId, donationId } = req.query;

    if (isDatabaseConnected()) {
      const filter = {};
      if (status) filter.status = status;
      if (riderId) filter.riderId = riderId;
      if (shelterId) filter.shelterId = shelterId;
      if (donationId) filter.donationId = donationId;

      const assignments = await Assignment.find(filter)
        .populate('donationId', 'title aidType quantity unit pickupLocation safeUseDeadline')
        .populate('shelterId', 'name address location currentDemand urgencyLevel')
        .populate('riderId', 'name phone vehicleType status')
        .sort({ createdAt: -1 });

      return res.success(assignments, 'Assignments retrieved', { total: assignments.length });
    }

    let results = [...inMemoryAssignments];
    if (status) results = results.filter((a) => a.status === status);
    if (riderId) results = results.filter((a) => String(a.riderId) === String(riderId));
    if (shelterId) results = results.filter((a) => String(a.shelterId) === String(shelterId));
    if (donationId) results = results.filter((a) => String(a.donationId) === String(donationId));

    return res.success(results, 'Assignments retrieved (in-memory mode)', { total: results.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/assignments
 * Create an assignment and allocate aid quantity. Enforces ADMIN permission, quantity checks, and event auditing.
 */
router.post(
  '/',
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.SHELTER_MANAGER),
  validateBody(assignmentSchema),
  async (req, res, next) => {
    try {
      const data = req.validatedBody;
      const allocatedQty = Number(data.allocatedQuantity || 1);

      if (allocatedQty <= 0) {
        return res.fail(ERROR_CODES.VALIDATION_ERROR, 'allocatedQuantity must be greater than zero', null, 422);
      }

      if (isDatabaseConnected()) {
        const donation = await Donation.findById(data.donationId);
        if (!donation) {
          return res.fail(ERROR_CODES.NOT_FOUND, `Donation '${data.donationId}' not found`, null, 404);
        }

        const shelter = await Shelter.findById(data.shelterId);
        if (!shelter) {
          return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${data.shelterId}' not found`, null, 404);
        }

        if (!shelter.isOpen && !shelter.active) {
          return res.fail(ERROR_CODES.CONFLICT, `Shelter '${shelter.name}' is currently closed for intake`, null, 409);
        }

        // Validate available quantity
        if (donation.availableQuantity < allocatedQty) {
          return res.fail(
            ERROR_CODES.CONFLICT,
            `Cannot allocate ${allocatedQty} ${donation.unit}. Only ${donation.availableQuantity} ${donation.unit} available in donation.`,
            { requestedQuantity: allocatedQty, availableQuantity: donation.availableQuantity },
            409
          );
        }

        // Deduct allocated quantity from donation
        donation.availableQuantity -= allocatedQty;
        if (donation.availableQuantity === 0) {
          donation.status = 'ASSIGNED';
        }
        await donation.save();

        // Optional rider validation
        let riderDoc = null;
        if (data.riderId) {
          riderDoc = await Rider.findById(data.riderId);
          if (riderDoc) {
            if (riderDoc.availableCapacity < allocatedQty) {
              return res.fail(
                ERROR_CODES.CONFLICT,
                `Rider capacity exceeded. Available: ${riderDoc.availableCapacity} kg, Required: ${allocatedQty} kg`,
                null,
                409
              );
            }
            riderDoc.availableCapacity -= allocatedQty;
            riderDoc.status = 'ON_DISPATCH';
            riderDoc.isAvailable = false;
            await riderDoc.save();
          }
        }

        const assignmentPayload = {
          donationId: data.donationId,
          shelterId: data.shelterId,
          riderId: data.riderId || null,
          allocatedQuantity: allocatedQty,
          status: data.status || ASSIGNMENT_STATUS.PENDING_ACCEPTANCE,
          deadline: data.deadline ? new Date(data.deadline) : donation.safeUseDeadline,
          pickupLocation: data.pickupLocation || donation.pickupLocation,
          deliveryLocation: data.deliveryLocation || shelter.location,
          timeline: { assignedAt: new Date() },
          notes: data.notes || `Dispatched ${allocatedQty} ${donation.unit} to ${shelter.name}`
        };

        const created = await Assignment.create(assignmentPayload);

        if (riderDoc) {
          riderDoc.activeAssignmentId = created._id;
          await riderDoc.save();
        }

        // Audit Event
        await Event.logEvent({
          entityType: 'ASSIGNMENT',
          entityId: created._id,
          eventType: 'ASSIGNMENT_CREATED',
          actorId: req.user.id,
          actorRole: req.user.role,
          metadata: {
            donationId: data.donationId,
            shelterId: data.shelterId,
            riderId: data.riderId,
            allocatedQuantity: allocatedQty,
            status: created.status
          }
        });

        broadcastEvent(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, created);
        return res.success(created, 'Assignment created and aid allocated successfully', null, 201);
      }

      // In-memory fallback
      const mockCreated = {
        ...data,
        id: `asg_${Date.now()}`,
        allocatedQuantity: allocatedQty,
        status: data.status || ASSIGNMENT_STATUS.PENDING_ACCEPTANCE,
        deadline: new Date(Date.now() + 86400000).toISOString(),
        timeline: { assignedAt: new Date().toISOString() },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      inMemoryAssignments.unshift(mockCreated);
      return res.success(mockCreated, 'Assignment created (in-memory mode)', null, 201);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/assignments/:id
 * Retrieve single assignment
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDatabaseConnected()) {
      const assignment = await Assignment.findById(id)
        .populate('donationId')
        .populate('shelterId')
        .populate('riderId');

      if (!assignment) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Assignment '${id}' not found`, null, 404);
      }
      return res.success(assignment, 'Assignment details');
    }

    const found = inMemoryAssignments.find((a) => a.id === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Assignment '${id}' not found`, null, 404);
    }
    return res.success(found, 'Assignment details (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/assignments/:id/events
 * Retrieve event audit history for an assignment
 */
router.get('/:id/events', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDatabaseConnected()) {
      const events = await Event.find({ entityType: 'ASSIGNMENT', entityId: id })
        .populate('actorId', 'name email role')
        .sort({ createdAt: -1 });

      return res.success(events, 'Assignment event history', { count: events.length });
    }

    return res.success(
      [
        {
          id: `evt_mock_01`,
          entityType: 'ASSIGNMENT',
          entityId: id,
          eventType: 'ASSIGNMENT_CREATED',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          metadata: { note: 'Initial creation' }
        }
      ],
      'Assignment event history (mock mode)'
    );
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/assignments/:id/state
 * Enforces sequential state machine transitions, inventory return on cancel, and audit logging
 */
router.patch(
  '/:id/state',
  authenticate,
  requireRoles(ROLES.RIDER, ROLES.ADMIN, ROLES.SHELTER_MANAGER),
  validateBody(assignmentTransitionSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { targetStatus, reason, coordinates } = req.validatedBody;

      let assignment;
      let isDb = isDatabaseConnected();

      if (isDb) {
        assignment = await Assignment.findById(id);
      } else {
        assignment = inMemoryAssignments.find((a) => a.id === id);
      }

      if (!assignment) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Assignment '${id}' not found`, null, 404);
      }

      const previousStatus = assignment.status;

      // Validate the proposed state transition
      const validation = canTransitionAssignment(previousStatus, targetStatus);
      if (!validation.valid) {
        return res.fail(
          ERROR_CODES.INVALID_STATE_TRANSITION,
          validation.reason,
          { currentStatus: previousStatus, attemptedStatus: targetStatus },
          400
        );
      }

      const nowIso = new Date().toISOString();
      const timelineUpdates = { ...(assignment.timeline?.toJSON ? assignment.timeline.toJSON() : assignment.timeline) };

      if (targetStatus === ASSIGNMENT_STATUS.ACCEPTED) timelineUpdates.acceptedAt = nowIso;
      if (targetStatus === ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS) timelineUpdates.pickupStartedAt = nowIso;
      if (targetStatus === ASSIGNMENT_STATUS.PICKED_UP) timelineUpdates.pickedUpAt = nowIso;
      if (targetStatus === ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS) timelineUpdates.deliveryStartedAt = nowIso;
      if (targetStatus === ASSIGNMENT_STATUS.DELIVERED) timelineUpdates.deliveredAt = nowIso;
      if (targetStatus === ASSIGNMENT_STATUS.CANCELLED) {
        timelineUpdates.cancelledAt = nowIso;
        assignment.cancellationReason = reason || 'Cancelled by user or system';
      }

      assignment.status = targetStatus;
      assignment.timeline = timelineUpdates;
      assignment.updatedAt = nowIso;

      if (isDb) {
        await assignment.save();

        // Release or update associated rider and donation entities upon terminal transitions
        if (targetStatus === ASSIGNMENT_STATUS.DELIVERED) {
          if (assignment.riderId) {
            await Rider.findByIdAndUpdate(assignment.riderId, {
              $inc: { availableCapacity: assignment.allocatedQuantity },
              activeAssignmentId: null,
              status: 'AVAILABLE',
              isAvailable: true
            });
          }
          await Donation.findByIdAndUpdate(assignment.donationId, { status: 'DELIVERED' });
        } else if (targetStatus === ASSIGNMENT_STATUS.CANCELLED || targetStatus === ASSIGNMENT_STATUS.FAILED) {
          // Return allocated quantity back to donation
          await Donation.findByIdAndUpdate(assignment.donationId, {
            $inc: { availableQuantity: assignment.allocatedQuantity },
            status: 'AVAILABLE'
          });
          if (assignment.riderId) {
            await Rider.findByIdAndUpdate(assignment.riderId, {
              $inc: { availableCapacity: assignment.allocatedQuantity },
              activeAssignmentId: null,
              status: 'AVAILABLE',
              isAvailable: true
            });
          }
        }

        // Log Audit Event
        await Event.logEvent({
          entityType: 'ASSIGNMENT',
          entityId: assignment._id,
          eventType: 'STATE_TRANSITION',
          actorId: req.user.id,
          actorRole: req.user.role,
          metadata: {
            previousStatus,
            newStatus: targetStatus,
            reason: reason || null,
            coordinates: coordinates || null
          }
        });
      }

      broadcastEvent(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, {
        assignmentId: id,
        previousStatus,
        newStatus: targetStatus,
        updatedAt: nowIso,
        coordinates
      });

      return res.success(
        assignment,
        `Assignment transitioned from ${previousStatus} to ${targetStatus}`
      );
    } catch (err) {
      next(err);
    }
  }
);

export default router;
