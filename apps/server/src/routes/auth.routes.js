import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { registerSchema, loginSchema, ERROR_CODES } from '@aidflow/shared';
import { validateBody } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { isDatabaseConnected } from '../config/database.js';

const router = Router();

// In-memory fallback user store for local development when MongoDB is not connected
const inMemoryUsers = [];

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id || user._id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/**
 * POST /api/auth/register
 */
router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name, role, phone, organization } = req.validatedBody;

    if (isDatabaseConnected()) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.fail(ERROR_CODES.CONFLICT, 'An account with this email already exists', null, 409);
      }

      const user = await User.create({ email, password, name, role, phone, organization });
      const token = generateToken(user);
      return res.success({ user, token }, 'User registered successfully', null, 201);
    }

    // In-memory fallback
    if (inMemoryUsers.some(u => u.email === email)) {
      return res.fail(ERROR_CODES.CONFLICT, 'An account with this email already exists', null, 409);
    }

    const mockUser = {
      id: `usr_${Date.now()}`,
      email,
      name,
      role,
      phone,
      organization: organization || null,
      active: true,
      createdAt: new Date().toISOString()
    };
    inMemoryUsers.push({ ...mockUser, password });
    const token = generateToken(mockUser);

    return res.success({ user: mockUser, token }, 'User registered successfully (in-memory mode)', null, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validatedBody;

    if (isDatabaseConnected()) {
      const user = await User.findOne({ email });
      if (!user) {
        return res.fail(ERROR_CODES.UNAUTHORIZED, 'Invalid email or password', null, 401);
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.fail(ERROR_CODES.UNAUTHORIZED, 'Invalid email or password', null, 401);
      }

      const token = generateToken(user);
      return res.success({ user, token }, 'Login successful');
    }

    // In-memory fallback
    const found = inMemoryUsers.find(u => u.email === email && u.password === password);
    if (!found) {
      return res.fail(ERROR_CODES.UNAUTHORIZED, 'Invalid email or password', null, 401);
    }

    const { password: _, ...userSafe } = found;
    const token = generateToken(userSafe);
    return res.success({ user: userSafe, token }, 'Login successful (in-memory mode)');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    if (isDatabaseConnected()) {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.fail(ERROR_CODES.NOT_FOUND, 'User not found', null, 404);
      }
      return res.success({ user }, 'User profile retrieved');
    }

    return res.success({ user: req.user }, 'User profile retrieved from session');
  } catch (err) {
    next(err);
  }
});

export default router;
