import { Router } from 'express';
import mongoose from 'mongoose';
import {
  shelterSchema,
  shelterDemandSchema,
  shelterStatusSchema,
  ERROR_CODES,
  SOCKET_EVENTS,
  ROLES
} from '@aidflow/shared';
import { validateBody } from '../middleware/validator.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { Shelter } from '../models/Shelter.js';
import { Event } from '../models/Event.js';
import { isDatabaseConnected } from '../config/database.js';
import { broadcastEvent } from '../socket/index.js';
import { handleShelterClosureOrFull } from '../../../worker/src/recovery/failureRecoveryService.js';

const router = Router();

// Protect all shelter routes with authentication
router.use(authenticate);

const inMemoryShelters = [
  {
    id: 'shl_seed_01',
    name: 'Downtown Hope Refuge',
    managerId: 'usr_shelter_01',
    address: '100 Mission Street, San Francisco, CA',
    location: {
      address: '100 Mission Street, San Francisco, CA',
      latitude: 37.7915,
      longitude: -122.3980
    },
    currentDemand: 150,
    receivingCapacity: 100,
    availableResources: ['REFRIGERATION', 'HOT_KITCHEN', 'DRY_STORAGE'],
    isOpen: true,
    capacity: {
      currentOccupancy: 85,
      maxCapacity: 100,
      mealsNeededPerDay: 150
    },
    urgencyLevel: 'HIGH',
    acceptedCategories: ['PERISHABLE', 'PREPARED_MEALS', 'BAKERY', 'PRODUCE'],
    contactPhone: '+1-555-0188',
    operatingHours: '24/7',
    active: true,
    createdAt: new Date().toISOString()
  }
];

/**
 * GET /api/shelters
 * List shelters with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const { urgency, isOpen, minDemand } = req.query;

    if (isDatabaseConnected()) {
      const filter = {};
      if (urgency) filter.urgencyLevel = urgency;
      if (isOpen !== undefined) filter.isOpen = isOpen === 'true' || isOpen === true;
      if (minDemand) filter.currentDemand = { $gte: Number(minDemand) };

      const shelters = await Shelter.find(filter);
      return res.success(shelters, 'Shelters retrieved successfully', { total: shelters.length });
    }

    let results = [...inMemoryShelters];
    if (urgency) results = results.filter((s) => s.urgencyLevel === urgency);
    if (isOpen !== undefined) results = results.filter((s) => String(s.isOpen) === String(isOpen));
    if (minDemand) results = results.filter((s) => (s.currentDemand || 0) >= Number(minDemand));

    return res.success(results, 'Shelters retrieved (in-memory mode)', { total: results.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/shelters
 * Register new shelter
 */
