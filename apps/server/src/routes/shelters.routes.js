import { Router } from 'express';
import { shelterSchema, ERROR_CODES, SOCKET_EVENTS, ROLES } from '@aidflow/shared';
import { validateBody } from '../middleware/validator.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { Shelter } from '../models/Shelter.js';
import { isDatabaseConnected } from '../config/database.js';
import { broadcastEvent } from '../socket/index.js';

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
      latitude: 37.7915,
      longitude: -122.3980
    },
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
  },
  {
    id: 'shl_seed_02',
    name: 'St. Jude Community Center',
    managerId: 'usr_shelter_02',
    address: '450 Castro Street, San Francisco, CA',
    location: {
      latitude: 37.7609,
      longitude: -122.4350
    },
    capacity: {
      currentOccupancy: 30,
      maxCapacity: 60,
      mealsNeededPerDay: 80
    },
    urgencyLevel: 'MEDIUM',
    acceptedCategories: ['NON_PERISHABLE', 'CLOTHING', 'HYGIENE'],
    contactPhone: '+1-555-0177',
    operatingHours: '08:00 - 20:00',
    active: true,
    createdAt: new Date().toISOString()
  }
];

/**
 * GET /api/shelters
 */
router.get('/', async (req, res, next) => {
  try {
    const { urgency } = req.query;

    if (isDatabaseConnected()) {
      const filter = { active: true };
      if (urgency) filter.urgencyLevel = urgency;
      const shelters = await Shelter.find(filter);
      return res.success(shelters, 'Shelters retrieved successfully', { total: shelters.length });
    }

    let results = [...inMemoryShelters];
    if (urgency) results = results.filter(s => s.urgencyLevel === urgency);
    return res.success(results, 'Shelters retrieved (in-memory mode)', { total: results.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/shelters
 */
router.post('/', requireRoles(ROLES.SHELTER_MANAGER, ROLES.ADMIN), validateBody(shelterSchema), async (req, res, next) => {
  try {
    const data = req.validatedBody;

    if (isDatabaseConnected()) {
      const created = await Shelter.create(data);
      return res.success(created, 'Shelter registered successfully', null, 201);
    }

    const mockCreated = {
      ...data,
      id: `shl_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    inMemoryShelters.push(mockCreated);
    return res.success(mockCreated, 'Shelter registered (in-memory mode)', null, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/shelters/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDatabaseConnected()) {
      const shelter = await Shelter.findById(id);
      if (!shelter) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
      }
      return res.success(shelter, 'Shelter found');
    }

    const found = inMemoryShelters.find(s => s.id === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
    }
    return res.success(found, 'Shelter found (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/shelters/:id/capacity
 */
router.patch('/:id/capacity', requireRoles(ROLES.SHELTER_MANAGER, ROLES.ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { currentOccupancy, urgencyLevel, mealsNeededPerDay } = req.body;

    if (isDatabaseConnected()) {
      const shelter = await Shelter.findById(id);
      if (!shelter) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
      }

      if (currentOccupancy !== undefined) shelter.capacity.currentOccupancy = currentOccupancy;
      if (mealsNeededPerDay !== undefined) shelter.capacity.mealsNeededPerDay = mealsNeededPerDay;
      if (urgencyLevel) shelter.urgencyLevel = urgencyLevel;

      await shelter.save();
      broadcastEvent(SOCKET_EVENTS.SHELTER_CAPACITY_UPDATED, shelter);
      return res.success(shelter, 'Shelter capacity updated');
    }

    const found = inMemoryShelters.find(s => s.id === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Shelter '${id}' not found`, null, 404);
    }

    if (currentOccupancy !== undefined) found.capacity.currentOccupancy = currentOccupancy;
    if (mealsNeededPerDay !== undefined) found.capacity.mealsNeededPerDay = mealsNeededPerDay;
    if (urgencyLevel) found.urgencyLevel = urgencyLevel;

    broadcastEvent(SOCKET_EVENTS.SHELTER_CAPACITY_UPDATED, found);
    return res.success(found, 'Shelter capacity updated (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

export default router;
