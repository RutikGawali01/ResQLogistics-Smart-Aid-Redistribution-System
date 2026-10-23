import { Router } from 'express';
import bcrypt from 'bcrypt';
import { registerSchema, loginSchema, ERROR_CODES } from '@aidflow/shared';
import { validateBody } from '../middleware/validator.js';
import { authenticate, generateToken } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { isDatabaseConnected } from '../config/database.js';
import { getPrehashedDemoUsers } from '../seeds/seedUsers.js';

const router = Router();

// In-memory fallback user store initialized with pre-hashed demo accounts
export const inMemoryUsers = [...getPrehashedDemoUsers()];

/**
 * POST /api/auth/register
 * Registers a new user with bcrypt-hashed password and returns JWT token
 */
router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name, role = 'DONOR', phone, organization } = req.validatedBody;
    const normalizedEmail = email.toLowerCase();
    const saltRounds = config.bcrypt?.saltRounds || 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    if (isDatabaseConnected()) {
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        return res.fail(ERROR_CODES.CONFLICT, 'An account with this email already exists', null, 409);
      }

      const user = await User.create({
        name,
        email: normalizedEmail,
        passwordHash,
        role,
        phone,
        organization
      });

      const token = generateToken(user);
      return res.success({ user, token }, 'User registered successfully', null, 201);
    }

    // In-memory fallback mode
    if (inMemoryUsers.some(u => u.email.toLowerCase() === normalizedEmail)) {
      return res.fail(ERROR_CODES.CONFLICT, 'An account with this email already exists', null, 409);
    }

    const mockUser = {
      id: `usr_${Date.now()}`,
      name,
      email: normalizedEmail,
      passwordHash,
      role,
      phone: phone || null,
      organization: organization || null,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    inMemoryUsers.push(mockUser);
    const token = generateToken(mockUser);
    const { passwordHash: _, ...userSafe } = mockUser;

    return res.success({ user: userSafe, token }, 'User registered successfully', null, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Validates credentials, applies login rate limiting, and returns JWT token
 */
router.post('/login', loginRateLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validatedBody;
    const normalizedEmail = email.toLowerCase();

    if (isDatabaseConnected()) {
      const user = await User.findOne({ email: normalizedEmail });
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

    // In-memory fallback mode
    const found = inMemoryUsers.find(u => u.email.toLowerCase() === normalizedEmail);
    if (!found) {
      return res.fail(ERROR_CODES.UNAUTHORIZED, 'Invalid email or password', null, 401);
    }

    const isMatch = await bcrypt.compare(password, found.passwordHash || found.password);
    if (!isMatch) {
      return res.fail(ERROR_CODES.UNAUTHORIZED, 'Invalid email or password', null, 401);
    }

    const { passwordHash: _, password: __, ...userSafe } = found;
    const token = generateToken(userSafe);
    return res.success({ user: userSafe, token }, 'Login successful');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Retrieves the authenticated user's profile
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

    const found = inMemoryUsers.find(u => (u.id === req.user.id || u.email === req.user.email));
    if (found) {
      const { passwordHash: _, password: __, ...userSafe } = found;
      return res.success({ user: userSafe }, 'User profile retrieved');
    }

    return res.success({ user: req.user }, 'User profile retrieved');
  } catch (err) {
    next(err);
  }
});

export default router;
