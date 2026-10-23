import { apiClient } from './apiClient.js';
import { MOCK_ASSIGNMENTS } from './mockData.js';
import { canTransitionAssignment, ASSIGNMENT_STATUS } from '@aidflow/shared';

let inMemoryAssignments = [...MOCK_ASSIGNMENTS];

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
      return { success: true, data: filtered, isMock: true };
    }

    try {
      const params = {};
      if (status) params.status = status;
      if (riderId) params.riderId = riderId;
      if (shelterId) params.shelterId = shelterId;
      const res = await apiClient.get('/assignments', { params });
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch (err) {
      if (err.status >= 400 && err.status < 500) {
        return {
          success: false,
          error: err.message,
          code: err.code,
          status: err.status,
          details: err.details,
          isMock: false
        };
      }
      let filtered = [...inMemoryAssignments];
      if (status) filtered = filtered.filter((a) => a.status === status);
      if (riderId) filtered = filtered.filter((a) => a.riderId === riderId);
      if (shelterId) filtered = filtered.filter((a) => a.shelterId === shelterId);
      return { success: true, data: filtered, isMock: true, fallback: true };
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
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch (err) {
      if (err.status >= 400 && err.status < 500) {
        return {
          success: false,
          error: err.message,
          code: err.code,
          status: err.status,
          details: err.details,
          isMock: false
        };
      }
      const item = inMemoryAssignments.find((a) => a.id === id);
      return item
        ? { success: true, data: item, isMock: true, fallback: true }
        : { success: false, error: err.message || 'Assignment not found', isMock: false };
    }
  },

  /**
   * Transitions assignment through lifecycle state machine.
   * Calls PATCH /api/assignments/:id/state via Axios and surfaces server errors.
   */
  async transitionState(assignmentId, targetStatus, { reason, coordinates, forceMock = false } = {}) {
    if (forceMock) {
      const existing = inMemoryAssignments.find((a) => a.id === assignmentId);
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
      return { success: true, data: updated, isMock: true };
    }

    try {
      const res = await apiClient.patch(`/assignments/${assignmentId}/state`, {
        targetStatus,
        reason,
        coordinates
      });
      return { success: true, data: res.data?.data || res.data, isMock: false };
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
