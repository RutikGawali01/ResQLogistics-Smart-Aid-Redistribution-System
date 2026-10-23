import { apiClient } from './apiClient.js';
import { MOCK_ANALYTICS } from './mockData.js';

export const analyticsService = {
  async getTelemetry({ forceMock = false } = {}) {
    if (forceMock) {
      return { success: true, data: MOCK_ANALYTICS, isMock: true };
    }

    try {
      const res = await apiClient.get('/analytics/telemetry');
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch {
      return { success: true, data: MOCK_ANALYTICS, isMock: true };
    }
  }
};
