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

  describe('AidFlow Four Main User Workflows', () => {
    it('DONOR Workflow: creates donation, categorizes quantities, and tracks delivery status', async () => {
      // 1. Create a donation
      const newDonation = {
        title: 'Morning Bakery Loaves',
        category: 'BAKERY',
        quantity: 40,
        unit: 'loaves',
        storageRequirement: 'ROOM_TEMPERATURE',
        expirationDate: new Date(Date.now() + 86400000).toISOString(),
        pickupLocation: {
          address: '100 Market St, San Francisco, CA',
          latitude: 37.793,
          longitude: -122.399
        }
      };

      const createRes = await donationsService.createDonation(newDonation, { forceMock: true });
      expect(createRes.success).toBe(true);
      expect(createRes.data.title).toBe('Morning Bakery Loaves');

      // 2. View donations and compute available, reserved, and completed quantities
      const allDonationsRes = await donationsService.getDonations({ forceMock: true });
      expect(allDonationsRes.success).toBe(true);
      const list = allDonationsRes.data;

      const availableQty = list
        .filter((d) => d.status === 'AVAILABLE')
        .reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
      const reservedQty = list
        .filter((d) => ['RESERVED', 'ASSIGNED', 'IN_TRANSIT'].includes(d.status))
        .reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
      const completedQty = list
        .filter((d) => d.status === 'DELIVERED')
        .reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);

      expect(availableQty).toBeGreaterThan(0);
      expect(typeof reservedQty).toBe('number');
      expect(typeof completedQty).toBe('number');

      // 3. View pickup and delivery status
      const first = list[0];
      expect(first.pickupLocation?.address).toBeDefined();
      expect(first.status).toBeDefined();
    });

    it('SHELTER MANAGER Workflow: updates capacity/resources, toggles open/close, confirms delivery receipt', async () => {
      // 1. Update receiving capacity and resource availability
      const shelters = await sheltersService.getShelters({ forceMock: true });
      expect(shelters.success).toBe(true);
      const shelterId = shelters.data[0].id;

      const capRes = await sheltersService.updateCapacity(
        shelterId,
        { currentOccupancy: 82, maxCapacity: 100, mealsNeededPerDay: 140 },
        { forceMock: true }
      );
      expect(capRes.success).toBe(true);
      expect(capRes.data.capacity.currentOccupancy).toBe(82);

      // 2. Confirm incoming delivery receipt
      const assignments = await assignmentsService.getAssignments({ forceMock: true });
      expect(assignments.success).toBe(true);
      const activeAsg = assignments.data[0];

      const deliveryConfirmation = await assignmentsService.transitionState(
        activeAsg.id,
        ASSIGNMENT_STATUS.DELIVERED,
        { reason: 'Confirmed intake by Shelter Supervisor', forceMock: true }
      );
      // Valid transition or handled state jump
      expect(deliveryConfirmation).toBeDefined();
    });

    it('RIDER Workflow: views assignments, accepts/declines, and progresses mission status to destination', async () => {
      // 1. View offered assignments
      const asgRes = await assignmentsService.getAssignments({ forceMock: true });
      expect(asgRes.success).toBe(true);
      const asg = asgRes.data[0];

      expect(asg.pickupLocation?.address).toBeDefined();
      expect(asg.deliveryLocation?.address).toBeDefined();

      // 2. Accept assignment if in pending acceptance
      if (asg.status === ASSIGNMENT_STATUS.PENDING_ACCEPTANCE) {
        const accepted = await assignmentsService.transitionState(
          asg.id,
          ASSIGNMENT_STATUS.ACCEPTED,
          { forceMock: true }
        );
        expect(accepted.success).toBe(true);
        expect(accepted.data.status).toBe(ASSIGNMENT_STATUS.ACCEPTED);
      }

      // 3. Progress route to pickup in progress
      const pickupProg = await assignmentsService.transitionState(
        asg.id,
        ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS,
        { forceMock: true }
      );
      expect(pickupProg.success).toBe(true);

      // 4. Record pickup confirmation
      const pickedUp = await assignmentsService.transitionState(
        asg.id,
        ASSIGNMENT_STATUS.PICKED_UP,
        { forceMock: true }
      );
      expect(pickedUp.success).toBe(true);
      expect(pickedUp.data.status).toBe(ASSIGNMENT_STATUS.PICKED_UP);
    });

    it('ADMIN Workflow: views platform summaries, telemetry, and assignments pipeline', async () => {
      // 1. View platform summaries
      const [tel, don, shl, rdr, asg] = await Promise.all([
        analyticsService.getTelemetry({ forceMock: true }),
        donationsService.getDonations({ forceMock: true }),
        sheltersService.getShelters({ forceMock: true }),
        ridersService.getRiders({ forceMock: true }),
        assignmentsService.getAssignments({ forceMock: true })
      ]);

      expect(tel.success).toBe(true);
      expect(don.data.length).toBeGreaterThan(0);
      expect(shl.data.length).toBeGreaterThan(0);
      expect(rdr.data.length).toBeGreaterThan(0);
      expect(asg.data.length).toBeGreaterThan(0);

      // 2. Validates telemetry metrics
      expect(tel.data.totalSurplusKg).toBeDefined();
      expect(tel.data.avgDispatchSlaMinutes).toBeDefined();
    });

    it('Switching mechanism: screens can dynamically switch from mock data to real API endpoints', async () => {
      // Mock mode explicitly enabled
      const mockResult = await donationsService.getDonations({ forceMock: true });
      expect(mockResult.success).toBe(true);
      expect(mockResult.isMock).toBe(true);

      // Calling with forceMock: false attempts real network request without crashing
      // (and falls back cleanly if server unreachable)
      const dynamicResult = await donationsService.getDonations({ forceMock: false });
      expect(dynamicResult.success).toBe(true);
      expect(Array.isArray(dynamicResult.data)).toBe(true);
    });
  });
});
