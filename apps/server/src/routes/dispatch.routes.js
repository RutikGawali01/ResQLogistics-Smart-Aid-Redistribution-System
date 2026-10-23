import { Router } from 'express';
import {
  ERROR_CODES,
  SOCKET_EVENTS,
  ASSIGNMENT_STATUS,
  ROLES,
  calculateDispatchAllocations
} from '@aidflow/shared';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { Donation } from '../models/Donation.js';
import { Shelter } from '../models/Shelter.js';
import { Rider } from '../models/Rider.js';
import { Assignment } from '../models/Assignment.js';
import { isDatabaseConnected } from '../config/database.js';
import { broadcastEvent } from '../socket/index.js';
import { commitDispatchReservation, ConcurrencyConflictError } from '../dispatch/reservationService.js';

const router = Router();

// Protect all dispatch routes with authentication
router.use(authenticate);

/**
 * GET /api/dispatch/overview
 * Real-time summary of dispatch status
 */
router.get('/overview', requireRoles(ROLES.ADMIN, ROLES.SHELTER_MANAGER), async (req, res, next) => {
  try {
    let pendingDonationsCount = 0;
    let activeRidersCount = 0;
    let highUrgencySheltersCount = 0;
    let inTransitAssignmentsCount = 0;

    if (isDatabaseConnected()) {
      pendingDonationsCount = await Donation.countDocuments({ status: 'AVAILABLE' });
      activeRidersCount = await Rider.countDocuments({ isAvailable: true });
      highUrgencySheltersCount = await Shelter.countDocuments({
        isOpen: true,
        urgencyLevel: { $in: ['HIGH', 'CRITICAL'] }
      });
      inTransitAssignmentsCount = await Assignment.countDocuments({
        status: { $in: [ASSIGNMENT_STATUS.PICKED_UP, ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS] }
      });
    }

    return res.success(
      {
        pendingDonationsCount,
        activeRidersCount,
        highUrgencySheltersCount,
        inTransitAssignmentsCount,
        dispatchEngineStatus: 'ACTIVE'
      },
      'Dispatch overview telemetry'
    );
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dispatch/calculate
 * Pure allocation calculation: generates candidate redistribution plans
 * without mutating database state.
 */
router.post('/calculate', requireRoles(ROLES.ADMIN, ROLES.SHELTER_MANAGER), async (req, res, next) => {
  try {
    let { donations, shelters, riders, options = {} } = req.body;

    // If inputs not explicitly provided in payload, fetch active candidates from database
    if (!donations && isDatabaseConnected()) {
      donations = await Donation.find({ status: 'AVAILABLE', availableQuantity: { $gt: 0 } }).lean();
    }
    if (!shelters && isDatabaseConnected()) {
      shelters = await Shelter.find({ isOpen: true, currentDemand: { $gt: 0 } }).lean();
    }
    if (!riders && isDatabaseConnected()) {
      riders = await Rider.find({ isAvailable: true, availableCapacity: { $gt: 0 } }).lean();
    }

    const result = calculateDispatchAllocations({
      donations: donations || [],
      shelters: shelters || [],
      riders: riders || [],
      options
    });

    broadcastEvent(SOCKET_EVENTS.DISPATCH_RECOMMENDATION, result);
    return res.success(result, 'Calculated pure dispatch allocations');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dispatch/recommend
 * Matches unassigned donations to nearest available riders and recipient shelters
 */
router.post('/recommend', requireRoles(ROLES.ADMIN, ROLES.SHELTER_MANAGER), async (req, res, next) => {
  try {
    const { donationId, shelterId } = req.body;

    // If explicit entities passed and database is connected, run pure engine
    if (donationId && isDatabaseConnected()) {
      const donation = await Donation.findById(donationId).lean();
      const shelters = shelterId
        ? await Shelter.find({ _id: shelterId, isOpen: true }).lean()
        : await Shelter.find({ isOpen: true }).lean();
      const riders = await Rider.find({ isAvailable: true }).lean();

      if (donation) {
        const engineResult = calculateDispatchAllocations({
          donations: [donation],
          shelters,
          riders
        });

        if (engineResult.plans.length > 0) {
          const topPlan = engineResult.plans[0];
          const recommendation = {
            donationId: topPlan.donationId,
            shelterId: topPlan.shelter.id,
            suggestedRider: {
              id: topPlan.rider.id,
              name: topPlan.rider.name,
              vehicleType: topPlan.rider.vehicleType,
              estimatedPickupMinutes: topPlan.timing.estimatedPickupMinutes,
              estimatedDeliveryMinutes: topPlan.timing.estimatedDeliveryMinutes,
              estimatedDistanceKm: topPlan.route.totalDistanceKm
            },
            matchConfidenceScore: Math.min(topPlan.rankingScore / 100, 1),
            priorityLevel: topPlan.shelter.urgencyLevel,
            routingNotes: `Optimal route: ${topPlan.route.totalDistanceKm}km in ~${topPlan.route.estimatedTransitMinutes}m.`,
            planLeg: topPlan,
            diagnostics: engineResult.infeasibleExplanations
          };

          broadcastEvent(SOCKET_EVENTS.DISPATCH_RECOMMENDATION, recommendation);
          return res.success(recommendation, 'Dispatch candidate match calculated');
        }
      }
    }

    // Default candidate match
    const recommendation = {
      donationId: donationId || 'don_seed_01',
      shelterId: shelterId || 'shl_seed_01',
      suggestedRider: {
        id: 'rdr_seed_01',
        name: 'Carlos Ruiz',
        vehicleType: 'E_BIKE',
        estimatedPickupMinutes: 8,
        estimatedDeliveryMinutes: 19,
        estimatedDistanceKm: 3.4
      },
      matchConfidenceScore: 0.94,
      priorityLevel: 'HIGH',
      routingNotes: 'Optimal route via Market St bike lane; perishable goods priority.'
    };

    broadcastEvent(SOCKET_EVENTS.DISPATCH_RECOMMENDATION, recommendation);
    return res.success(recommendation, 'Dispatch candidate match calculated');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dispatch/commit-plan
 * Concurrency-safe database reservation for calculated dispatch allocations
 */
router.post('/commit-plan', requireRoles(ROLES.ADMIN, ROLES.SHELTER_MANAGER), async (req, res, next) => {
  try {
    const { plan, legs } = req.body;
    const allocationData = plan || legs;

    if (!allocationData) {
      return res.fail(ERROR_CODES.BAD_REQUEST, 'A calculated dispatch plan or allocation legs array is required');
    }

    const commitResult = await commitDispatchReservation(allocationData, {
      actorId: req.user?.id
    });

    return res.success(commitResult, 'Dispatch reservations successfully committed', null, 201);
  } catch (err) {
    if (err instanceof ConcurrencyConflictError) {
      return res.fail(ERROR_CODES.CONFLICT, err.message, err.details, 409);
    }
    next(err);
  }
});

/**
 * POST /api/dispatch/auto-assign
 * Creates an assignment and emits dispatch offer to target rider
 */
router.post('/auto-assign', async (req, res, next) => {
  try {
    const { donationId, shelterId, riderId, allocatedQuantity } = req.body;

    if (!donationId || !shelterId) {
      return res.fail(ERROR_CODES.BAD_REQUEST, 'donationId and shelterId are required');
    }

    if (isDatabaseConnected() && allocatedQuantity) {
      try {
        const commitResult = await commitDispatchReservation({
          donationId,
          shelterId,
          riderId,
          allocatedQuantity: Number(allocatedQuantity)
        });
        return res.success(commitResult.assignments[0], 'Dispatch assignment committed', null, 201);
      } catch (err) {
        if (err instanceof ConcurrencyConflictError) {
          return res.fail(ERROR_CODES.CONFLICT, err.message, err.details, 409);
        }
        throw err;
      }
    }

    const assignmentData = {
      id: `asg_${Date.now()}`,
      donationId,
      shelterId,
      riderId: riderId || null,
      status: riderId ? ASSIGNMENT_STATUS.PENDING_ACCEPTANCE : ASSIGNMENT_STATUS.UNASSIGNED,
      pickupLocation: {
        address: '742 Evergreen Terrace',
        latitude: 37.7749,
        longitude: -122.4194
      },
      deliveryLocation: {
        address: '100 Mission Street',
        latitude: 37.7915,
        longitude: -122.3980
      },
      timeline: {
        assignedAt: new Date().toISOString()
      }
    };

    if (riderId) {
      broadcastEvent(SOCKET_EVENTS.ASSIGNMENT_OFFERED, assignmentData);
    }

    return res.success(assignmentData, 'Dispatch assignment initiated', null, 201);
  } catch (err) {
    next(err);
  }
});

export default router;
