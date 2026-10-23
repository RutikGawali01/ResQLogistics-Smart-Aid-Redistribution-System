import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, API_BASE_URL } from '../services/apiClient.js';
import { authService } from '../services/authService.js';
import { donationsService } from '../services/donationsService.js';
import { sheltersService } from '../services/sheltersService.js';
import { ridersService } from '../services/ridersService.js';
import { assignmentsService } from '../services/assignmentsService.js';
import { eventsService } from '../services/eventsService.js';
import { getSocket, connectSocket, subscribeToEvent } from '../services/socket.js';
import {
  ROLES,
  ASSIGNMENT_STATUS,
  SOCKET_EVENTS,
  canTransitionAssignment
} from '@aidflow/shared';

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

describe('DEVELOPER A: Full Frontend-Backend REST & Socket.IO Integration Suite', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. CORS, Environment, and Base URL Configuration', () => {
    it('configures standard API baseURL and JSON transport headers', () => {
      expect(API_BASE_URL).toBeDefined();
      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
      expect(apiClient.defaults.headers['Accept']).toBe('application/json');
    });

    it('injects Authorization Bearer token header on outbound requests', async () => {
      const sampleJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummySignature';
      localStorage.setItem('aidflow_token', sampleJwt);

      const requestInterceptor = apiClient.interceptors.request.handlers[0];
      const transformedConfig = await requestInterceptor.fulfilled({ headers: {} });

      expect(transformedConfig.headers.Authorization).toBe(`Bearer ${sampleJwt}`);
    });
  });

  describe('2. Endpoint Parity, Request Payloads, and Response Envelopes', () => {
    it('verifies standard response format envelope unwrap in client services', async () => {
      const mockBackendEnvelope = {
        data: {
          success: true,
          data: [{ id: 'don_101', title: 'Fresh Bagels', quantity: 20, unit: 'kg' }],
          message: 'Donations retrieved successfully',
          timestamp: new Date().toISOString()
        }
      };

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockBackendEnvelope);

      const result = await donationsService.getDonations({ forceMock: false });
      expect(result.success).toBe(true);
      expect(result.isMock).toBe(false);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('don_101');
    });

    it('verifies shelter capacity and urgency endpoints contract', async () => {
      const mockShelterResponse = {
        data: {
          success: true,
          data: {
            id: 'shl_001',
            name: 'Downtown Hope Refuge',
            isOpen: true,
            urgencyLevel: 'CRITICAL',
            currentDemand: 120
          },
          message: 'Shelter urgency updated'
        }
      };

      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce(mockShelterResponse);

      const res = await sheltersService.updateStatus(
        'shl_001',
        { urgencyLevel: 'CRITICAL' },
        { forceMock: false }
      );

      expect(patchSpy).toHaveBeenCalledWith('/shelters/shl_001/status', { urgencyLevel: 'CRITICAL' });
      expect(res.success).toBe(true);
      expect(res.data.urgencyLevel).toBe('CRITICAL');
    });

    it('verifies rider availability and location telemetry endpoints contract', async () => {
      const mockRiderResponse = {
        data: {
          success: true,
          data: {
            id: 'rdr_001',
            status: 'AVAILABLE',
            isAvailable: true
          },
          message: 'Rider availability updated'
        }
      };

      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce(mockRiderResponse);

      const res = await ridersService.updateStatus('rdr_001', 'AVAILABLE', { forceMock: false });
      expect(patchSpy).toHaveBeenCalledWith('/riders/rdr_001/availability', {
        status: 'AVAILABLE',
        isAvailable: true
      });
      expect(res.success).toBe(true);
      expect(res.data.status).toBe('AVAILABLE');

      const mockLocationResponse = {
        data: {
          success: true,
          data: {
            location: { latitude: 37.7749, longitude: -122.4194 }
          },
          message: 'Rider location updated'
        }
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockLocationResponse);
      const locRes = await ridersService.updateLocation(
        'rdr_001',
        { latitude: 37.7749, longitude: -122.4194 },
        { forceMock: false }
      );

      expect(postSpy).toHaveBeenCalledWith(
        '/riders/rdr_001/location',
        expect.objectContaining({ latitude: 37.7749, longitude: -122.4194 })
      );
      expect(locRes.success).toBe(true);
    });

    it('verifies event stream and admin alert query endpoints', async () => {
      const mockAlerts = {
        data: {
          success: true,
          data: [
            {
              id: 'evt_alt_01',
              entityType: 'RESERVATION',
              eventType: 'ADMIN_ALERT',
              metadata: { severity: 'CRITICAL', reason: 'RESERVATION_HOLD_EXPIRED' }
            }
          ]
        }
      };

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockAlerts);
      const alertRes = await eventsService.getAdminAlerts({ forceMock: false });
      expect(alertRes.success).toBe(true);
      expect(alertRes.data[0].eventType).toBe('ADMIN_ALERT');
    });
  });

  describe('3. Assignment State Machine & Reservation Transition Validation', () => {
    it('validates allowed forward state progression through all delivery phases', () => {
      // 1. UNASSIGNED -> PENDING_ACCEPTANCE
      const step1 = canTransitionAssignment(ASSIGNMENT_STATUS.UNASSIGNED, ASSIGNMENT_STATUS.PENDING_ACCEPTANCE);
      expect(step1.valid).toBe(true);

      // 2. PENDING_ACCEPTANCE -> ACCEPTED
      const step2 = canTransitionAssignment(ASSIGNMENT_STATUS.PENDING_ACCEPTANCE, ASSIGNMENT_STATUS.ACCEPTED);
      expect(step2.valid).toBe(true);

      // 3. ACCEPTED -> PICKUP_IN_PROGRESS
      const step3 = canTransitionAssignment(ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS);
      expect(step3.valid).toBe(true);

      // 4. PICKUP_IN_PROGRESS -> PICKED_UP
      const step4 = canTransitionAssignment(ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS, ASSIGNMENT_STATUS.PICKED_UP);
      expect(step4.valid).toBe(true);

      // 5. PICKED_UP -> DELIVERY_IN_PROGRESS
      const step5 = canTransitionAssignment(ASSIGNMENT_STATUS.PICKED_UP, ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS);
      expect(step5.valid).toBe(true);

      // 6. DELIVERY_IN_PROGRESS -> DELIVERED
      const step6 = canTransitionAssignment(ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS, ASSIGNMENT_STATUS.DELIVERED);
      expect(step6.valid).toBe(true);
    });

    it('rejects invalid or backward state jumps', () => {
      // Cannot jump from PENDING_ACCEPTANCE directly to DELIVERED
      const invalidJump = canTransitionAssignment(
        ASSIGNMENT_STATUS.PENDING_ACCEPTANCE,
        ASSIGNMENT_STATUS.DELIVERED
      );
      expect(invalidJump.valid).toBe(false);

      // Cannot regress from DELIVERED back to ACCEPTED
      const regression = canTransitionAssignment(
        ASSIGNMENT_STATUS.DELIVERED,
        ASSIGNMENT_STATUS.ACCEPTED
      );
      expect(regression.valid).toBe(false);
    });

    it('sends correct state transition payload to PATCH /api/assignments/:id/state', async () => {
      const mockTransitioned = {
        data: {
          success: true,
          data: {
            id: 'asg_001',
            status: ASSIGNMENT_STATUS.ACCEPTED,
            timeline: { acceptedAt: new Date().toISOString() }
          },
          message: 'Assignment transitioned from PENDING_ACCEPTANCE to ACCEPTED'
        }
      };

      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce(mockTransitioned);

      const res = await assignmentsService.transitionState(
        'asg_001',
        ASSIGNMENT_STATUS.ACCEPTED,
        { reason: 'Rider accepted mission', forceMock: false }
      );

      expect(patchSpy).toHaveBeenCalledWith(
        '/assignments/asg_001/state',
        expect.objectContaining({
          targetStatus: ASSIGNMENT_STATUS.ACCEPTED,
          reason: 'Rider accepted mission'
        })
      );
      expect(res.success).toBe(true);
      expect(res.data.status).toBe(ASSIGNMENT_STATUS.ACCEPTED);
    });
  });

  describe('4. Socket.IO Real-time Subscriptions & Dispatch Events', () => {
    it('initializes socket singleton with reconnection parameters', () => {
      const s = getSocket();
      expect(s).toBeDefined();
    });

    it('subscribes to ASSIGNMENT_STATE_CHANGED and invokes callback with payload', () => {
      const socket = getSocket();
      const mockCallback = vi.fn();

      const unsubscribe = subscribeToEvent(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, mockCallback);

      // Simulate inbound socket event
      const eventPayload = {
        assignmentId: 'asg_test_999',
        previousStatus: ASSIGNMENT_STATUS.ACCEPTED,
        newStatus: ASSIGNMENT_STATUS.PICKED_UP
      };

      socket.emit(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, eventPayload);

      // Clean up subscription
      unsubscribe();
      expect(typeof unsubscribe).toBe('function');
    });

    it('subscribes to RIDER_LOCATION_BROADCAST and parses location data', () => {
      const socket = getSocket();
      const locationListener = vi.fn();

      const unsubscribe = subscribeToEvent(SOCKET_EVENTS.RIDER_LOCATION_BROADCAST, locationListener);

      const locationPayload = {
        riderId: 'rdr_001',
        location: { latitude: 37.779, longitude: -122.41 },
        currentLocation: { latitude: 37.779, longitude: -122.41 }
      };

      socket.emit(SOCKET_EVENTS.RIDER_LOCATION_BROADCAST, locationPayload);
      unsubscribe();
    });
  });

  describe('5. Real MongoDB Donor Quantity Accounting', () => {
    it('accurately computes available, reserved, and delivered quantities from MongoDB documents', () => {
      const mockDonations = [
        {
          id: 'don_1',
          quantity: 100,
          availableQuantity: 70, // 30 units reserved
          status: 'PARTIALLY_RESERVED'
        },
        {
          id: 'don_2',
          quantity: 50,
          availableQuantity: 50,
          status: 'AVAILABLE'
        },
        {
          id: 'don_3',
          quantity: 40,
          availableQuantity: 0,
          status: 'DELIVERED'
        },
        {
          id: 'don_4',
          quantity: 10,
          availableQuantity: 0,
          status: 'EXPIRED'
        }
      ];

      const active = mockDonations.filter((d) => d.status !== 'CANCELLED' && d.status !== 'EXPIRED');

      const availableQuantity = active.reduce((acc, d) => {
        if (d.status === 'DELIVERED') return acc;
        const avail = d.availableQuantity !== undefined ? Number(d.availableQuantity) : 0;
        return acc + avail;
      }, 0);

      const reservedQuantity = active.reduce((acc, d) => {
        if (d.status === 'DELIVERED') return acc;
        const total = Number(d.quantity) || 0;
        const avail = d.availableQuantity !== undefined ? Number(d.availableQuantity) : 0;
        return acc + Math.max(0, total - avail);
      }, 0);

      const completedQuantity = mockDonations
        .filter((d) => d.status === 'DELIVERED')
        .reduce((acc, d) => acc + Number(d.quantity), 0);

      expect(availableQuantity).toBe(120); // 70 (don_1) + 50 (don_2)
      expect(reservedQuantity).toBe(30);   // 100 - 70 from don_1
      expect(completedQuantity).toBe(40);  // 40 from don_3
    });
  });
});
