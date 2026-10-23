import jwt from 'jsonwebtoken';
import { ERROR_CODES } from '@aidflow/shared';
import { config } from '../config/env.js';

/**
 * Authentication middleware verifying Bearer JWT.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.fail(
      ERROR_CODES.UNAUTHORIZED,
      'Authentication required: Missing or malformed authorization header',
      null,
      401
    );
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = payload;
    next();
  } catch (err) {
    return res.fail(
      ERROR_CODES.UNAUTHORIZED,
      'Invalid or expired token',
      { reason: err.message },
      401
    );
  }
}

/**
 * Role-based authorization guard.
 * @param {string[]} allowedRoles
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.fail(ERROR_CODES.UNAUTHORIZED, 'Authentication required', null, 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.fail(
        ERROR_CODES.FORBIDDEN,
        `Forbidden: Role '${req.user.role}' is not authorized for this resource`,
        { requiredRoles: allowedRoles, currentRole: req.user.role },
        403
      );
    }

    next();
  };
}
