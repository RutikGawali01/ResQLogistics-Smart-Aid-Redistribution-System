import { apiClient } from './apiClient.js';
import { MOCK_RIDERS } from './mockData.js';

let inMemoryRiders = [...MOCK_RIDERS];

export const ridersService = {
  /**
   * Retrieves list of couriers.
   * Calls GET /api/riders via Axios when not forced to mock.
   */
  async getRiders({ forceMock = false, status, vehicleType } = {}) {
    if (forceMock) {
      let filtered = [...inMemoryRiders];
      if (status) filtered = filtered.filter((r) => r.status === status);
      if (vehicleType) filtered = filtered.filter((r) => r.vehicleType === vehicleType);
      return { success: true, data: filtered, isMock: true };
    }

    try {
      const params = {};
      if (status) params.status = status;
      if (vehicleType) params.vehicleType = vehicleType;
      const res = await apiClient.get('/riders', { params });
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
      let filtered = [...inMemoryRiders];
      if (status) filtered = filtered.filter((r) => r.status === status);
      if (vehicleType) filtered = filtered.filter((r) => r.vehicleType === vehicleType);
      return { success: true, data: filtered, isMock: true, fallback: true };
    }
  },

  /**
   * Retrieves courier by ID or userId.
   * Calls GET /api/riders/:id via Axios.
   */
  async getRiderById(id, { forceMock = false } = {}) {
    if (forceMock) {
      const item = inMemoryRiders.find((r) => r.id === id || r.userId === id);
      return item
        ? { success: true, data: item, isMock: true }
        : { success: false, error: 'Rider not found', isMock: true };
    }

    try {
      const res = await apiClient.get(`/riders/${id}`);
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
      const item = inMemoryRiders.find((r) => r.id === id || r.userId === id);
      return item
        ? { success: true, data: item, isMock: true, fallback: true }
        : { success: false, error: err.message || 'Rider not found', isMock: false };
    }
  },

  /**
   * Updates courier dispatch availability and status.
   * Calls PATCH /api/riders/:id/availability via Axios.
   */
  async updateStatus(id, status, { forceMock = false } = {}) {
    if (forceMock) {
      inMemoryRiders = inMemoryRiders.map((r) =>
        r.id === id || r.userId === id ? { ...r, status, isAvailable: status === 'AVAILABLE' } : r
      );
      const updated = inMemoryRiders.find((r) => r.id === id || r.userId === id);
      return { success: true, data: updated, isMock: true };
    }

    try {
      const isAvailable = status === 'AVAILABLE';
      const res = await apiClient.patch(`/riders/${id}/availability`, {
        status,
        isAvailable
      });
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to update courier status on server',
        code: err.code,
        status: err.status,
        details: err.details,
        isMock: false
      };
    }
  },

  /**
   * Updates courier live GPS location.
   * Calls POST /api/riders/:id/location via Axios.
   */
  async updateLocation(id, coordinates, { forceMock = false } = {}) {
    if (forceMock) {
      inMemoryRiders = inMemoryRiders.map((r) =>
        r.id === id || r.userId === id
          ? {
              ...r,
              currentLocation: {
                ...r.currentLocation,
                ...coordinates,
                updatedAt: new Date().toISOString()
              }
            }
          : r
      );
      const updated = inMemoryRiders.find((r) => r.id === id || r.userId === id);
      return { success: true, data: updated, isMock: true };
    }

    try {
      const res = await apiClient.post(`/riders/${id}/location`, coordinates);
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to update courier location on server',
        code: err.code,
        status: err.status,
        details: err.details,
        isMock: false
      };
    }
  }
};
