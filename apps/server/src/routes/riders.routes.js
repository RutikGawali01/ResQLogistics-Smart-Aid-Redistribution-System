import { Router } from 'express';
import { riderSchema, riderLocationSchema, ERROR_CODES, SOCKET_EVENTS } from '@aidflow/shared';
import { validateBody } from '../middleware/validator.js';
import { Rider } from '../models/Rider.js';
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
    maxCapacityKg: 25,
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
  },
  {
    id: 'rdr_seed_02',
    userId: 'usr_rider_02',
    name: 'Maya Patel',
    phone: '+1-555-0166',
    vehicleType: 'VAN',
    maxCapacityKg: 400,
    status: 'AVAILABLE',
    currentLocation: {
      latitude: 37.7850,
      longitude: -122.4000,
      heading: 180,
      speedKmh: 25,
      updatedAt: new Date().toISOString()
    },
    activeAssignmentId: null,
    createdAt: new Date().toISOString()
  }
];

/**
 * GET /api/riders
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, vehicleType } = req.query;

    if (isDatabaseConnected()) {
      const filter = {};
      if (status) filter.status = status;
      if (vehicleType) filter.vehicleType = vehicleType;
      const riders = await Rider.find(filter);
      return res.success(riders, 'Riders retrieved successfully', { total: riders.length });
    }

    let results = [...inMemoryRiders];
    if (status) results = results.filter(r => r.status === status);
    if (vehicleType) results = results.filter(r => r.vehicleType === vehicleType);
    return res.success(results, 'Riders retrieved (in-memory mode)', { total: results.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/riders/profile
 */
router.post('/profile', validateBody(riderSchema), async (req, res, next) => {
  try {
    const data = req.validatedBody;

    if (isDatabaseConnected()) {
      const existing = await Rider.findOne({ userId: data.userId });
      if (existing) {
        Object.assign(existing, data);
        await existing.save();
        return res.success(existing, 'Rider profile updated');
      }
      const created = await Rider.create(data);
      return res.success(created, 'Rider profile created', null, 201);
    }

    const existingIndex = inMemoryRiders.findIndex(r => r.userId === data.userId);
    if (existingIndex >= 0) {
      inMemoryRiders[existingIndex] = { ...inMemoryRiders[existingIndex], ...data };
      return res.success(inMemoryRiders[existingIndex], 'Rider profile updated (in-memory mode)');
    }

    const mockRider = {
      ...data,
      id: `rdr_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    inMemoryRiders.push(mockRider);
    return res.success(mockRider, 'Rider profile created (in-memory mode)', null, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/riders/:id/status
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (isDatabaseConnected()) {
      const rider = await Rider.findById(id);
      if (!rider) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
      }
      rider.status = status;
      await rider.save();
      broadcastEvent(SOCKET_EVENTS.RIDER_STATUS_CHANGED, { riderId: id, status });
      return res.success(rider, 'Rider status updated');
    }

    const found = inMemoryRiders.find(r => r.id === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
    }
    found.status = status;
    broadcastEvent(SOCKET_EVENTS.RIDER_STATUS_CHANGED, { riderId: id, status });
    return res.success(found, 'Rider status updated (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/riders/:id/location
 */
router.post('/:id/location', validateBody(riderLocationSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const location = req.validatedBody;

    if (isDatabaseConnected()) {
      const rider = await Rider.findById(id);
      if (!rider) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
      }
      rider.currentLocation = location;
      await rider.save();

      broadcastEvent(SOCKET_EVENTS.RIDER_LOCATION_BROADCAST, {
        riderId: id,
        location,
        assignmentId: rider.activeAssignmentId
      });

      return res.success({ location }, 'Rider location updated');
    }

    const found = inMemoryRiders.find(r => r.id === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Rider '${id}' not found`, null, 404);
    }
    found.currentLocation = location;

    broadcastEvent(SOCKET_EVENTS.RIDER_LOCATION_BROADCAST, {
      riderId: id,
      location,
      assignmentId: found.activeAssignmentId
    });

    return res.success({ location }, 'Rider location updated (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

export default router;
