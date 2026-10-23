import { apiClient } from './apiClient.js';
import { MOCK_ASSIGNMENTS } from './mockData.js';
import { canTransitionAssignment, ASSIGNMENT_STATUS } from '@aidflow/shared';

let inMemoryAssignments = [...MOCK_ASSIGNMENTS];

/**
 * Normalizes an assignment document to ensure shelterName, donationTitle, riderName,
 * and string IDs are always populated, preventing raw Mongoose populated objects
 * from being rendered as React children.
 */
export function normalizeAssignment(a) {
  if (!a || typeof a !== 'object') return a;

  const shelterObj = typeof a.shelterId === 'object' && a.shelterId !== null ? a.shelterId : null;
  const donationObj = typeof a.donationId === 'object' && a.donationId !== null ? a.donationId : null;
  const riderObj = typeof a.riderId === 'object' && a.riderId !== null ? a.riderId : null;

  const shelterName =
    a.shelterName ||
    shelterObj?.name ||
    'Downtown Hope Refuge';

  const donationTitle =
    a.donationTitle ||
    donationObj?.title ||
    donationObj?.aidType ||
    'Surplus Aid Package';

  const riderName =
    a.riderName ||
    riderObj?.name ||
    null;

  const pickupLocation = a.pickupLocation || donationObj?.pickupLocation || {
    address: 'Pickup Depot',
    latitude: 37.7749,
    longitude: -122.4194
  };

  const deliveryLocation = a.deliveryLocation || {
    address: shelterObj?.address || shelterObj?.location?.address || 'Shelter Intake Dock',
    latitude: shelterObj?.location?.latitude || 37.789,
    longitude: shelterObj?.location?.longitude || -122.401
  };

  return {
    ...a,
    id: a.id || a._id,
    shelterName,
    donationTitle,
    riderName,
    pickupLocation,
    deliveryLocation,
    shelterId: shelterObj ? (shelterObj.id || shelterObj._id) : a.shelterId,
    donationId: donationObj ? (donationObj.id || donationObj._id) : a.donationId,
    riderId: riderObj ? (riderObj.id || riderObj._id) : a.riderId,
    shelter: shelterObj || a.shelter,
    donation: donationObj || a.donation,
    rider: riderObj || a.rider
  };
}

export const assignmentsService = {
  /**
   * Retrieves delivery assignments.
   * Calls GET /api/assignments via Axios when not forced to mock.
   */
  async getAssignments({ forceMock = false, status, riderId, shelterId } = {}) {
    if (forceMock) {
      let filtered = [...inMemoryAssignments];
      if (status) filtered = filtered.filter((a) => a.status === status);
      if (riderId) filtered = filtered.filter((a) => a.riderId === riderId);
      if (shelterId) filtered = filtered.filter((a) => a.shelterId === shelterId);
      return { success: true, data: filtered.map(normalizeAssignment), isMock: true };
    }

    try {
      const params = {};
      if (status) params.status = status;
      if (riderId) params.riderId = riderId;
      if (shelterId) params.shelterId = shelterId;
      const res = await apiClient.get('/assignments', { params });
      const raw = res.data?.data || res.data || [];
      const normalized = Array.isArray(raw) ? raw.map(normalizeAssignment) : raw;
      return { success: true, data: normalized, isMock: false };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to retrieve assignments',
        code: err.code || 'REQUEST_FAILED',
        status: err.status || 500,
        details: err.details || null,
        isMock: false
      };
    }
  },

  /**
   * Retrieves single assignment by ID.
   */
  async getAssignmentById(id, { forceMock = false } = {}) {
    if (forceMock) {
      const item = inMemoryAssignments.find((a) => a.id === id);
      return item
        ? { success: true, data: item, isMock: true }
        : { success: false, error: 'Assignment not found', isMock: true };
    }

    try {
      const res = await apiClient.get(`/assignments/${id}`);
      const raw = res.data?.data || res.data;
      return { success: true, data: normalizeAssignment(raw), isMock: false };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to retrieve assignment',
        code: err.code || 'REQUEST_FAILED',
        status: err.status || 500,
        details: err.details || null,
        isMock: false
      };
    }
  },

  /**
   * Transitions assignment through lifecycle state machine.
   * Calls PATCH /api/assignments/:id/state via Axios and surfaces server errors.
   */
  async transitionState(assignmentId, targetStatus, { reason, coordinates, forceMock = false } = {}) {
    const existing = inMemoryAssignments.find((a) => a.id === assignmentId);

    if (forceMock) {
      const currentStatus = existing ? existing.status : ASSIGNMENT_STATUS.UNASSIGNED;
      const validation = canTransitionAssignment(currentStatus, targetStatus);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.reason || 'Invalid state transition requested',
          code: 'INVALID_STATE_TRANSITION',
          status: 400,
          isMock: true
        };
      }

      const now = new Date().toISOString();
      inMemoryAssignments = inMemoryAssignments.map((a) => {
        if (a.id === assignmentId) {
          const updatedTimeline = { ...a.timeline };
          if (targetStatus === ASSIGNMENT_STATUS.ACCEPTED) updatedTimeline.acceptedAt = now;
          if (targetStatus === ASSIGNMENT_STATUS.PICKED_UP) updatedTimeline.pickedUpAt = now;
          if (targetStatus === ASSIGNMENT_STATUS.DELIVERED) updatedTimeline.deliveredAt = now;
          if (targetStatus === ASSIGNMENT_STATUS.CANCELLED) updatedTimeline.cancelledAt = now;

          return {
            ...a,
            status: targetStatus,
            timeline: updatedTimeline,
            notes: reason ? `${a.notes || ''} [Transition note: ${reason}]`.trim() : a.notes
          };
        }
        return a;
      });

      const updated = inMemoryAssignments.find((a) => a.id === assignmentId);
      return { success: true, data: normalizeAssignment(updated), isMock: true };
    }

    try {
      const res = await apiClient.patch(`/assignments/${assignmentId}/state`, {
        targetStatus,
        reason,
        coordinates
      });
      const raw = res.data?.data || res.data;
      return { success: true, data: normalizeAssignment(raw), isMock: false };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'State transition rejected by server',
        code: err.code || 'INVALID_STATE_TRANSITION',
        status: err.status || 400,
        details: err.details || null,
        isMock: false
      };
    }
  },

  /**
   * Helper alias for transitionState.
   */
  async transitionAssignmentState(assignmentId, targetStatus, options = {}) {
    return this.transitionState(assignmentId, targetStatus, options);
  }
};
