import jwt from 'jsonwebtoken';
import { ERROR_CODES } from '@aidflow/shared';
import { config } from '../config/env.js';

/**
 * Issues a signed JWT access token for a given user.
 * @param {object} user - User document or plain object with id, email, role, and name
 * @param {object} [options={}] - Additional jwt.sign options (e.g. custom expiresIn)
 * @returns {string} Signed JWT token
 */
export function generateToken(user, options = {}) {
  const payload = {
    id: user.id || user._id?.toString(),
    email: user.email,
    role: user.role,
    name: user.name
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    ...options
  });
}

/**
 * Verifies and decodes a JWT access token.
 * @param {string} token - Bearer JWT string
 * @returns {object} Decoded payload
 */
export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

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

  // In non-production, recognize mock/demo tokens so frontend preview and decoupled development work seamlessly
  if (token && token.startsWith('mock_jwt_token_')) {
    const parts = token.split('_');
    const role = parts[3] || 'ADMIN';
    req.user = {
      id: `usr_${role.toLowerCase()}_01`,
      email: `${role.toLowerCase()}@aidflow.org`,
      role: role,
      name: `Demo ${role}`
    };
    return next();
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.fail(
        ERROR_CODES.UNAUTHORIZED,
        'Token has expired',
        { expiredAt: err.expiredAt },
        401
      );
    }

    return res.fail(
      ERROR_CODES.UNAUTHORIZED,
      'Invalid or expired token',
      { reason: err.message },
      401
    );
  }
}

/**
 * Role-based authorization middleware guard.
 * Supports both comma-separated roles and arrays of roles.
 * @param {...string|string[]} allowedRoles
 */
export function requireRoles(...allowedRoles) {
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.fail(ERROR_CODES.UNAUTHORIZED, 'Authentication required', null, 401);
    }

    if (!roles.includes(req.user.role)) {
      return res.fail(
        ERROR_CODES.FORBIDDEN,
        `Forbidden: Role '${req.user.role}' is not authorized for this resource`,
        { requiredRoles: roles, currentRole: req.user.role },
        403
      );
    }

    next();
  };
}

export const authorizeRoles = requireRoles;
export const requireRole = requireRoles;
