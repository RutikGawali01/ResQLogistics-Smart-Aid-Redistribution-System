import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { donationsService } from '../services/donationsService.js';
import { sheltersService } from '../services/sheltersService.js';
import { ridersService } from '../services/ridersService.js';
import { assignmentsService } from '../services/assignmentsService.js';
import { analyticsService } from '../services/analyticsService.js';
import { connectSocket, disconnectSocket, subscribeToEvent } from '../services/socket.js';
import { SOCKET_EVENTS, ASSIGNMENT_STATUS } from '@aidflow/shared';

/**
 * Computes dynamic operational alerts across all platform assets:
 * 1. Expiring donations (< 24 hours or past safe-use deadline)
 * 2. Expired reservations (held past expiresAt without dispatch)
 * 3. Closed shelters (isOpen === false or 100% capacity)
 * 4. Unassigned aid (available surplus awaiting courier dispatch)
 */
export function computeOperationalAlerts(donations = [], shelters = [], riders = [], assignments = []) {
  const alerts = [];
  const now = Date.now();

  // 1. Expiring Donations Alert
  donations.forEach((d) => {
    const deadlineStr = d.safeUseDeadline || d.expirationDate;
    if (deadlineStr) {
      const deadline = new Date(deadlineStr).getTime();
      const hoursRemaining = (deadline - now) / (1000 * 60 * 60);

      if (hoursRemaining < 0 && d.status !== 'COMPLETED') {
        alerts.push({
          id: `alt_exp_${d.id}`,
          type: 'EXPIRING_DONATION',
          severity: 'CRITICAL',
          title: `Expired Surplus Aid: ${d.title}`,
          description: `Donation safe-use window elapsed ${Math.abs(Math.round(hoursRemaining))}h ago. Requires quality inspection or compost diversion.`,
          entityType: 'DONATION',
          entityId: d.id,
          timestamp: new Date().toLocaleTimeString(),
          hoursRemaining: Math.round(hoursRemaining)
        });
      } else if (hoursRemaining <= 24 && hoursRemaining > 0 && d.status === 'AVAILABLE') {
        alerts.push({
          id: `alt_exp_${d.id}`,
          type: 'EXPIRING_DONATION',
          severity: hoursRemaining <= 6 ? 'CRITICAL' : 'WARNING',
          title: `Perishable Aid Expiring: ${d.title}`,
          description: `${d.quantity} ${d.unit} will expire in ${Math.round(hoursRemaining)} hours. Prioritize dispatch immediately.`,
          entityType: 'DONATION',
          entityId: d.id,
          timestamp: new Date().toLocaleTimeString(),
          hoursRemaining: Math.round(hoursRemaining)
        });
      }
    }
  });

  // 2. Expired Reservations Alert
  donations.forEach((d) => {
    if (d.reservation && d.reservation.expiresAt) {
      const expTime = new Date(d.reservation.expiresAt).getTime();
      if (expTime < now && d.reservation.status === 'PENDING') {
        alerts.push({
          id: `alt_res_${d.id}`,
          type: 'EXPIRED_RESERVATION',
          severity: 'WARNING',
          title: `Expired Reservation Hold: ${d.title}`,
          description: `Hold on ${d.reservation.quantity} ${d.unit} expired without rider confirmation. Available for redistribution.`,
          entityType: 'RESERVATION',
          entityId: d.id,
          timestamp: new Date().toLocaleTimeString()
        });
      }
    }
  });

  // 3. Closed Shelters Alert
  shelters.forEach((s) => {
    const isClosed = s.isOpen === false || s.active === false;
    const isFull = s.capacity && s.capacity.currentOccupancy >= s.capacity.maxCapacity;

    if (isClosed) {
      alerts.push({
        id: `alt_shl_closed_${s.id}`,
        type: 'CLOSED_SHELTER',
        severity: 'CRITICAL',
        title: `Shelter Intake Inactive: ${s.name}`,
        description: `Shelter is marked closed for aid intake. Divert any incoming shipments to neighboring hubs.`,
        entityType: 'SHELTER',
        entityId: s.id,
        timestamp: new Date().toLocaleTimeString()
      });
    } else if (isFull) {
      alerts.push({
        id: `alt_shl_full_${s.id}`,
        type: 'CLOSED_SHELTER',
        severity: 'WARNING',
        title: `Shelter at 100% Capacity: ${s.name}`,
        description: `Shelter has reached capacity (${s.capacity.currentOccupancy}/${s.capacity.maxCapacity}). Receiving capacity limited.`,
        entityType: 'SHELTER',
        entityId: s.id,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  });

  // 4. Unassigned Aid Alert
  const unassignedDonations = donations.filter(
    (d) => d.status === 'AVAILABLE' && (d.availableQuantity > 0 || d.quantity > 0)
  );
  if (unassignedDonations.length > 0) {
    const totalQty = unassignedDonations.reduce(
      (sum, d) => sum + (d.availableQuantity || d.quantity || 0),
      0
    );
    alerts.push({
      id: 'alt_unassigned_aid_pool',
      type: 'UNASSIGNED_AID',
      severity: unassignedDonations.length >= 3 ? 'WARNING' : 'INFO',
      title: `${unassignedDonations.length} Unallocated Surplus Lots Available`,
      description: `${totalQty} units of surplus aid currently lack matching delivery dispatches.`,
      entityType: 'DONATION_POOL',
      count: unassignedDonations.length,
      timestamp: new Date().toLocaleTimeString()
    });
  }

  // Pending assignment offers without response
  const unassignedMissions = assignments.filter(
    (a) => a.status === ASSIGNMENT_STATUS.UNASSIGNED || a.status === ASSIGNMENT_STATUS.OFFERED
  );
  if (unassignedMissions.length > 0) {
    alerts.push({
      id: 'alt_unassigned_missions',
      type: 'UNASSIGNED_AID',
      severity: 'WARNING',
      title: `${unassignedMissions.length} Missions Pending Courier Assignment`,
      description: `Missions waiting for available courier pickup to secure safe delivery deadlines.`,
      entityType: 'ASSIGNMENT_POOL',
      count: unassignedMissions.length,
      timestamp: new Date().toLocaleTimeString()
    });
  }

  return alerts;
}

export function useLiveOperations({ pollInterval = 25000, enableAutoPolling = true } = {}) {
  const { forceMock } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [donations, setDonations] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [riders, setRiders] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [telemetry, setTelemetry] = useState(null);

  const [socketStatus, setSocketStatus] = useState('offline');
  const [isPolling, setIsPolling] = useState(enableAutoPolling);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const [dismissedAlertIds, setDismissedAlertIds] = useState(new Set());

  // Ref tracking whether component is mounted
  const isMountedRef = useRef(true);
  const hasLoadedOnceRef = useRef(false);

  // Fetch all operations datasets from REST APIs
  const fetchOperationsData = useCallback(async (isSilent = false) => {
    if (!isSilent && !hasLoadedOnceRef.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const [donRes, shlRes, rdrRes, asgRes, telRes] = await Promise.all([
        donationsService.getDonations({ forceMock }),
        sheltersService.getShelters({ forceMock }),
        ridersService.getRiders({ forceMock }),
        assignmentsService.getAssignments({ forceMock }),
        analyticsService.getTelemetry({ forceMock }).catch(() => ({ success: false, data: null }))
      ]);

      if (!isMountedRef.current) return;

      setDonations(donRes.data || []);
      setShelters(shlRes.data || []);
      setRiders(rdrRes.data || []);
      setAssignments(asgRes.data || []);
      if (telRes.data) setTelemetry(telRes.data);

      setLastSyncTime(new Date());
      hasLoadedOnceRef.current = true;
    } catch (err) {
      console.error('[LiveOperations] Fetch error:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to synchronize live operations data');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [forceMock]);

  // Initial load and forceMock reactivity
  useEffect(() => {
    isMountedRef.current = true;
    fetchOperationsData(false);

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchOperationsData]);

  // Socket.IO event listeners & auto re-sync on reconnect (Task 5 & Task 6)
  useEffect(() => {
    const handleStatusChange = (status) => {
      if (!isMountedRef.current) return;
      setSocketStatus(status);

      // Reconnect reconciliation (Task 6): If we reconnected, fetch fresh state
      if (status === 'connected' && hasLoadedOnceRef.current) {
        console.log('[LiveOperations] Socket reconnected. Reconciling latest state via REST API...');
        fetchOperationsData(true);
      }
    };

    connectSocket(handleStatusChange);

    // 1. Real-time Rider Location Updates (Task 1 & Task 9)
    const unsubLocation = subscribeToEvent(SOCKET_EVENTS.RIDER_LOCATION_BROADCAST, (data) => {
      if (!data?.riderId || !data?.currentLocation) return;
      setRiders((prev) =>
        prev.map((r) => {
          if (r.id === data.riderId || r.userId === data.riderId) {
            return {
              ...r,
              currentLocation: {
                ...r.currentLocation,
                ...data.currentLocation,
                updatedAt: new Date().toISOString()
              },
              // Respect Task 9: Clearly distinguish telemetry source
              telemetrySource: data.isLiveGps ? 'LIVE_DEVICE_GPS' : 'SIMULATED_CENTROID'
            };
          }
          return r;
        })
      );
    });

    // 2. Rider Status Updates
    const unsubRiderStatus = subscribeToEvent(SOCKET_EVENTS.RIDER_STATUS_CHANGED, (data) => {
      if (!data?.riderId) return;
      setRiders((prev) =>
        prev.map((r) =>
          r.id === data.riderId || r.userId === data.riderId
            ? { ...r, status: data.status, isAvailable: data.isAvailable }
            : r
        )
      );
    });

    // 3. Assignment State Transitions
    const unsubAsgState = subscribeToEvent(SOCKET_EVENTS.ASSIGNMENT_STATE_CHANGED, (data) => {
      if (!data?.assignmentId && !data?.id) return;
      const targetId = data.assignmentId || data.id;
      setAssignments((prev) => {
        const exists = prev.some((a) => a.id === targetId);
        if (exists) {
          return prev.map((a) =>
            a.id === targetId
              ? {
                  ...a,
                  status: data.newStatus || data.status || a.status,
                  timeline: { ...a.timeline, ...data.timeline }
                }
              : a
          );
        }
        return [data, ...prev];
      });
    });

    // 4. New Assignment Offered
    const unsubAsgOffered = subscribeToEvent(SOCKET_EVENTS.ASSIGNMENT_OFFERED, (data) => {
      if (!data?.id) return;
      setAssignments((prev) => [data, ...prev.filter((a) => a.id !== data.id)]);
    });

    // 5. New Surplus Donation Created
    const unsubDonationCreated = subscribeToEvent(SOCKET_EVENTS.DONATION_CREATED, (data) => {
      if (!data?.id) return;
      setDonations((prev) => [data, ...prev.filter((d) => d.id !== data.id)]);
    });

    // 6. Donation Reserved
    const unsubDonationReserved = subscribeToEvent(SOCKET_EVENTS.DONATION_RESERVED, (data) => {
      if (!data?.donation?.id) return;
      setDonations((prev) =>
        prev.map((d) => (d.id === data.donation.id ? { ...d, ...data.donation } : d))
      );
    });

    // 7. Shelter Capacity Updated
    const unsubShelterCapacity = subscribeToEvent(SOCKET_EVENTS.SHELTER_CAPACITY_UPDATED, (data) => {
      if (!data?.id) return;
      setShelters((prev) =>
        prev.map((s) => (s.id === data.id ? { ...s, ...data } : s))
      );
    });

    return () => {
      unsubLocation();
      unsubRiderStatus();
      unsubAsgState();
      unsubAsgOffered();
      unsubDonationCreated();
      unsubDonationReserved();
      unsubShelterCapacity();
      disconnectSocket(handleStatusChange);
    };
  }, [fetchOperationsData]);

  // Fallback Polling (Task 7): Polling when socket is offline or user enabled fallback
  useEffect(() => {
    if (!isPolling) return;

    // If socket is disconnected, poll more frequently (every 15s)
    // If socket is connected, fallback polling occurs at longer intervals (e.g. 45s) for safety
    const intervalMs = socketStatus === 'connected' ? Math.max(pollInterval, 45000) : pollInterval;

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchOperationsData(true);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPolling, socketStatus, pollInterval, fetchOperationsData]);

  // Compute live operational alerts dynamically (Task 4)
  const computedAlerts = computeOperationalAlerts(donations, shelters, riders, assignments);
  const activeAlerts = computedAlerts.filter((a) => !dismissedAlertIds.has(a.id));

  const dismissAlert = (alertId) => {
    setDismissedAlertIds((prev) => new Set([...prev, alertId]));
  };

  const manualRefresh = () => {
    return fetchOperationsData(false);
  };

  const transitionAssignmentState = async (assignmentId, targetStatus) => {
    try {
      const res = await assignmentsService.transitionAssignmentState(assignmentId, targetStatus, {
        forceMock
      });
      if (res.success && res.data) {
        setAssignments((prev) =>
          prev.map((a) => (a.id === assignmentId ? res.data : a))
        );
      }
      return res;
    } catch (err) {
      console.error('[LiveOperations] Transition error:', err);
      throw err;
    }
  };

  return {
    loading,
    refreshing,
    error,
    donations,
    shelters,
    riders,
    assignments,
    telemetry,
    alerts: activeAlerts,
    allAlertsCount: computedAlerts.length,
    dismissAlert,
    socketStatus,
    isPolling,
    setIsPolling,
    lastSyncTime,
    refresh: manualRefresh,
    transitionAssignmentState
  };
}
