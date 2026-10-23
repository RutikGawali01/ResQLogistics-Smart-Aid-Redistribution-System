import { ERROR_CODES } from '@aidflow/shared';

/**
 * Creates an in-memory rate limiter middleware adhering to standard error contract.
 * @param {object} options
 * @param {number} [options.windowMs=60000] - Window duration in ms (default 1 min)
 * @param {number} [options.max=5] - Maximum requests allowed per window
 * @param {string} [options.message] - User-friendly error message
 * @param {function} [options.keyGenerator] - Function to determine key from request
 */
export function createRateLimiter({
  windowMs = 60 * 1000,
  max = 5,
  message = 'Too many requests. Please try again later.',
  keyGenerator = (req) => req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown_client'
} = {}) {
  const store = new Map();

  const limiter = (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    let record = store.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      store.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil(record.resetTime / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);

      return res.fail(
        ERROR_CODES.RATE_LIMITED,
        message,
        { retryAfterSeconds, maxRequests: max, windowMs },
        429
      );
    }

    next();
  };

  /**
   * Clears the in-memory store (useful for automated testing)
   */
  limiter.reset = () => {
    store.clear();
  };

  return limiter;
}

/**
 * Standard login rate limiter: 5 attempts per 15 minutes window
 */
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Please try again after 15 minutes.'
});
