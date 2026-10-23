import { apiClient } from './apiClient.js';

export const eventsService = {
  /**
   * Fetches recent event history from the server.
   *
   * @param {Object} [options]
   * @param {string} [options.eventType]
   * @param {string} [options.entityType]
   * @param {string} [options.entityId]
   * @param {number} [options.limit=50]
   * @param {boolean} [options.forceMock=false]
   * @returns {Promise<{ success: boolean, data: Array, isMock: boolean }>}
   */
  async getEvents({ eventType, entityType, entityId, limit = 50, forceMock = false } = {}) {
    if (forceMock) {
      return { success: true, data: [], isMock: true };
    }

    try {
      const params = { limit };
      if (eventType) params.eventType = eventType;
      if (entityType) params.entityType = entityType;
      if (entityId) params.entityId = entityId;

      const res = await apiClient.get('/events', { params });
      return { success: true, data: res.data?.data || res.data || [], isMock: false };
    } catch {
      return { success: true, data: [], isMock: true };
    }
  },

  /**
   * Fetches administrative and system alerts.
   */
  async getAdminAlerts({ limit = 20, forceMock = false } = {}) {
    return this.getEvents({ eventType: 'ADMIN_ALERT', limit, forceMock });
  }
};
