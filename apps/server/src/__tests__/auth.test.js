import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.js';
import { config } from '../config/env.js';
import { ERROR_CODES, ROLES } from '@aidflow/shared';
import { generateToken } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import { DEMO_USERS } from '../seeds/seedUsers.js';

describe('AidFlow Authentication & Authorization Suite', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    // Reset rate limiter hits between tests to ensure clean state
    if (loginRateLimiter.reset) {
      loginRateLimiter.reset();
    }
  });

  describe('1. User Registration & Password Hashing', () => {
    it('successfully registers a user with bcrypt-hashed password and returns a valid JWT token', async () => {
      const uniqueEmail = `test_user_${Date.now()}@aidflow.org`;
      const plainPassword = 'SecurePassword123!';

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail,
          password: plainPassword,
          name: 'Jane Doe',
          role: ROLES.DONOR,
          phone: '+1-555-0199',
          organization: 'Local Bakery Hub'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(uniqueEmail.toLowerCase());
      expect(res.body.data.user.role).toBe(ROLES.DONOR);

      // Verify passwordHash is NOT leaked in the response
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();

      // Verify the returned token is valid and decodable
      const decoded = jwt.verify(res.body.data.token, config.jwt.secret);
      expect(decoded.email).toBe(uniqueEmail.toLowerCase());
      expect(decoded.role).toBe(ROLES.DONOR);
      expect(decoded.name).toBe('Jane Doe');
    });

    it('rejects duplicate email registration with 409 CONFLICT', async () => {
      const email = `dup_${Date.now()}@aidflow.org`;
      const payload = {
        email,
        password: 'Password123!',
        name: 'First Register',
        role: ROLES.DONOR
      };

      const firstRes = await request(app).post('/api/auth/register').send(payload);
      expect(firstRes.status).toBe(201);

      const secondRes = await request(app).post('/api/auth/register').send(payload);
      expect(secondRes.status).toBe(409);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.error.code).toBe(ERROR_CODES.CONFLICT);
    });

    it('rejects registration with invalid email or password too short (422 VALIDATION_ERROR)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email-address',
          password: '123',
          name: 'J'
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(Array.isArray(res.body.error.details)).toBe(true);
    });
  });

  describe('2. User Login & Demo Seed Accounts', () => {
    it('successfully logs in with valid credentials and returns a valid JWT token', async () => {
      const email = `login_user_${Date.now()}@aidflow.org`;
      const password = 'Password123!';

      await request(app)
        .post('/api/auth/register')
        .send({ email, password, name: 'Login Test', role: ROLES.DONOR });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.token).toBeDefined();
      expect(loginRes.body.data.user.email).toBe(email.toLowerCase());
      expect(loginRes.body.data.user.passwordHash).toBeUndefined();

      const decoded = jwt.verify(loginRes.body.data.token, config.jwt.secret);
      expect(decoded.email).toBe(email.toLowerCase());
    });

    it('verifies all 4 demo seed accounts can log in (ADMIN, DONOR, RIDER, SHELTER_MANAGER)', async () => {
      for (const demoUser of DEMO_USERS) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: demoUser.email,
            password: demoUser.password
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.token).toBeDefined();
        expect(res.body.data.user.role).toBe(demoUser.role);

        // Verify payload inside token matches role
        const decoded = jwt.verify(res.body.data.token, config.jwt.secret);
        expect(decoded.role).toBe(demoUser.role);
      }
    });

    it('rejects login with incorrect password with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@aidflow.org',
          password: 'WrongPassword999!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('rejects login with non-existent email with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent_account_404@aidflow.org',
          password: 'Password123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });
  });

  describe('3. Token Verification & Protected /api/auth/me', () => {
    it('returns the user profile when providing a valid Bearer token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@aidflow.org',
          password: 'AdminPassword123!'
        });

      const token = loginRes.body.data.token;

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.user.email).toBe('admin@aidflow.org');
      expect(meRes.body.data.user.role).toBe(ROLES.ADMIN);
      expect(meRes.body.data.user.passwordHash).toBeUndefined();
    });
  });

  describe('4. Token Error Handling (Missing, Malformed, Expired)', () => {
    it('rejects requests to protected routes when authorization header is missing (401)', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(res.body.error.message).toContain('Missing or malformed authorization header');
    });

    it('rejects requests with malformed Bearer token (401)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-jwt-token-string');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(res.body.error.message).toBe('Invalid or expired token');
    });

    it('rejects requests with an expired token (401 Token has expired)', async () => {
      // Issue an immediately expired token
      const expiredToken = generateToken(
        { id: 'usr_test_exp', email: 'exp@test.org', role: ROLES.DONOR, name: 'Expired User' },
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(res.body.error.message).toBe('Token has expired');
    });
  });

  describe('5. Role-Based Authorization Enforcement (403 FORBIDDEN)', () => {
    let donorToken;
    let riderToken;
    let shelterToken;
    let adminToken;

    beforeAll(async () => {
      // Obtain tokens for all 4 roles
      const login = async (email, password) => {
        const res = await request(app).post('/api/auth/login').send({ email, password });
        return res.body.data.token;
      };

      adminToken = await login('admin@aidflow.org', 'AdminPassword123!');
      donorToken = await login('donor@aidflow.org', 'DonorPassword123!');
      riderToken = await login('rider@aidflow.org', 'RiderPassword123!');
      shelterToken = await login('shelter@aidflow.org', 'ShelterPassword123!');
    });

    it('rejects unauthenticated user from accessing privileged routes (401)', async () => {
      const res = await request(app).get('/api/donations');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);

      const dispatchRes = await request(app).get('/api/dispatch/overview');
      expect(dispatchRes.status).toBe(401);
    });

    it('prevents DONOR from accessing admin/shelter-only dispatch overview (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/dispatch/overview')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(res.body.error.message).toContain("Role 'DONOR' is not authorized");
      expect(res.body.error.details.requiredRoles).toContain(ROLES.ADMIN);
    });

    it('allows ADMIN to access dispatch overview (200 SUCCESS)', async () => {
      const res = await request(app)
        .get('/api/dispatch/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dispatchEngineStatus).toBe('ACTIVE');
    });

    it('prevents RIDER from creating a donation (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
          donorId: 'usr_rider_01',
          title: 'Unauthorized Food Offer',
          category: 'PRODUCE',
          quantity: 10,
          unit: 'kg',
          expirationDate: new Date(Date.now() + 86400000).toISOString(),
          pickupLocation: {
            address: '100 Main St',
            latitude: 37.77,
            longitude: -122.41
          }
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('allows DONOR to create a donation (201 CREATED)', async () => {
      const res = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          donorId: 'usr_donor_01',
          title: 'Artisanal Bread Surplus',
          category: 'BAKERY',
          quantity: 20,
          unit: 'loaves',
          expirationDate: new Date(Date.now() + 86400000).toISOString(),
          pickupLocation: {
            address: '456 Bakery Row',
            latitude: 37.78,
            longitude: -122.42
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Artisanal Bread Surplus');
    });

    it('prevents DONOR from creating or modifying a shelter profile (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/shelters')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          name: 'Unauthorized Shelter',
          managerId: 'usr_donor_01',
          address: '777 Hope St',
          location: { latitude: 37.77, longitude: -122.41 },
          capacity: { currentOccupancy: 10, maxCapacity: 50 },
          acceptedCategories: ['PERISHABLE'],
          contactPhone: '+1-555-0199'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('prevents DONOR from updating rider GPS location (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/riders/rdr_seed_01/location')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          latitude: 37.779,
          longitude: -122.41,
          updatedAt: new Date().toISOString()
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('allows RIDER to update rider GPS location (200 SUCCESS)', async () => {
      const res = await request(app)
        .post('/api/riders/rdr_seed_01/location')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
          latitude: 37.7801,
          longitude: -122.4105,
          speedKmh: 20,
          heading: 90,
          updatedAt: new Date().toISOString()
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.location.latitude).toBe(37.7801);
    });
  });

  describe('6. Login Rate Limiting (429 RATE_LIMITED)', () => {
    it('enforces rate limiting after maximum login attempts are exceeded', async () => {
      // The default login rate limiter allows 5 requests per window
      // Send 5 rapid requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'donor@aidflow.org', password: 'DonorPassword123!' });
      }

      // The 6th request must be blocked by rate limiter
      const blockedRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'donor@aidflow.org', password: 'DonorPassword123!' });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.error.code).toBe(ERROR_CODES.RATE_LIMITED);
      expect(blockedRes.headers['retry-after']).toBeDefined();
      expect(blockedRes.body.error.message).toContain('Too many login attempts');
    });
  });
});
