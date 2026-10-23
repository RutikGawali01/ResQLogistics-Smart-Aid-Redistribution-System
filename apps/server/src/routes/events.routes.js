import { Router } from 'express';
import { Event } from '../models/Event.js';
import { isDatabaseConnected } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/events
 * Query event history across donations, shelters, riders, and assignments
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { entityType, entityId, eventType, limit = 50 } = req.query;

    if (isDatabaseConnected()) {
      const filter = {};
      if (entityType) filter.entityType = entityType;
      if (entityId) filter.entityId = entityId;
      if (eventType) filter.eventType = eventType;

      const events = await Event.find(filter)
        .populate('actorId', 'name email role')
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit) || 50, 100));

      return res.success(events, 'Event history retrieved', { total: events.length });
    }

    return res.success([], 'Event history (disconnected mode)', { total: 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
