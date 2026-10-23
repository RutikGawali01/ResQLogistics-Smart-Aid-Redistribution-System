import { Router } from 'express';
import {
  riderSchema,
  riderLocationSchema,
  riderAvailabilitySchema,
  riderCapacitySchema,
  ERROR_CODES,
  SOCKET_EVENTS,
  ROLES
} from '@aidflow/shared';
import { validateBody } from '../middleware/validator.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { guardProtectedFields } from '../middleware/guardProtectedFields.js';
import { Rider } from '../models/Rider.js';
import { Event } from '../models/Event.js';
import { isDatabaseConnected } from '../config/database.js';
import { broadcastEvent } from '../socket/index.js';

const router = Router();

const inMemoryRiders = [
  {
    id: 'rdr_seed_01',
    userId: 'usr_rider_01',
    name: 'Carlos Ruiz',
    phone: '+1-555-0155',
    vehicleType: 'E_BIKE',
    capacity: 25,
    maxCapacityKg: 25,
    availableCapacity: 25,
    isAvailable: true,
    status: 'AVAILABLE',
    currentLocation: {
      latitude: 37.7790,
      longitude: -122.4100,
      heading: 90,
      speedKmh: 18,
      updatedAt: new Date().toISOString()
    },
    activeAssignmentId: null,
    createdAt: new Date().toISOString()
  }
];

/**
 * GET /api/riders
 * List riders with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, vehicleType, isAvailable, minCapacity } = req.query;

    if (isDatabaseConnected()) {
      const filter = {};
      if (status) filter.status = status;
      if (vehicleType) filter.vehicleType = vehicleType;
      if (isAvailable !== undefined) filter.isAvailable = isAvailable === 'true' || isAvailable === true;
      if (minCapacity) filter.availableCapacity = { $gte: Number(minCapacity) };

      const riders = await Rider.find(filter).populate('userId', 'name email phone');
      return res.success(riders, 'Riders retrieved successfully', { total: riders.length });
    }

    let results = [...inMemoryRiders];
    if (status) results = results.filter((r) => r.status === status);
    if (vehicleType) results = results.filter((r) => r.vehicleType === vehicleType);
    if (isAvailable !== undefined) results = results.filter((r) => String(r.isAvailable) === String(isAvailable));
    if (minCapacity) results = results.filter((r) => Number(r.availableCapacity || r.capacity) >= Number(minCapacity));

    return res.success(results, 'Riders retrieved (in-memory mode)', { total: results.length });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/riders/:id
 * Retrieve single rider
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDatabaseConnected()) {
      const rider = await Rider.findOne({
        $or: [{ _id: mongoose.isValidObjectId(id) ? id : null }, { userId: mongoose.isValidObjectId(id) ? id : null }]
      }).populate('userId', 'name email phone');

      if (!rider) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
      }
      return res.success(rider, 'Rider found');
    }

    const found = inMemoryRiders.find((r) => r.id === id || r.userId === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
    }
    return res.success(found, 'Rider found (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/riders/profile
 * Create or update rider profile
 */
