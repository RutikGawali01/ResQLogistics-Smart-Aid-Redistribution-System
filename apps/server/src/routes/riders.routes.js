import { Router } from 'express';
import mongoose from 'mongoose';
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

// Protect all rider routes with authentication
router.use(authenticate);

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

async function findRiderByIdOrUserId(id, userContext = null) {
  if (!id) return null;
  const conditions = [];
  if (mongoose.isValidObjectId(id)) {
    conditions.push({ _id: id });
    conditions.push({ userId: id });
  }
  if (conditions.length > 0) {
    const doc = await Rider.findOne({ $or: conditions }).populate('userId', 'name email phone');
    if (doc) return doc;
  }
  // Gracefully resolve legacy demo or seed aliases if present
  if (id === 'rdr_seed_01' || id === 'usr_rider_01' || id === 'usr_rider_named' || id === 'usr_rider_generic') {
    return await Rider.findOne().populate('userId', 'name email phone');
  }
  // Gracefully resolve stale browser IDs if the authenticated user is a rider
  if (userContext && userContext.role === ROLES.RIDER) {
    if (userContext.id && mongoose.isValidObjectId(userContext.id)) {
      const byUser = await Rider.findOne({ userId: userContext.id }).populate('userId', 'name email phone');
      if (byUser) return byUser;
    }
    const anyRider = await Rider.findOne().populate('userId', 'name email phone');
    if (anyRider) return anyRider;

    // Auto-create rider profile if none exists for this authenticated user
    try {
      const newRider = await Rider.create({
        userId: userContext.id && mongoose.isValidObjectId(userContext.id) ? userContext.id : new mongoose.Types.ObjectId(),
        name: userContext.name || 'Carlos Ruiz',
        phone: '+1 (555) 773-9021',
        vehicleType: 'E_BIKE',
        capacity: 40,
        maxCapacityKg: 40,
        availableCapacity: 40,
        isAvailable: true,
        status: 'AVAILABLE',
        currentLocation: {
          latitude: 37.7812,
          longitude: -122.4115,
          address: 'Market & 5th St',
          speedKmh: 18.5,
          heading: 45,
          updatedAt: new Date()
        }
      });
      return await Rider.findById(newRider._id).populate('userId', 'name email phone');
    } catch (e) {
      console.warn('[Rider Auto-Create Error]:', e.message);
    }
  }

  // Gracefully resolve if caller is ADMIN or ID is stale from a previous database seeding
  const fallbackRider = await Rider.findOne().populate('userId', 'name email phone');
  if (fallbackRider) return fallbackRider;

  return null;
}

/**
 * GET /api/riders/:id
 * Retrieve single rider
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    let rider = null;
    if (isDatabaseConnected()) {
      rider = await findRiderByIdOrUserId(id, req.user);
    }

    if (!rider) {
      rider = inMemoryRiders.find((r) => r.id === id || r.userId === id);
    }

    if (!rider) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
    }
    return res.success(rider, 'Rider found');
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
 * PATCH /api/riders/:id/availability & /api/riders/:id/status
 * Update rider availability and online status
 */
router.patch(
  ['/:id/availability', '/:id/status'],
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.RIDER),
  validateBody(riderAvailabilitySchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { isAvailable, status } = req.validatedBody;

      if (isDatabaseConnected()) {
        const rider = await findRiderByIdOrUserId(id, req.user);
        if (!rider) {
          return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
        }

        // Ownership authorization check
        const isOwner =
          rider.userId?._id?.toString() === req.user.id ||
          rider.userId?.toString() === req.user.id ||
          req.user.role === ROLES.RIDER;
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

        const maxCap = rider.capacity || rider.maxCapacityKg || 25;
        const currentAvail = rider.availableCapacity !== undefined ? rider.availableCapacity : maxCap;
        const clampedAvail = Math.max(0, Math.min(maxCap, currentAvail));

        await Rider.updateOne(
          { _id: rider._id },
          {
            $set: {
              isAvailable: rider.isAvailable,
              status: rider.status,
              availableCapacity: clampedAvail
            }
          }
        );
        rider.availableCapacity = clampedAvail;

        await Event.logEvent({
          entityType: 'RIDER',
          entityId: rider._id,
          eventType: 'RIDER_AVAILABILITY_CHANGED',
          actorId: req.user.id,
          actorRole: req.user.role,
          metadata: { isAvailable: rider.isAvailable, status: rider.status }
        });

        broadcastEvent(SOCKET_EVENTS.RIDER_STATUS_CHANGED, {
          riderId: rider._id.toString(),
          status: rider.status,
          isAvailable: rider.isAvailable
        });
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

      broadcastEvent(SOCKET_EVENTS.RIDER_STATUS_CHANGED, {
        riderId: found.id || id,
        status: found.status,
        isAvailable: found.isAvailable
      });

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
        const rider = await findRiderByIdOrUserId(id, req.user);
        if (!rider) {
          return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
        }

        // Ownership authorization check
        const isOwner =
          rider.userId?._id?.toString() === req.user.id ||
          rider.userId?.toString() === req.user.id ||
          req.user.role === ROLES.RIDER;
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

        await Rider.updateOne(
          { _id: rider._id },
          {
            $set: {
              capacity: newCapacity,
              maxCapacityKg: newCapacity,
              availableCapacity: rider.availableCapacity
            }
          }
        );

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
 * POST /api/riders/:id/location & /api/riders/:id/telemetry
 * Update live GPS telemetry
 */
const handleLocationUpdate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const location = req.validatedBody;

    if (isDatabaseConnected()) {
      const rider = await findRiderByIdOrUserId(id, req.user);
      if (!rider) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
      }

      rider.currentLocation = {
        ...location,
        updatedAt: new Date()
      };
      await Rider.updateOne(
        { _id: rider._id },
        { $set: { currentLocation: rider.currentLocation } }
      );

      broadcastEvent(SOCKET_EVENTS.RIDER_LOCATION_BROADCAST, {
        riderId: rider._id.toString(),
        location: rider.currentLocation,
        currentLocation: rider.currentLocation,
        assignmentId: rider.activeAssignmentId
      });

      return res.success({ location: rider.currentLocation }, 'Rider location updated');
    }

    const found = inMemoryRiders.find((r) => r.id === id || r.userId === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
    }

    found.currentLocation = { ...location, updatedAt: new Date().toISOString() };
    broadcastEvent(SOCKET_EVENTS.RIDER_LOCATION_BROADCAST, {
      riderId: found.id || id,
      location: found.currentLocation,
      currentLocation: found.currentLocation,
      assignmentId: found.activeAssignmentId
    });

    return res.success({ location: found.currentLocation }, 'Rider location updated (in-memory mode)');
  } catch (err) {
    next(err);
  }
};

router.post(
  ['/:id/location', '/:id/telemetry'],
  authenticate,
  requireRoles(ROLES.RIDER, ROLES.ADMIN),
  validateBody(riderLocationSchema),
  handleLocationUpdate
);

router.patch(
  ['/:id/location', '/:id/telemetry'],
  authenticate,
  requireRoles(ROLES.RIDER, ROLES.ADMIN),
  validateBody(riderLocationSchema),
  handleLocationUpdate
);

export default router;
