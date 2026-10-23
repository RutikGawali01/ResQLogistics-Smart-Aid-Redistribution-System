import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { ASSIGNMENT_STATUS, ERROR_CODES } from '@aidflow/shared';
import { generateToken } from '../middleware/auth.js';

describe('AidFlow Server Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /api/health', () => {
    it('returns healthy status adhering to shared response envelope', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.service).toBe('aidflow-server');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('Route 404 Fallback', () => {
    it('returns standard error envelope when resource not found', async () => {
      const res = await request(app).get('/api/non-existent-route');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/auth/register validation', () => {
    it('rejects missing or invalid fields with VALIDATION_ERROR and 422 status', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'short'
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(Array.isArray(res.body.error.details)).toBe(true);
    });

    it('successfully registers and logs in a valid user', async () => {
      const uniqueEmail = `donor_${Date.now()}@test.org`;
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail,
          password: 'Password123!',
          name: 'Community Bakery',
          role: 'DONOR',
          phone: '+1-555-0100',
          organization: 'Aid Bakeries Ltd'
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);
      expect(regRes.body.data.token).toBeDefined();
      expect(regRes.body.data.user.email).toBe(uniqueEmail);

      // Verify login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: uniqueEmail,
          password: 'Password123!'
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.token).toBeDefined();
    });
  });

  describe('Assignment State Machine Enforcement via API', () => {
    const riderToken = generateToken({
      id: 'usr_rider_01',
      email: 'rider@aidflow.org',
      role: 'RIDER',
      name: 'Carlos Ruiz'
    });

    it('rejects unauthenticated transition requests with 401', async () => {
      const res = await request(app)
        .patch('/api/assignments/asg_seed_01/state')
        .send({
          targetStatus: ASSIGNMENT_STATUS.ACCEPTED
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('rejects an invalid state jump with 400 and INVALID_STATE_TRANSITION', async () => {
      // Seed assignment is in PENDING_ACCEPTANCE. Attempting jump directly to DELIVERED is illegal.
      const res = await request(app)
        .patch('/api/assignments/asg_seed_01/state')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
          targetStatus: ASSIGNMENT_STATUS.DELIVERED
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
      expect(res.body.error.message).toContain('Invalid transition');
    });

    it('allows a valid sequential transition from PENDING_ACCEPTANCE to ACCEPTED', async () => {
      const res = await request(app)
        .patch('/api/assignments/asg_seed_01/state')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
          targetStatus: ASSIGNMENT_STATUS.ACCEPTED
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ASSIGNMENT_STATUS.ACCEPTED);
      expect(res.body.data.timeline.acceptedAt).toBeDefined();
    });
  });
});
