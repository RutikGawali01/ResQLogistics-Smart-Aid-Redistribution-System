import { Router } from 'express';
import {
  assignmentSchema,
  assignmentTransitionSchema,
  ASSIGNMENT_STATUS,
  canTransitionAssignment,
  ERROR_CODES,
  SOCKET_EVENTS
} from '@aidflow/shared';
import { validateBody } from '../middleware/validator.js';
import { Assignment } from '../models/Assignment.js';
import { isDatabaseConnected } from '../config/database.js';
import { broadcastEvent } from '../socket/index.js';

const router = Router();

const inMemoryAssignments = [
  {
    id: 'asg_seed_01',
    donationId: 'don_seed_01',
    shelterId: 'shl_seed_01',
    riderId: 'rdr_seed_01',
    status: ASSIGNMENT_STATUS.PENDING_ACCEPTANCE,
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
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, riderId, shelterId } = req.query;

    if (isDatabaseConnected()) {
      const filter = {};
      if (status) filter.status = status;
      if (riderId) filter.riderId = riderId;
      if (shelterId) filter.shelterId = shelterId;
      const assignments = await Assignment.find(filter).sort({ createdAt: -1 });
      return res.success(assignments, 'Assignments retrieved', { total: assignments.length });
    }

    let results = [...inMemoryAssignments];
    if (status) results = results.filter(a => a.status === status);
    if (riderId) results = results.filter(a => a.riderId === riderId);
    if (shelterId) results = results.filter(a => a.shelterId === shelterId);
    return res.success(results, 'Assignments retrieved (in-memory mode)', { total: results.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/assignments
 */
router.post('/', validateBody(assignmentSchema), async (req, res, next) => {
  try {
    const data = req.validatedBody;

    if (isDatabaseConnected()) {
      const created = await Assignment.create(data);
      broadcastEvent(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, created);
      return res.success(created, 'Assignment created', null, 201);
    }

    const mockCreated = {
      ...data,
      id: `asg_${Date.now()}`,
      status: data.status || ASSIGNMENT_STATUS.UNASSIGNED,
      timeline: {
        assignedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    inMemoryAssignments.unshift(mockCreated);
    broadcastEvent(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, mockCreated);
    return res.success(mockCreated, 'Assignment created (in-memory mode)', null, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/assignments/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDatabaseConnected()) {
      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Assignment '${id}' not found`, null, 404);
      }
      return res.success(assignment, 'Assignment details');
    }

    const found = inMemoryAssignments.find(a => a.id === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Assignment '${id}' not found`, null, 404);
    }
    return res.success(found, 'Assignment details (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/assignments/:id/state
 * Enforces valid state machine transitions
 */
router.patch('/:id/state', validateBody(assignmentTransitionSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetStatus, reason, coordinates } = req.validatedBody;

    let assignment;
    let isDb = isDatabaseConnected();

    if (isDb) {
      assignment = await Assignment.findById(id);
    } else {
      assignment = inMemoryAssignments.find(a => a.id === id);
    }

    if (!assignment) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Assignment '${id}' not found`, null, 404);
    }

    // Validate the proposed state transition
    const validation = canTransitionAssignment(assignment.status, targetStatus);
    if (!validation.valid) {
      return res.fail(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        validation.reason,
        {
          currentStatus: assignment.status,
          attemptedStatus: targetStatus
        },
        400
      );
    }

    const nowIso = new Date().toISOString();
    const timelineUpdates = { ...assignment.timeline };

    if (targetStatus === ASSIGNMENT_STATUS.ACCEPTED) timelineUpdates.acceptedAt = nowIso;
    if (targetStatus === ASSIGNMENT_STATUS.PICKED_UP) timelineUpdates.pickedUpAt = nowIso;
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
    }

    broadcastEvent(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, {
      assignmentId: id,
      previousStatus: assignment.status,
      newStatus: targetStatus,
      updatedAt: nowIso,
      coordinates
    });

    return res.success(
      assignment,
      `Assignment transitioned from ${assignment._originalStatus || 'previous'} to ${targetStatus}`
    );
  } catch (err) {
    next(err);
  }
});

export default router;
