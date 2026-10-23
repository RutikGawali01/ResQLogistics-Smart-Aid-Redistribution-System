import { describe, it, expect } from 'vitest';
import {
  ROLES,
  ALL_ROLES,
  ASSIGNMENT_STATUS,
  canTransitionAssignment,
  formatSuccessResponse,
  formatErrorResponse,
  ERROR_CODES,
  loginSchema,
  registerSchema,
  donationSchema,
  assignmentSchema
} from '../index.js';

describe('@aidflow/shared contracts and state transitions', () => {
  describe('Roles', () => {
    it('defines the 4 required system roles', () => {
      expect(ALL_ROLES).toEqual(
        expect.arrayContaining(['ADMIN', 'DONOR', 'RIDER', 'SHELTER_MANAGER'])
      );
      expect(Object.keys(ROLES)).toHaveLength(4);
    });
  });

  describe('Assignment State Machine', () => {
    it('allows valid linear transitions', () => {
      expect(canTransitionAssignment(ASSIGNMENT_STATUS.UNASSIGNED, ASSIGNMENT_STATUS.PENDING_ACCEPTANCE).valid).toBe(true);
      expect(canTransitionAssignment(ASSIGNMENT_STATUS.PENDING_ACCEPTANCE, ASSIGNMENT_STATUS.ACCEPTED).valid).toBe(true);
      expect(canTransitionAssignment(ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS).valid).toBe(true);
      expect(canTransitionAssignment(ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS, ASSIGNMENT_STATUS.PICKED_UP).valid).toBe(true);
      expect(canTransitionAssignment(ASSIGNMENT_STATUS.PICKED_UP, ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS).valid).toBe(true);
      expect(canTransitionAssignment(ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS, ASSIGNMENT_STATUS.DELIVERED).valid).toBe(true);
    });

    it('rejects jumping states or invalid regressions', () => {
      // Cannot jump straight from UNASSIGNED to DELIVERED
      const jumpCheck = canTransitionAssignment(ASSIGNMENT_STATUS.UNASSIGNED, ASSIGNMENT_STATUS.DELIVERED);
      expect(jumpCheck.valid).toBe(false);
      expect(jumpCheck.reason).toContain('Invalid transition');

      // Cannot regress from DELIVERED to ACCEPTED
      const regressCheck = canTransitionAssignment(ASSIGNMENT_STATUS.DELIVERED, ASSIGNMENT_STATUS.ACCEPTED);
      expect(regressCheck.valid).toBe(false);
      expect(regressCheck.reason).toContain('terminal state');
    });

    it('rejects identical state transitions (no-ops)', () => {
      const noOp = canTransitionAssignment(ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.ACCEPTED);
      expect(noOp.valid).toBe(false);
      expect(noOp.reason).toContain('no-op');
    });

    it('allows fallback to UNASSIGNED when rider times out or unassigns', () => {
      expect(canTransitionAssignment(ASSIGNMENT_STATUS.PENDING_ACCEPTANCE, ASSIGNMENT_STATUS.UNASSIGNED).valid).toBe(true);
      expect(canTransitionAssignment(ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.UNASSIGNED).valid).toBe(true);
    });
  });

  describe('API Envelopes', () => {
    it('formats standard success response envelope', () => {
      const res = formatSuccessResponse({ id: '123' }, 'Loaded successfully', { page: 1 });
      expect(res.success).toBe(true);
      expect(res.data).toEqual({ id: '123' });
      expect(res.message).toBe('Loaded successfully');
      expect(res.meta).toEqual({ page: 1 });
      expect(res.timestamp).toBeDefined();
    });

    it('formats standard error response envelope', () => {
      const res = formatErrorResponse(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        'Cannot transition state',
        { allowed: ['ACCEPTED'] }
      );
      expect(res.success).toBe(false);
      expect(res.error.code).toBe('INVALID_STATE_TRANSITION');
      expect(res.error.message).toBe('Cannot transition state');
      expect(res.error.details).toEqual({ allowed: ['ACCEPTED'] });
      expect(res.timestamp).toBeDefined();
    });
  });

  describe('Zod Validation Schemas', () => {
    it('validates user registration', () => {
      const validPayload = {
        email: 'donor@aidflow.org',
        password: 'securepassword123',
        name: 'Green Grocer',
        role: 'DONOR',
        phone: '+1-555-0199',
        organization: 'Green Market Inc'
      };
      const result = registerSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('rejects invalid role in registration', () => {
      const invalidPayload = {
        email: 'bad@aidflow.org',
        password: 'securepassword123',
        name: 'Hacker',
        role: 'SUPERUSER_INVALID',
        phone: '+1-555-0199'
      };
      const result = registerSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });
});
