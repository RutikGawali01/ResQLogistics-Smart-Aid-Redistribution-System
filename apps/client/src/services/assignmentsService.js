import { apiClient } from './apiClient.js';
import { MOCK_ASSIGNMENTS } from './mockData.js';
import { canTransitionAssignment, ASSIGNMENT_STATUS } from '@aidflow/shared';

let inMemoryAssignments = [...MOCK_ASSIGNMENTS];

export const assignmentsService = {
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
    } catch {
      let filtered = [...inMemoryAssignments];
      if (status) filtered = filtered.filter((a) => a.status === status);
      if (riderId) filtered = filtered.filter((a) => a.riderId === riderId);
      if (shelterId) filtered = filtered.filter((a) => a.shelterId === shelterId);
      return { success: true, data: filtered, isMock: true };
    }
  },

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
    } catch {
      const item = inMemoryAssignments.find((a) => a.id === id);
      return item
        ? { success: true, data: item, isMock: true }
        : { success: false, error: 'Assignment not found', isMock: true };
    }
  },

  async transitionState(assignmentId, targetStatus, { reason, coordinates, forceMock = false } = {}) {
    const existing = inMemoryAssignments.find((a) => a.id === assignmentId);
    const currentStatus = existing ? existing.status : ASSIGNMENT_STATUS.UNASSIGNED;

    const validation = canTransitionAssignment(currentStatus, targetStatus);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.reason || 'Invalid state transition requested',
        isMock: forceMock
      };
    }

    if (forceMock) {
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
    } catch {
      // Graceful local fallback transition
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
            timeline: updatedTimeline
          };
        }
        return a;
      });

      const updated = inMemoryAssignments.find((a) => a.id === assignmentId);
      return { success: true, data: updated, isMock: true };
    }
  },

  async createAssignment(assignmentData, { forceMock = false } = {}) {
    if (forceMock) {
      const newAsg = {
        id: `asg_mock_${Date.now()}`,
        status: ASSIGNMENT_STATUS.PENDING_ACCEPTANCE,
        timeline: { assignedAt: new Date().toISOString() },
        ...assignmentData
      };
      inMemoryAssignments = [newAsg, ...inMemoryAssignments];
      return { success: true, data: newAsg, isMock: true };
    }

    try {
      const res = await apiClient.post('/assignments', assignmentData);
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch {
      const newAsg = {
        id: `asg_mock_${Date.now()}`,
        status: ASSIGNMENT_STATUS.PENDING_ACCEPTANCE,
        timeline: { assignedAt: new Date().toISOString() },
        ...assignmentData
      };
      inMemoryAssignments = [newAsg, ...inMemoryAssignments];
      return { success: true, data: newAsg, isMock: true };
    }
  }
};
