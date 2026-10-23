import { apiClient } from './apiClient.js';
import { MOCK_SHELTERS } from './mockData.js';

let inMemoryShelters = [...MOCK_SHELTERS];

export const sheltersService = {
  async getShelters({ forceMock = false, urgency } = {}) {
    if (forceMock) {
      let filtered = [...inMemoryShelters];
      if (urgency) filtered = filtered.filter((s) => s.urgencyLevel === urgency);
      return { success: true, data: filtered, isMock: true };
    }

    try {
      const params = urgency ? { urgency } : {};
      const res = await apiClient.get('/shelters', { params });
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch {
      let filtered = [...inMemoryShelters];
      if (urgency) filtered = filtered.filter((s) => s.urgencyLevel === urgency);
      return { success: true, data: filtered, isMock: true };
    }
  },

  async getShelterById(id, { forceMock = false } = {}) {
    if (forceMock) {
      const item = inMemoryShelters.find((s) => s.id === id);
      return item
        ? { success: true, data: item, isMock: true }
        : { success: false, error: 'Shelter not found', isMock: true };
    }

    try {
      const res = await apiClient.get(`/shelters/${id}`);
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch {
      const item = inMemoryShelters.find((s) => s.id === id);
      return item
        ? { success: true, data: item, isMock: true }
        : { success: false, error: 'Shelter not found', isMock: true };
    }
  },

  async updateCapacity(id, capacityUpdate, { forceMock = false } = {}) {
    if (forceMock) {
      inMemoryShelters = inMemoryShelters.map((s) =>
        s.id === id ? { ...s, capacity: { ...s.capacity, ...capacityUpdate } } : s
      );
      const updated = inMemoryShelters.find((s) => s.id === id);
      return { success: true, data: updated, isMock: true };
    }

    try {
      const res = await apiClient.patch(`/shelters/${id}/capacity`, capacityUpdate);
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch {
      inMemoryShelters = inMemoryShelters.map((s) =>
        s.id === id ? { ...s, capacity: { ...s.capacity, ...capacityUpdate } } : s
      );
      const updated = inMemoryShelters.find((s) => s.id === id);
      return { success: true, data: updated, isMock: true };
    }
  },

  async updateUrgency(id, urgencyLevel, { forceMock = false } = {}) {
    if (forceMock) {
      inMemoryShelters = inMemoryShelters.map((s) =>
        s.id === id ? { ...s, urgencyLevel } : s
      );
      const updated = inMemoryShelters.find((s) => s.id === id);
      return { success: true, data: updated, isMock: true };
    }

    try {
      const res = await apiClient.patch(`/shelters/${id}/urgency`, { urgencyLevel });
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch {
      inMemoryShelters = inMemoryShelters.map((s) =>
        s.id === id ? { ...s, urgencyLevel } : s
      );
      const updated = inMemoryShelters.find((s) => s.id === id);
      return { success: true, data: updated, isMock: true };
    }
  }
};
