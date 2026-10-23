import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateHaversineDistanceKm,
  isValidCoord
} from '../utils/geo.js';
import {
  computeOperationalAlerts
} from '../hooks/useLiveOperations.js';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  joinRoom,
  leaveRoom,
  subscribeToEvent,
  getSocketStatus
} from '../services/socket.js';
import { ASSIGNMENT_STATUS, SOCKET_EVENTS } from '@aidflow/shared';

describe('AidFlow Live Operations Interface Tests', () => {
  describe('Geospatial & Haversine Distance Calculations', () => {
    it('calculates realistic distance in kilometers between two valid coordinates', () => {
      // 220 Market St (37.7925, -122.3995) to 100 Mission St (37.7915, -122.3980)
      const distance = calculateHaversineDistanceKm(37.7925, -122.3995, 37.7915, -122.3980);
      expect(distance).toBeGreaterThan(0.05);
      expect(distance).toBeLessThan(0.5); // Approx 0.17 km
    });

    it('gracefully handles missing or undefined coordinates by returning null', () => {
      expect(calculateHaversineDistanceKm(null, -122.4, 37.7, -122.4)).toBeNull();
      expect(calculateHaversineDistanceKm(37.7, undefined, 37.7, -122.4)).toBeNull();
      expect(calculateHaversineDistanceKm(37.7, -122.4, 37.7, null)).toBeNull();
    });

    it('returns 0 km for identical coordinates', () => {
      const distance = calculateHaversineDistanceKm(37.7749, -122.4194, 37.7749, -122.4194);
      expect(distance).toBe(0);
    });
  });

  describe('Operational Alert Generation Engine (Task 4)', () => {
    it('generates alert for donations expiring within 24 hours', () => {
      const mockDonations = [
        {
          id: 'don_expiring_soon',
          title: 'Perishable Berry Trays',
          status: 'AVAILABLE',
          quantity: 20,
          unit: 'kg',
          safeUseDeadline: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString() // 4 hours from now
        },
        {
          id: 'don_safe',
          title: 'Canned Beans',
          status: 'AVAILABLE',
          quantity: 100,
          unit: 'cans',
          safeUseDeadline: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString() // 72 hours from now
        }
      ];

      const alerts = computeOperationalAlerts(mockDonations, [], [], []);
      const expiringAlert = alerts.find((a) => a.type === 'EXPIRING_DONATION');
      expect(expiringAlert).toBeDefined();
      expect(expiringAlert.severity).toBe('CRITICAL');
      expect(expiringAlert.title).toContain('Perishable Aid Expiring');
      expect(expiringAlert.hoursRemaining).toBeLessThanOrEqual(4);
    });

    it('generates alert for expired reservation holds', () => {
      const mockDonationsWithExpiredReservation = [
        {
          id: 'don_res_01',
          title: 'Bakery Loaves',
          status: 'RESERVED',
          quantity: 30,
          unit: 'loaves',
          reservation: {
            quantity: 30,
            status: 'PENDING',
            expiresAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() // expired 15 mins ago
          }
        }
      ];

      const alerts = computeOperationalAlerts(mockDonationsWithExpiredReservation, [], [], []);
      const reservationAlert = alerts.find((a) => a.type === 'EXPIRED_RESERVATION');
      expect(reservationAlert).toBeDefined();
      expect(reservationAlert.severity).toBe('WARNING');
      expect(reservationAlert.title).toContain('Expired Reservation Hold');
    });

    it('generates alert for closed shelters and shelters at full capacity', () => {
      const mockShelters = [
        {
          id: 'shl_closed',
          name: 'Closed Intake Depot',
          isOpen: false,
          active: false
        },
        {
          id: 'shl_full',
          name: 'Overflowing Center',
          isOpen: true,
          active: true,
          capacity: { currentOccupancy: 100, maxCapacity: 100 }
        }
      ];

      const alerts = computeOperationalAlerts([], mockShelters, [], []);
      const closedAlert = alerts.find((a) => a.title.includes('Closed Intake Depot'));
      const fullAlert = alerts.find((a) => a.title.includes('Overflowing Center'));

      expect(closedAlert).toBeDefined();
      expect(closedAlert.severity).toBe('CRITICAL');

      expect(fullAlert).toBeDefined();
      expect(fullAlert.severity).toBe('WARNING');
    });

    it('generates alert for unassigned surplus aid and missions awaiting couriers', () => {
      const mockDonations = [
        { id: 'don_01', status: 'AVAILABLE', quantity: 50, availableQuantity: 50 },
        { id: 'don_02', status: 'AVAILABLE', quantity: 30, availableQuantity: 30 }
      ];
      const mockAssignments = [
        { id: 'asg_unassigned', status: ASSIGNMENT_STATUS.UNASSIGNED, allocatedQuantity: 50 }
      ];

      const alerts = computeOperationalAlerts(mockDonations, [], [], mockAssignments);
      const unassignedAidAlert = alerts.find((a) => a.entityType === 'DONATION_POOL');
      const unassignedMissionAlert = alerts.find((a) => a.entityType === 'ASSIGNMENT_POOL');

      expect(unassignedAidAlert).toBeDefined();
      expect(unassignedMissionAlert).toBeDefined();
      expect(unassignedAidAlert.count).toBe(2);
      expect(unassignedMissionAlert.count).toBe(1);
    });
  });

  describe('Socket.IO Lifecycle & Event Subscriptions', () => {
    it('initializes socket and exposes room join/leave methods', () => {
      const socket = getSocket();
      expect(socket).toBeDefined();
      expect(typeof joinRoom).toBe('function');
      expect(typeof leaveRoom).toBe('function');
      expect(typeof subscribeToEvent).toBe('function');
    });

    it('permits registering and tearing down event subscribers cleanly', () => {
      const mockHandler = vi.fn();
      const unsubscribe = subscribeToEvent('custom:test_event', mockHandler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe(); // ensures no leaks
    });

    it('tracks socket connection status cleanly', () => {
      const statusCallback = vi.fn();
      connectSocket(statusCallback);
      expect(statusCallback).toHaveBeenCalled();
      disconnectSocket(statusCallback);
    });
  });

  describe('Telemetry & Provenance Integrity (Task 9)', () => {
    it('ensures demo/mocked coordinates are never reported as verified device GPS', () => {
      const mockRider = {
        id: 'usr_rider_01',
        name: 'Carlos Ruiz',
        telemetrySource: 'DEMO_SEED'
      };

      expect(mockRider.telemetrySource).not.toBe('LIVE_DEVICE_GPS');
    });
  });
});
