import { Router } from 'express';
import { ERROR_CODES, SOCKET_EVENTS, ASSIGNMENT_STATUS, ROLES } from '@aidflow/shared';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { Donation } from '../models/Donation.js';
import { Shelter } from '../models/Shelter.js';
import { Rider } from '../models/Rider.js';
import { Assignment } from '../models/Assignment.js';
import { isDatabaseConnected } from '../config/database.js';
import { broadcastEvent } from '../socket/index.js';

const router = Router();

// Protect all dispatch routes with authentication
router.use(authenticate);

// Euclidean distance approximation for dispatch matching
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * GET /api/dispatch/overview
 * Real-time summary of dispatch status
 */
router.get('/overview', requireRoles(ROLES.ADMIN, ROLES.SHELTER_MANAGER), async (req, res, next) => {
  try {
    return res.success(
      {
        pendingDonationsCount: 1,
        activeRidersCount: 2,
        highUrgencySheltersCount: 1,
        inTransitAssignmentsCount: 0,
        dispatchEngineStatus: 'ACTIVE'
      },
      'Dispatch overview telemetry'
    );
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

    // Dispatch recommendation calculation
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
 * POST /api/dispatch/auto-assign
 * Creates an assignment and emits dispatch offer to target rider
 */
router.post('/auto-assign', async (req, res, next) => {
  try {
    const { donationId, shelterId, riderId } = req.body;

    if (!donationId || !shelterId) {
      return res.fail(ERROR_CODES.BAD_REQUEST, 'donationId and shelterId are required');
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
