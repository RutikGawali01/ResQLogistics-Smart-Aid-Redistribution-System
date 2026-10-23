import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '../services/api.js';
import { apiClient, API_BASE_URL } from '../services/apiClient.js';
import { authService } from '../services/authService.js';
import { donationsService } from '../services/donationsService.js';
import { sheltersService } from '../services/sheltersService.js';
import { ridersService } from '../services/ridersService.js';
import { assignmentsService } from '../services/assignmentsService.js';
import { analyticsService } from '../services/analyticsService.js';
import { ALL_ROLES, ROLES, ASSIGNMENT_STATUS } from '@aidflow/shared';

const mockStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => {
      store[key] = String(val);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

globalThis.localStorage = mockStorage;

describe('AidFlow Client Foundation & Axios API Client Tests', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  describe('Centralized Axios API Client', () => {
    it('initializes with expected baseURL and timeout defaults', () => {
      expect(apiClient).toBeDefined();
      expect(apiClient.defaults.baseURL).toBe(API_BASE_URL);
      expect(apiClient.defaults.timeout).toBe(12000);
      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    });

    it('attaches Bearer token via request interceptor if available in storage', async () => {
      localStorage.setItem('aidflow_token', 'mock_jwt_test_token_123');
      // Verify request interceptor logic directly
      const requestInterceptor = apiClient.interceptors.request.handlers[0];
      const config = await requestInterceptor.fulfilled({ headers: {} });
      expect(config.headers.Authorization).toBe('Bearer mock_jwt_test_token_123');
    });
  });

  describe('Authentication Service & Mock Separation', () => {
    it('ensures mock authentication is explicitly flagged with isMock: true', async () => {
      const result = await authService.login({
        email: 'admin@aidflow.org',
        password: 'any_password',
        role: ROLES.ADMIN,
        forceMock: true
      });

      expect(result.success).toBe(true);
      expect(result.isMock).toBe(true);
      expect(result.data.user.role).toBe(ROLES.ADMIN);
      expect(result.data.user.isMock).toBe(true);
      expect(authService.isMockAuth()).toBe(true);
    });

    it('supports demo profiles for all 4 roles', async () => {
      for (const role of ALL_ROLES) {
        const res = await authService.login({
          email: `${role.toLowerCase()}@test.org`,
          password: 'pass',
          role,
          forceMock: true
        });
        expect(res.success).toBe(true);
        expect(res.data.user.role).toBe(role);
      }
    });

    it('clears token and session upon logout', () => {
      localStorage.setItem('aidflow_token', 'sample_token');
      localStorage.setItem('aidflow_user', JSON.stringify({ name: 'Tester' }));
      authService.logout();
      expect(authService.getToken()).toBeNull();
      expect(authService.getCurrentUser()).toBeNull();
    });
  });

  describe('Domain Services & Decoupled Mock Layer', () => {
    it('falls back cleanly to mock data when backend is decoupled', async () => {
      const health = await api.checkHealth(true);
      expect(health.success).toBe(true);
      expect(health.isMock).toBe(true);
      expect(health.data.status).toBe('healthy');
    });

    it('retrieves surplus donations in decoupled mode', async () => {
      const res = await donationsService.getDonations({ forceMock: true });
      expect(res.success).toBe(true);
      expect(res.isMock).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
      expect(res.data[0].pickupLocation.latitude).toBeDefined();
    });

    it('supports registering a new surplus aid donation in decoupled mode', async () => {
      const newAid = {
        title: 'Emergency Packaged Meals',
        category: 'PREPARED_MEALS',
        quantity: 50,
        unit: 'meals',
        storageRequirement: 'REFRIGERATED',
        expirationDate: new Date(Date.now() + 86400000).toISOString(),
        pickupLocation: {
          address: '400 Pine St, San Francisco, CA',
          latitude: 37.791,
          longitude: -122.403
        }
      };

      const res = await donationsService.createDonation(newAid, { forceMock: true });
      expect(res.success).toBe(true);
      expect(res.data.id).toBeDefined();
      expect(res.data.title).toBe('Emergency Packaged Meals');
      expect(res.data.status).toBe('AVAILABLE');
    });

    it('retrieves shelters and permits updating capacity', async () => {
      const res = await sheltersService.getShelters({ forceMock: true });
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);

      const shelterId = res.data[0].id;
      const updateRes = await sheltersService.updateCapacity(
        shelterId,
        { currentOccupancy: 95, maxCapacity: 100 },
        { forceMock: true }
      );
      expect(updateRes.success).toBe(true);
      expect(updateRes.data.capacity.currentOccupancy).toBe(95);
    });

    it('retrieves riders and updates courier status', async () => {
      const res = await ridersService.getRiders({ forceMock: true });
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);

      const riderId = res.data[0].id;
      const statusRes = await ridersService.updateStatus(riderId, 'AVAILABLE', { forceMock: true });
      expect(statusRes.success).toBe(true);
      expect(statusRes.data.status).toBe('AVAILABLE');
    });

    it('validates assignment state transitions according to state machine rules', async () => {
      const asgRes = await assignmentsService.getAssignments({ forceMock: true });
      expect(asgRes.success).toBe(true);
      const testAsg = asgRes.data[0];

      // Transition from PENDING_ACCEPTANCE to ACCEPTED is valid
      const validTransition = await assignmentsService.transitionState(
        testAsg.id,
        ASSIGNMENT_STATUS.ACCEPTED,
        { forceMock: true }
      );
      expect(validTransition.success).toBe(true);
      expect(validTransition.data.status).toBe(ASSIGNMENT_STATUS.ACCEPTED);

      // Transition from ACCEPTED directly to DELIVERED is INVALID according to state machine
      const invalidTransition = await assignmentsService.transitionState(
        testAsg.id,
        ASSIGNMENT_STATUS.DELIVERED,
        { forceMock: true }
      );
      expect(invalidTransition.success).toBe(false);
      expect(invalidTransition.error).toBeDefined();
    });

    it('provides aggregated platform telemetry in mock mode', async () => {
      const res = await analyticsService.getTelemetry({ forceMock: true });
      expect(res.success).toBe(true);
      expect(res.data.totalSurplusKg).toBeGreaterThan(0);
      expect(res.data.mealsProvided).toBeGreaterThan(0);
    });

    it('verifies all 4 roles are known on the frontend', () => {
      expect(ALL_ROLES).toHaveLength(4);
      expect(ALL_ROLES).toContain('ADMIN');
      expect(ALL_ROLES).toContain('DONOR');
      expect(ALL_ROLES).toContain('RIDER');
      expect(ALL_ROLES).toContain('SHELTER_MANAGER');
    });
  });
});
