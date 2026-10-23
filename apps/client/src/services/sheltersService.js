import { apiClient } from './apiClient.js';
import { MOCK_SHELTERS } from './mockData.js';

let inMemoryShelters = [...MOCK_SHELTERS];

export const sheltersService = {
  /**
   * Retrieves list of shelters.
   * Calls GET /api/shelters via Axios when not forced to mock.
   */
  async getShelters({ forceMock = false, urgency, isOpen } = {}) {
    if (forceMock) {
      let filtered = [...inMemoryShelters];
      if (urgency) filtered = filtered.filter((s) => s.urgencyLevel === urgency);
      if (isOpen !== undefined) filtered = filtered.filter((s) => s.isOpen === isOpen || s.active === isOpen);
      return { success: true, data: filtered, isMock: true };
    }

    try {
      const params = {};
      if (urgency) params.urgency = urgency;
      if (isOpen !== undefined) params.isOpen = isOpen;
      const res = await apiClient.get('/shelters', { params });
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to retrieve shelters',
        code: err.code || 'REQUEST_FAILED',
        status: err.status || 500,
        details: err.details || null,
        isMock: false
      };
    }
  },

  /**
   * Retrieves single shelter by ID.
   */
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
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to retrieve shelter',
        code: err.code || 'REQUEST_FAILED',
        status: err.status || 500,
        details: err.details || null,
        isMock: false
      };
    }
  },

  /**
   * Updates shelter bed/meal capacity.
   * Calls PATCH /api/shelters/:id/capacity via Axios.
   */
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
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to update shelter capacity on server',
        code: err.code || 'VALIDATION_ERROR',
        status: err.status || 422,
        details: err.details || null,
        isMock: false
      };
    }
  },

  /**
   * Updates shelter demand.
   * Calls PATCH /api/shelters/:id/demand via Axios.
   */
  async updateDemand(id, demandUpdate, { forceMock = false } = {}) {
    if (forceMock) {
      inMemoryShelters = inMemoryShelters.map((s) =>
        s.id === id ? { ...s, ...demandUpdate } : s
      );
      const updated = inMemoryShelters.find((s) => s.id === id);
      return { success: true, data: updated, isMock: true };
    }

    try {
      const res = await apiClient.patch(`/shelters/${id}/demand`, demandUpdate);
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to update shelter demand',
        code: err.code || 'VALIDATION_ERROR',
        status: err.status || 422,
        details: err.details || null,
        isMock: false
      };
    }
  },

  /**
   * Updates shelter intake status (open/close) and urgency.
   * Calls PATCH /api/shelters/:id/status via Axios.
   */
  async updateStatus(id, statusUpdate, { forceMock = false } = {}) {
    if (forceMock) {
      inMemoryShelters = inMemoryShelters.map((s) =>
        s.id === id ? { ...s, ...statusUpdate, isOpen: statusUpdate.isOpen, active: statusUpdate.isOpen } : s
      );
      const updated = inMemoryShelters.find((s) => s.id === id);
      return { success: true, data: updated, isMock: true };
    }

    try {
      const res = await apiClient.patch(`/shelters/${id}/status`, statusUpdate);
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to update shelter intake status',
        code: err.code,
        status: err.status,
        details: err.details,
        isMock: false
      };
    }
  },

  /**
   * Updates shelter urgency level.
   */
  async updateUrgency(id, urgencyLevel, { forceMock = false } = {}) {
    if (forceMock) {
      inMemoryShelters = inMemoryShelters.map((s) =>
        s.id === id ? { ...s, urgencyLevel } : s
      );
      const updated = inMemoryShelters.find((s) => s.id === id);
      return { success: true, data: updated, isMock: true };
    }

    try {
      const res = await apiClient.patch(`/shelters/${id}/capacity`, { urgencyLevel });
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to update shelter urgency',
        code: err.code,
        status: err.status,
        details: err.details,
        isMock: false
      };
    }
  },

  async updateStatus(id, { isOpen, urgencyLevel }, { forceMock = false } = {}) {
    if (forceMock) {
      inMemoryShelters = inMemoryShelters.map((s) => {
        if (s.id === id) {
          const updated = { ...s };
          if (isOpen !== undefined) updated.isOpen = isOpen;
          if (urgencyLevel) updated.urgencyLevel = urgencyLevel;
          return updated;
        }
        return s;
      });
      const updated = inMemoryShelters.find((s) => s.id === id);
      return { success: true, data: updated, isMock: true };
    }

    try {
      const payload = {};
      if (isOpen !== undefined) payload.isOpen = isOpen;
      if (urgencyLevel) payload.urgencyLevel = urgencyLevel;
      const res = await apiClient.patch(`/shelters/${id}/status`, payload);
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch {
      inMemoryShelters = inMemoryShelters.map((s) => {
        if (s.id === id) {
          const updated = { ...s };
          if (isOpen !== undefined) updated.isOpen = isOpen;
          if (urgencyLevel) updated.urgencyLevel = urgencyLevel;
          return updated;
        }
        return s;
      });
      const updated = inMemoryShelters.find((s) => s.id === id);
      return { success: true, data: updated, isMock: true };
    }
  },

  async updateDemand(id, { currentDemand, receivingCapacity, mealsNeededPerDay }, { forceMock = false } = {}) {
    if (forceMock) {
      inMemoryShelters = inMemoryShelters.map((s) => {
        if (s.id === id) {
          const updated = { ...s };
          if (currentDemand !== undefined) updated.currentDemand = currentDemand;
          if (receivingCapacity !== undefined) updated.receivingCapacity = receivingCapacity;
          return updated;
        }
        return s;
      });
      const updated = inMemoryShelters.find((s) => s.id === id);
      return { success: true, data: updated, isMock: true };
    }

    try {
      const payload = {};
      if (currentDemand !== undefined) payload.currentDemand = currentDemand;
      if (receivingCapacity !== undefined) payload.receivingCapacity = receivingCapacity;
      if (mealsNeededPerDay !== undefined) payload.mealsNeededPerDay = mealsNeededPerDay;
      const res = await apiClient.patch(`/shelters/${id}/demand`, payload);
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch {
      inMemoryShelters = inMemoryShelters.map((s) => {
        if (s.id === id) {
          const updated = { ...s };
          if (currentDemand !== undefined) updated.currentDemand = currentDemand;
          if (receivingCapacity !== undefined) updated.receivingCapacity = receivingCapacity;
          return updated;
        }
        return s;
      });
      const updated = inMemoryShelters.find((s) => s.id === id);
      return { success: true, data: updated, isMock: true };
    }
  }
};