router.post(
  '/',
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.SHELTER_MANAGER),
  validateBody(shelterSchema),
  async (req, res, next) => {
    try {
      const data = req.validatedBody;
      const managerId = req.user.role === ROLES.ADMIN && data.managerId ? data.managerId : req.user.id;

      const shelterPayload = {
        ...data,
        managerId,
        currentDemand: data.currentDemand ?? data.capacity?.mealsNeededPerDay ?? 0,
        receivingCapacity: data.receivingCapacity ?? data.capacity?.maxCapacity ?? 100,
        isOpen: data.isOpen ?? data.active ?? true
      };

      if (isDatabaseConnected()) {
        const created = await Shelter.create(shelterPayload);

        await Event.logEvent({
          entityType: 'SHELTER',
          entityId: created._id,
          eventType: 'SHELTER_CREATED',
          actorId: req.user.id,
          actorRole: req.user.role,
          metadata: { name: created.name, managerId }
        });

        return res.success(created, 'Shelter registered successfully', null, 201);
      }

      const mockCreated = {
        ...shelterPayload,
        id: `shl_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      inMemoryShelters.push(mockCreated);
      return res.success(mockCreated, 'Shelter registered (in-memory mode)', null, 201);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/shelters/:id
 * Retrieve single shelter
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDatabaseConnected()) {
      let shelter = null;
      if (mongoose.isValidObjectId(id)) {
        shelter = await Shelter.findById(id).populate('managerId', 'name email phone');
      } else if (id.startsWith('shl_')) {
        shelter = await Shelter.findOne().populate('managerId', 'name email phone');
      }
      if (!shelter) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
      }
      return res.success(shelter, 'Shelter found');
    }

    const found = inMemoryShelters.find((s) => s.id === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
    }
    return res.success(found, 'Shelter found (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/shelters/:id/demand
 * Update shelter currentDemand and receivingCapacity
 */
router.patch(
  '/:id/demand',
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.SHELTER_MANAGER),
  validateBody(shelterDemandSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { currentDemand, receivingCapacity, mealsNeededPerDay } = req.validatedBody;

      if (isDatabaseConnected()) {
        const shelter = await Shelter.findById(id);
        if (!shelter) {
          return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
        }

        // Ownership authorization check
        const isManager = shelter.managerId.toString() === req.user.id;
        const isAdmin = req.user.role === ROLES.ADMIN;
        if (!isManager && !isAdmin) {
          return res.fail(
            ERROR_CODES.FORBIDDEN,
            'Forbidden: Only the designated shelter manager or platform admin can update demand',
            null,
            403
          );
        }

        if (currentDemand !== undefined) {
          shelter.currentDemand = currentDemand;
          if (shelter.capacity) shelter.capacity.mealsNeededPerDay = currentDemand;
        }
        if (mealsNeededPerDay !== undefined) {
          shelter.currentDemand = mealsNeededPerDay;
          if (shelter.capacity) shelter.capacity.mealsNeededPerDay = mealsNeededPerDay;
        }
        if (receivingCapacity !== undefined) {
          shelter.receivingCapacity = receivingCapacity;
          if (shelter.capacity) shelter.capacity.maxCapacity = receivingCapacity;
        }

        await shelter.save();

        if (receivingCapacity === 0) {
          try {
            await handleShelterClosureOrFull({ shelterId: shelter._id });
          } catch (recErr) {
            console.warn('[Shelter Route] Note on capacity recovery:', recErr.message);
          }
        }

        await Event.logEvent({
          entityType: 'SHELTER',
          entityId: shelter._id,
          eventType: 'SHELTER_DEMAND_UPDATED',
          actorId: req.user.id,
          actorRole: req.user.role,
          metadata: { currentDemand: shelter.currentDemand, receivingCapacity: shelter.receivingCapacity }
        });

        broadcastEvent(SOCKET_EVENTS.SHELTER_CAPACITY_UPDATED, shelter);
        return res.success(shelter, 'Shelter demand updated successfully');
      }

      const found = inMemoryShelters.find((s) => s.id === id);
      if (!found) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
      }

      if (found.managerId !== req.user.id && req.user.role !== ROLES.ADMIN) {
        return res.fail(ERROR_CODES.FORBIDDEN, 'Forbidden: Not authorized to update shelter demand', null, 403);
      }

      if (currentDemand !== undefined) found.currentDemand = currentDemand;
      if (receivingCapacity !== undefined) found.receivingCapacity = receivingCapacity;

      return res.success(found, 'Shelter demand updated (in-memory mode)');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/shelters/:id/status
 * Update shelter isOpen status and urgencyLevel
 */
router.patch(
  '/:id/status',
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.SHELTER_MANAGER),
  validateBody(shelterStatusSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { isOpen, urgencyLevel } = req.validatedBody;

      if (isDatabaseConnected()) {
        const shelter = await Shelter.findById(id);
        if (!shelter) {
          return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
        }

        // Ownership authorization check
        const isManager = shelter.managerId.toString() === req.user.id;
        const isAdmin = req.user.role === ROLES.ADMIN;
        if (!isManager && !isAdmin) {
          return res.fail(
            ERROR_CODES.FORBIDDEN,
            'Forbidden: Only the designated shelter manager or platform admin can update shelter status',
            null,
            403
          );
        }

        if (isOpen !== undefined) {
          shelter.isOpen = isOpen;
          shelter.active = isOpen;
        }
        if (urgencyLevel) shelter.urgencyLevel = urgencyLevel;

        await shelter.save();

        if (isOpen === false) {
          try {
            await handleShelterClosureOrFull({ shelterId: shelter._id });
          } catch (recErr) {
            console.warn('[Shelter Route] Note on closure recovery:', recErr.message);
          }
        }

        await Event.logEvent({
          entityType: 'SHELTER',
          entityId: shelter._id,
          eventType: 'SHELTER_STATUS_UPDATED',
          actorId: req.user.id,
          actorRole: req.user.role,
          metadata: { isOpen: shelter.isOpen, urgencyLevel: shelter.urgencyLevel }
        });

        broadcastEvent(SOCKET_EVENTS.SHELTER_CAPACITY_UPDATED, shelter);
        return res.success(shelter, 'Shelter status updated successfully');
      }

      const found = inMemoryShelters.find((s) => s.id === id);
      if (!found) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
      }

      if (found.managerId !== req.user.id && req.user.role !== ROLES.ADMIN) {
        return res.fail(ERROR_CODES.FORBIDDEN, 'Forbidden: Not authorized to update shelter status', null, 403);
      }

      if (isOpen !== undefined) found.isOpen = isOpen;
      if (urgencyLevel) found.urgencyLevel = urgencyLevel;

      return res.success(found, 'Shelter status updated (in-memory mode)');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/shelters/:id/capacity (Legacy / Compatibility)
 */
router.patch('/:id/capacity', requireRoles(ROLES.SHELTER_MANAGER, ROLES.ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { currentOccupancy, urgencyLevel, mealsNeededPerDay, maxCapacity } = req.body;

    if (isDatabaseConnected()) {
      const shelter = await Shelter.findById(id);
      if (!shelter) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
      }

      if (currentOccupancy !== undefined) shelter.capacity.currentOccupancy = Number(currentOccupancy);
      if (maxCapacity !== undefined) shelter.capacity.maxCapacity = Number(maxCapacity);
      if (mealsNeededPerDay !== undefined) {
        shelter.capacity.mealsNeededPerDay = Number(mealsNeededPerDay);
        shelter.currentDemand = Number(mealsNeededPerDay);
      }
      if (urgencyLevel) shelter.urgencyLevel = urgencyLevel;

      await shelter.save();
      broadcastEvent(SOCKET_EVENTS.SHELTER_CAPACITY_UPDATED, shelter);
      return res.success(shelter, 'Shelter capacity updated');
    }

    const found = inMemoryShelters.find((s) => s.id === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
    }

    if (currentOccupancy !== undefined) found.capacity.currentOccupancy = Number(currentOccupancy);
    if (maxCapacity !== undefined) found.capacity.maxCapacity = Number(maxCapacity);
    if (mealsNeededPerDay !== undefined) {
      found.capacity.mealsNeededPerDay = Number(mealsNeededPerDay);
      found.currentDemand = Number(mealsNeededPerDay);
    }
    if (urgencyLevel) found.urgencyLevel = urgencyLevel;

    return res.success(found, 'Shelter capacity updated (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/shelters/:id/urgency
 */
router.patch('/:id/urgency', requireRoles(ROLES.SHELTER_MANAGER, ROLES.ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { urgencyLevel } = req.body;
    if (!urgencyLevel) {
      return res.fail(ERROR_CODES.BAD_REQUEST, 'urgencyLevel is required', null, 400);
    }

    if (isDatabaseConnected()) {
      const shelter = await Shelter.findById(id);
      if (!shelter) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
      }
      shelter.urgencyLevel = urgencyLevel;
      await shelter.save();
      broadcastEvent(SOCKET_EVENTS.SHELTER_CAPACITY_UPDATED, shelter);
      return res.success(shelter, 'Shelter urgency updated');
    }

    const found = inMemoryShelters.find((s) => s.id === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
    }
    found.urgencyLevel = urgencyLevel;
    return res.success(found, 'Shelter urgency updated (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

export default router;
