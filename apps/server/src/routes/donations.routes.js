import { Router } from 'express';
import mongoose from 'mongoose';
import {
  donationSchema,
  donationUpdateSchema,
  reservationSchema,
  ERROR_CODES,
  SOCKET_EVENTS,
  ROLES
} from '@aidflow/shared';
import { validateBody } from '../middleware/validator.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { guardProtectedFields } from '../middleware/guardProtectedFields.js';
import { Donation } from '../models/Donation.js';
import { Reservation } from '../models/Reservation.js';
import { Event } from '../models/Event.js';
import { isDatabaseConnected } from '../config/database.js';
import { broadcastEvent } from '../socket/index.js';

const router = Router();

// Protect all donation routes with authentication
router.use(authenticate);

// Fallback in-memory donations for disconnected development
const inMemoryDonations = [
  {
    id: 'don_seed_01',
    donorId: 'usr_donor_01',
    title: 'Surplus Fresh Produce & Bread',
    description: '3 crates of mixed seasonal vegetables and artisanal bakery loaves.',
    aidType: 'PRODUCE',
    category: 'PRODUCE',
    quantity: 45,
    availableQuantity: 45,
    unit: 'kg',
    handlingRequirements: 'ROOM_TEMPERATURE',
    storageRequirement: 'ROOM_TEMPERATURE',
    safeUseDeadline: new Date(Date.now() + 86400000 * 2).toISOString(),
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
 * List donations with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, aidType, category, donorId, minQuantity } = req.query;

    if (isDatabaseConnected()) {
      const filter = {};
      if (status) filter.status = status;
      if (aidType || category) filter.$or = [{ aidType: aidType || category }, { category: aidType || category }];
      if (donorId) filter.donorId = donorId;
      if (minQuantity) filter.availableQuantity = { $gte: Number(minQuantity) };

      const donations = await Donation.find(filter).sort({ createdAt: -1 });
      return res.success(donations, 'Donations retrieved successfully', { total: donations.length });
    }

    let results = [...inMemoryDonations];
    if (status) results = results.filter((d) => d.status === status);
    if (aidType || category) {
      const type = aidType || category;
      results = results.filter((d) => d.aidType === type || d.category === type);
    }
    if (donorId) results = results.filter((d) => String(d.donorId) === String(donorId));
    if (minQuantity) results = results.filter((d) => Number(d.availableQuantity || d.quantity) >= Number(minQuantity));

    return res.success(results, 'Donations retrieved (in-memory mode)', { total: results.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/donations
 * Create donation. Enforces authentication, donor/admin role, and prevents setting protected fields directly.
 */
router.post(
  '/',
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.DONOR),
  guardProtectedFields('availableQuantity', 'allocatedQuantity'),
  validateBody(donationSchema),
  async (req, res, next) => {
    try {
      const data = req.validatedBody;

      // Assign donorId from authenticated session unless Admin explicitly provides another
      const donorId = req.user.role === ROLES.ADMIN && data.donorId ? data.donorId : req.user.id;
      const aidType = data.aidType || data.category;
      const safeUseDeadline = data.safeUseDeadline || data.expirationDate;
      const handlingRequirements = data.handlingRequirements || data.storageRequirement || 'ROOM_TEMPERATURE';

      const donationPayload = {
        ...data,
        donorId,
        aidType,
        category: aidType,
        safeUseDeadline,
        expirationDate: safeUseDeadline,
        handlingRequirements,
        storageRequirement: handlingRequirements,
        availableQuantity: data.quantity, // Initial availableQuantity equals total quantity
        status: data.status || 'AVAILABLE'
      };

      if (isDatabaseConnected()) {
        const created = await Donation.create(donationPayload);

        // Audit Event
        await Event.logEvent({
          entityType: 'DONATION',
          entityId: created._id,
          eventType: 'DONATION_CREATED',
          actorId: req.user.id,
          actorRole: req.user.role,
          metadata: {
            quantity: created.quantity,
            aidType: created.aidType,
            unit: created.unit
          }
        });

        broadcastEvent(SOCKET_EVENTS.DONATION_CREATED, created);
        return res.success(created, 'Donation created successfully', null, 201);
      }

      const mockCreated = {
        ...donationPayload,
        id: `don_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      inMemoryDonations.unshift(mockCreated);
      broadcastEvent(SOCKET_EVENTS.DONATION_CREATED, mockCreated);
      return res.success(mockCreated, 'Donation created successfully (in-memory mode)', null, 201);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/donations/:id
 * Retrieve a single donation
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isDatabaseConnected()) {
      let donation = null;
      if (mongoose.isValidObjectId(id)) {
        donation = await Donation.findById(id).populate('donorId', 'name email organization');
      } else if (id.startsWith('don_') || id.startsWith('pkg_')) {
        donation = await Donation.findOne().populate('donorId', 'name email organization');
      }
      if (!donation) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Donation with id '${id}' not found`, null, 404);
      }
      return res.success(donation, 'Donation found');
    }

    const found = inMemoryDonations.find((d) => d.id === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Donation with id '${id}' not found`, null, 404);
    }
    return res.success(found, 'Donation found (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/donations/:id
 * Update donation. Enforces authentication, ownership authorization, and protects allocated/available quantities.
 */
router.patch(
  '/:id',
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.DONOR),
  guardProtectedFields('availableQuantity', 'allocatedQuantity', 'donorId', 'id', '_id'),
  validateBody(donationUpdateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.validatedBody;

      if (isDatabaseConnected()) {
        const donation = await Donation.findById(id);
        if (!donation) {
          return res.fail(ERROR_CODES.NOT_FOUND, `Donation '${id}' not found`, null, 404);
        }

        // Ownership authorization check
        const isOwner = donation.donorId.toString() === req.user.id;
        const isAdmin = req.user.role === ROLES.ADMIN;
        if (!isOwner && !isAdmin) {
          return res.fail(
            ERROR_CODES.FORBIDDEN,
            'Forbidden: You are not authorized to modify donations owned by another donor',
            null,
            403
          );
        }

        // Quantity integrity validation
        if (updates.quantity !== undefined) {
          const currentAllocated = donation.quantity - donation.availableQuantity;
          if (updates.quantity < currentAllocated) {
            return res.fail(
              ERROR_CODES.VALIDATION_ERROR,
              `Cannot reduce total quantity to ${updates.quantity}. ${currentAllocated} items are already allocated or reserved.`,
              { requestedQuantity: updates.quantity, currentAllocated },
              422
            );
          }
          donation.availableQuantity = updates.quantity - currentAllocated;
          donation.quantity = updates.quantity;
        }

        // Apply remaining updates
        if (updates.title) donation.title = updates.title;
        if (updates.description !== undefined) donation.description = updates.description;
        if (updates.aidType || updates.category) {
          const type = updates.aidType || updates.category;
          donation.aidType = type;
          donation.category = type;
        }
        if (updates.unit) donation.unit = updates.unit;
        if (updates.safeUseDeadline || updates.expirationDate) {
          const deadline = updates.safeUseDeadline || updates.expirationDate;
          donation.safeUseDeadline = deadline;
          donation.expirationDate = deadline;
        }
        if (updates.handlingRequirements || updates.storageRequirement) {
          const handling = updates.handlingRequirements || updates.storageRequirement;
          donation.handlingRequirements = handling;
          donation.storageRequirement = handling;
        }
        if (updates.pickupLocation) donation.pickupLocation = updates.pickupLocation;
        if (updates.status) donation.status = updates.status;
        if (updates.allergens) donation.allergens = updates.allergens;
        if (updates.specialInstructions !== undefined) donation.specialInstructions = updates.specialInstructions;

        await donation.save();

        // Audit Event
        await Event.logEvent({
          entityType: 'DONATION',
          entityId: donation._id,
          eventType: 'DONATION_UPDATED',
          actorId: req.user.id,
          actorRole: req.user.role,
          metadata: { updatedFields: Object.keys(updates) }
        });

        broadcastEvent(SOCKET_EVENTS.DONATION_UPDATED, donation);
        return res.success(donation, 'Donation updated successfully');
      }

      // In-memory fallback
      const found = inMemoryDonations.find((d) => d.id === id);
      if (!found) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Donation '${id}' not found`, null, 404);
      }

      if (found.donorId !== req.user.id && req.user.role !== ROLES.ADMIN) {
        return res.fail(
          ERROR_CODES.FORBIDDEN,
          'Forbidden: You are not authorized to modify donations owned by another donor',
          null,
          403
        );
      }

      if (updates.quantity !== undefined) {
        const currentAllocated = found.quantity - (found.availableQuantity ?? found.quantity);
        if (updates.quantity < currentAllocated) {
          return res.fail(
            ERROR_CODES.VALIDATION_ERROR,
            `Cannot reduce quantity below allocated amount (${currentAllocated})`,
            null,
            422
          );
        }
        found.availableQuantity = updates.quantity - currentAllocated;
        found.quantity = updates.quantity;
      }

      Object.assign(found, updates);
      return res.success(found, 'Donation updated (in-memory mode)');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/donations/:id/reserve
 * Reserve surplus aid for a shelter
 */
router.post(
  '/:id/reserve',
  authenticate,
  requireRoles(ROLES.SHELTER_MANAGER, ROLES.ADMIN),
  async (req, res, next) => {
  try {
    const { id } = req.params;
    const { shelterId, requestedQuantity, quantity } = req.body;
    const qty = Number(requestedQuantity || quantity);

    if (!shelterId || !qty || qty <= 0) {
      return res.fail(
        ERROR_CODES.BAD_REQUEST,
        'Missing or invalid fields: shelterId and positive requestedQuantity are required'
      );
    }

    if (isDatabaseConnected()) {
      const donation = await Donation.findById(id);
      if (!donation) {
        return res.fail(ERROR_CODES.NOT_FOUND, `Donation '${id}' not found`, null, 404);
      }

      if (donation.availableQuantity < qty) {
        return res.fail(
          ERROR_CODES.CONFLICT,
          `Insufficient available quantity. Requested: ${qty}, Available: ${donation.availableQuantity}`,
          { availableQuantity: donation.availableQuantity, requestedQuantity: qty },
          409
        );
      }

      donation.availableQuantity -= qty;
      if (donation.availableQuantity === 0) {
        donation.status = 'RESERVED';
      }
      await donation.save();

      const reservation = await Reservation.create({
        donationId: id,
        shelterId,
        reservedByUserId: req.user?.id || donation.donorId,
        quantity: qty,
        requestedQuantity: qty,
        status: 'CONFIRMED',
        expiresAt: new Date(Date.now() + 3600000 * 3) // 3-hour reservation hold
      });

      // Audit Event
      await Event.logEvent({
        entityType: 'RESERVATION',
        entityId: reservation._id,
        eventType: 'RESERVATION_CREATED',
        actorId: req.user?.id,
        actorRole: req.user?.role,
        metadata: { donationId: id, shelterId, quantity: qty }
      });

      broadcastEvent(SOCKET_EVENTS.DONATION_RESERVED, { donation, reservation });
      return res.success({ donation, reservation }, 'Donation reserved successfully', null, 201);
    }

    const found = inMemoryDonations.find((d) => d.id === id);
    if (!found) {
      return res.fail(ERROR_CODES.NOT_FOUND, `Donation '${id}' not found`, null, 404);
    }

    found.availableQuantity = Math.max(0, (found.availableQuantity || found.quantity) - qty);
    if (found.availableQuantity === 0) found.status = 'RESERVED';

    const mockReservation = {
      id: `res_${Date.now()}`,
      donationId: id,
      shelterId,
      reservedByUserId: req.user?.id || 'demo_manager',
      quantity: qty,
      requestedQuantity: qty,
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() + 3600000 * 3).toISOString()
    };

    return res.success({ donation: found, reservation: mockReservation }, 'Donation reserved (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

export default router;