router.post(
  '/profile',
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.RIDER),
  guardProtectedFields('availableCapacity'),
  validateBody(riderSchema),
  async (req, res, next) => {
    try {
      const data = req.validatedBody;
      const userId = req.user.role === ROLES.ADMIN && data.userId ? data.userId : req.user.id;
      const capacity = data.capacity || data.maxCapacityKg || 30;

      const riderPayload = {
        ...data,
        userId,
        capacity,
        maxCapacityKg: capacity,
        availableCapacity: capacity,
        isAvailable: data.isAvailable ?? true,
        status: data.status || 'AVAILABLE'
      };

      if (isDatabaseConnected()) {
        const existing = await Rider.findOne({ userId });
        if (existing) {
          Object.assign(existing, riderPayload);
          await existing.save();
          return res.success(existing, 'Rider profile updated');
        }

        const created = await Rider.create(riderPayload);

        await Event.logEvent({
          entityType: 'RIDER',
          entityId: created._id,
          eventType: 'RIDER_PROFILE_CREATED',
          actorId: req.user.id,
          actorRole: req.user.role,
          metadata: { userId, capacity }
        });

        return res.success(created, 'Rider profile created', null, 201);
      }

      const existingIndex = inMemoryRiders.findIndex((r) => r.userId === userId);
      if (existingIndex >= 0) {
        inMemoryRiders[existingIndex] = { ...inMemoryRiders[existingIndex], ...riderPayload };
        return res.success(inMemoryRiders[existingIndex], 'Rider profile updated (in-memory mode)');
      }

      const mockRider = {
        ...riderPayload,
        id: `rdr_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      inMemoryRiders.push(mockRider);
      return res.success(mockRider, 'Rider profile created (in-memory mode)', null, 201);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/riders/:id/availability
 * Update rider availability and online status
 */
router.patch(
  '/:id/availability',
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.RIDER),
  validateBody(riderAvailabilitySchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { isAvailable, status } = req.validatedBody;

      if (isDatabaseConnected()) {
        const rider = await Rider.findById(id);
        if (!rider) {
          return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
        }

        // Ownership authorization check
        const isOwner = rider.userId.toString() === req.user.id;
        const isAdmin = req.user.role === ROLES.ADMIN;
        if (!isOwner && !isAdmin) {
          return res.fail(ERROR_CODES.FORBIDDEN, 'Forbidden: You cannot change another rider availability', null, 403);
        }

        if (isAvailable !== undefined) {
          rider.isAvailable = isAvailable;
          rider.status = isAvailable ? 'AVAILABLE' : 'OFFLINE';
        }
        if (status) {
          rider.status = status;
          rider.isAvailable = status === 'AVAILABLE';
        }

        await rider.save();

        await Event.logEvent({
          entityType: 'RIDER',
          entityId: rider._id,
          eventType: 'RIDER_AVAILABILITY_CHANGED',
          actorId: req.user.id,
          actorRole: req.user.role,
          metadata: { isAvailable: rider.isAvailable, status: rider.status }
        });

        broadcastEvent(SOCKET_EVENTS.RIDER_STATUS_CHANGED, { riderId: id, status: rider.status, isAvailable: rider.isAvailable });
        return res.success(rider, 'Rider availability updated successfully');
      }

      const found = inMemoryRiders.find((r) => r.id === id || r.userId === id);
      if (!found) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
      }

      if (found.userId !== req.user.id && req.user.role !== ROLES.ADMIN) {
        return res.fail(ERROR_CODES.FORBIDDEN, 'Forbidden: Not authorized to update rider availability', null, 403);
      }

      if (isAvailable !== undefined) {
        found.isAvailable = isAvailable;
        found.status = isAvailable ? 'AVAILABLE' : 'OFFLINE';
      }
      if (status) {
        found.status = status;
        found.isAvailable = status === 'AVAILABLE';
      }

      return res.success(found, 'Rider availability updated (in-memory mode)');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/riders/:id/capacity
 * Update rider load capacity. Prevents direct setting of availableCapacity.
 */
router.patch(
  '/:id/capacity',
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.RIDER),
  guardProtectedFields('availableCapacity'),
  validateBody(riderCapacitySchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { capacity, maxCapacityKg } = req.validatedBody;
      const newCapacity = capacity || maxCapacityKg;

      if (isDatabaseConnected()) {
        const rider = await Rider.findById(id);
        if (!rider) {
          return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
        }

        // Ownership authorization check
        const isOwner = rider.userId.toString() === req.user.id;
        const isAdmin = req.user.role === ROLES.ADMIN;
        if (!isOwner && !isAdmin) {
          return res.fail(ERROR_CODES.FORBIDDEN, 'Forbidden: You cannot modify another rider capacity', null, 403);
        }

        const currentlyUsed = rider.capacity - rider.availableCapacity;
        if (newCapacity < currentlyUsed) {
          return res.fail(
            ERROR_CODES.VALIDATION_ERROR,
            `Cannot reduce capacity to ${newCapacity} kg. Rider is currently carrying ${currentlyUsed} kg in active dispatches.`,
            { newCapacity, currentlyUsed },
            422
          );
        }

        rider.capacity = newCapacity;
        rider.maxCapacityKg = newCapacity;
        rider.availableCapacity = newCapacity - currentlyUsed;

        await rider.save();

        await Event.logEvent({
          entityType: 'RIDER',
          entityId: rider._id,
          eventType: 'RIDER_CAPACITY_UPDATED',
          actorId: req.user.id,
          actorRole: req.user.role,
          metadata: { capacity: rider.capacity, availableCapacity: rider.availableCapacity }
        });

        return res.success(rider, 'Rider capacity updated successfully');
      }

      const found = inMemoryRiders.find((r) => r.id === id || r.userId === id);
      if (!found) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
      }

      if (found.userId !== req.user.id && req.user.role !== ROLES.ADMIN) {
        return res.fail(ERROR_CODES.FORBIDDEN, 'Forbidden: Not authorized to update rider capacity', null, 403);
      }

      const currentlyUsed = (found.capacity || found.maxCapacityKg || 25) - (found.availableCapacity || 25);
      found.capacity = newCapacity;
      found.maxCapacityKg = newCapacity;
      found.availableCapacity = Math.max(0, newCapacity - currentlyUsed);

      return res.success(found, 'Rider capacity updated (in-memory mode)');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/riders/:id/location
 * Update live GPS telemetry
 */
router.post(
  '/:id/location',
  authenticate,
  validateBody(riderLocationSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const location = req.validatedBody;

      if (isDatabaseConnected()) {
        const rider = await Rider.findById(id);
        if (!rider) {
          return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
        }

        rider.currentLocation = {
          ...location,
          updatedAt: new Date()
        };
        await rider.save();

        broadcastEvent(SOCKET_EVENTS.RIDER_LOCATION_BROADCAST, {
          riderId: id,
          location: rider.currentLocation,
          assignmentId: rider.activeAssignmentId
        });

        return res.success({ location: rider.currentLocation }, 'Rider location updated');
      }

      const found = inMemoryRiders.find((r) => r.id === id || r.userId === id);
      if (!found) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
      }

      found.currentLocation = { ...location, updatedAt: new Date().toISOString() };
      return res.success({ location: found.currentLocation }, 'Rider location updated (in-memory mode)');
    } catch (err) {
      next(err);
    }
  }
);

export default router;
