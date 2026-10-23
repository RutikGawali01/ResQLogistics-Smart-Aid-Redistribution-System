import { Router } from 'express';
import { donationSchema, reservationSchema, ERROR_CODES, SOCKET_EVENTS } from '@aidflow/shared';
import { validateBody } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { Donation } from '../models/Donation.js';
import { Reservation } from '../models/Reservation.js';
import { isDatabaseConnected } from '../config/database.js';
import { broadcastEvent } from '../socket/index.js';

const router = Router();

// Fallback in-memory donations for offline development
const inMemoryDonations = [
  {
    id: 'don_seed_01',
    donorId: 'usr_donor_01',
    title: 'Surplus Fresh Produce & Bread',
    description: '3 crates of mixed seasonal vegetables and artisanal bakery loaves.',
    category: 'PRODUCE',
    quantity: 45,
    unit: 'kg',
    storageRequirement: 'ROOM_TEMPERATURE',
    expirationDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    pickupLocation: {
      address: '742 Evergreen Terrace',
      city: 'Springfield',
      latitude: 37.7749,
      longitude: -122.4194,
      contactName: 'Ned Flanders',
      contactPhone: '+1-555-0144'
    },
    status: 'AVAILABLE',
    allergens: ['Gluten'],
    createdAt: new Date().toISOString()
  }
];

/**
 * GET /api/donations
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, category } = req.query;

    if (isDatabaseConnected()) {
      const filter = {};
      if (status) filter.status = status;
      if (category) filter.category = category;
      const donations = await Donation.find(filter).sort({ createdAt: -1 });
      return res.success(donations, 'Donations retrieved successfully', { total: donations.length });
    }

    let results = [...inMemoryDonations];
    if (status) results = results.filter(d => d.status === status);
    if (category) results = results.filter(d => d.category === category);
    return res.success(results, 'Donations retrieved (in-memory mode)', { total: results.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/donations
 */
router.post('/', validateBody(donationSchema), async (req, res, next) => {
  try {
    const data = req.validatedBody;

    if (isDatabaseConnected()) {
      const created = await Donation.create(data);
      broadcastEvent(SOCKET_EVENTS.DONATION_CREATED, created);
      return res.success(created, 'Donation created successfully', null, 201);
    }

    const mockCreated = {
      ...data,
      id: `don_${Date.now()}`,
      status: data.status || 'AVAILABLE',
      createdAt: new Date().toISOString()
    };
    inMemoryDonations.unshift(mockCreated);
    broadcastEvent(SOCKET_EVENTS.DONATION_CREATED, mockCreated);
    return res.success(mockCreated, 'Donation created successfully (in-memory mode)', null, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/donations/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDatabaseConnected()) {
      const donation = await Donation.findById(id);
      if (!donation) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Donation with id '${id}' not found`, null, 404);
      }
      return res.success(donation, 'Donation found');
    }

    const found = inMemoryDonations.find(d => d.id === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Donation with id '${id}' not found`, null, 404);
    }
    return res.success(found, 'Donation found (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/donations/:id/reserve
 */
router.post('/:id/reserve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { shelterId, requestedQuantity } = req.body;

    if (!shelterId || !requestedQuantity) {
      return res.fail(ERROR_CODES.BAD_REQUEST, 'Missing required fields: shelterId, requestedQuantity');
    }

    if (isDatabaseConnected()) {
      const donation = await Donation.findById(id);
      if (!donation) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Donation '${id}' not found`, null, 404);
      }
      if (donation.status !== 'AVAILABLE') {
        return res.fail(ERROR_CODES.CONFLICT, `Donation is already in status '${donation.status}'`);
      }

      donation.status = 'RESERVED';
      await donation.save();

      const reservation = await Reservation.create({
        donationId: id,
        shelterId,
        reservedByUserId: req.user?.id || 'anonymous_manager',
        requestedQuantity,
        expiresAt: new Date(Date.now() + 3600000 * 3) // 3-hour hold
      });

      broadcastEvent(SOCKET_EVENTS.DONATION_RESERVED, { donation, reservation });
      return res.success({ donation, reservation }, 'Donation reserved successfully');
    }

    const found = inMemoryDonations.find(d => d.id === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Donation '${id}' not found`, null, 404);
    }
    found.status = 'RESERVED';

    const mockReservation = {
      id: `res_${Date.now()}`,
      donationId: id,
      shelterId,
      reservedByUserId: req.user?.id || 'demo_manager',
      requestedQuantity,
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() + 3600000 * 3).toISOString()
    };

    broadcastEvent(SOCKET_EVENTS.DONATION_RESERVED, { donation: found, reservation: mockReservation });
    return res.success({ donation: found, reservation: mockReservation }, 'Donation reserved (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

export default router;
