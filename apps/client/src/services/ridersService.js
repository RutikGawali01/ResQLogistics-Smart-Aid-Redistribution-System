import { apiClient } from './apiClient.js';
import { MOCK_RIDERS } from './mockData.js';

let inMemoryRiders = [...MOCK_RIDERS];

export const ridersService = {
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
    } catch {
      let filtered = [...inMemoryRiders];
      if (status) filtered = filtered.filter((r) => r.status === status);
      if (vehicleType) filtered = filtered.filter((r) => r.vehicleType === vehicleType);
      return { success: true, data: filtered, isMock: true };
    }
  },

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
    } catch {
      const item = inMemoryRiders.find((r) => r.id === id || r.userId === id);
      return item
        ? { success: true, data: item, isMock: true }
        : { success: false, error: 'Rider not found', isMock: true };
    }
  },

  async updateStatus(id, status, { forceMock = false } = {}) {
    if (forceMock) {
      inMemoryRiders = inMemoryRiders.map((r) =>
        r.id === id || r.userId === id ? { ...r, status } : r
      );
      const updated = inMemoryRiders.find((r) => r.id === id || r.userId === id);
      return { success: true, data: updated, isMock: true };
    }

    try {
      const res = await apiClient.patch(`/riders/${id}/status`, { status });
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch {
      inMemoryRiders = inMemoryRiders.map((r) =>
        r.id === id || r.userId === id ? { ...r, status } : r
      );
      const updated = inMemoryRiders.find((r) => r.id === id || r.userId === id);
      return { success: true, data: updated, isMock: true };
    }
  },

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
      const res = await apiClient.post(`/riders/${id}/telemetry`, coordinates);
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch {
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
  }
};
