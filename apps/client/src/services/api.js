import { apiClient } from './apiClient.js';
import { donationsService } from './donationsService.js';
import { sheltersService } from './sheltersService.js';
import { ridersService } from './ridersService.js';
import { assignmentsService } from './assignmentsService.js';
import { MOCK_DATA_COMPAT } from './mockCompat.js';

export const api = {
  /**
   * Health check query attempting live backend first, falling back to mock
   */
  async checkHealth(forceMock = false) {
    if (forceMock) return { success: true, data: MOCK_DATA_COMPAT.health, isMock: true };
    try {
      const res = await apiClient.get('/health', { timeout: 3000 });
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch {
      return { success: true, data: MOCK_DATA_COMPAT.health, isMock: true };
    }
  },

  async getDonations(forceMock = false) {
    return donationsService.getDonations({ forceMock });
  },

  async getShelters(forceMock = false) {
    return sheltersService.getShelters({ forceMock });
  },

  async getRiders(forceMock = false) {
    return ridersService.getRiders({ forceMock });
  },

  async getAssignments(forceMock = false) {
    return assignmentsService.getAssignments({ forceMock });
  },

  async transitionAssignmentState(assignmentId, targetStatus, forceMock = false) {
    return assignmentsService.transitionState(assignmentId, targetStatus, { forceMock });
  }
};

export default api;
