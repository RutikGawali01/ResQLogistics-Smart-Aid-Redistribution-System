import { apiClient } from './apiClient.js';
import { MOCK_DONATIONS } from './mockData.js';

let inMemoryDonations = [...MOCK_DONATIONS];

export const donationsService = {
  /**
   * Retrieves surplus donations.
   * Calls GET /api/donations via Axios when not forced to mock.
   */
  async getDonations({ forceMock = false, category, status, donorId } = {}) {
    if (forceMock) {
      let filtered = [...inMemoryDonations];
      if (category) filtered = filtered.filter((d) => d.category === category || d.aidType === category);
      if (status) filtered = filtered.filter((d) => d.status === status);
      if (donorId) filtered = filtered.filter((d) => d.donorId === donorId);
      return { success: true, data: filtered, isMock: true };
    }

    try {
      const params = {};
      if (category) params.category = category;
      if (status) params.status = status;
      if (donorId) params.donorId = donorId;
      const res = await apiClient.get('/donations', { params });
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to retrieve donations',
        code: err.code || 'REQUEST_FAILED',
        status: err.status || 500,
        details: err.details || null,
        isMock: false
      };
    }
  },

  /**
   * Retrieves single donation by ID.
   */
  async getDonationById(id, { forceMock = false } = {}) {
    if (forceMock) {
      const item = inMemoryDonations.find((d) => d.id === id);
      return item
        ? { success: true, data: item, isMock: true }
        : { success: false, error: 'Donation not found', isMock: true };
    }

    try {
      const res = await apiClient.get(`/donations/${id}`);
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to retrieve donation',
        code: err.code || 'REQUEST_FAILED',
        status: err.status || 500,
        details: err.details || null,
        isMock: false
      };
    }
  },

  /**
   * Registers a new surplus aid donation.
   * Calls POST /api/donations via Axios and surfaces server validation/conflict errors.
   */
  async createDonation(donationData, { forceMock = false } = {}) {
    if (forceMock) {
      const newDonation = {
        id: `don_mock_${Date.now()}`,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString(),
        ...donationData
      };
      inMemoryDonations = [newDonation, ...inMemoryDonations];
      return { success: true, data: newDonation, isMock: true };
    }

    try {
      const res = await apiClient.post('/donations', donationData);
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch (err) {
      // Surface validation, conflict, or permission errors directly
      return {
        success: false,
        error: err.message || 'Failed to create donation on server',
        code: err.code || 'VALIDATION_ERROR',
        status: err.status || 422,
        details: err.details || null,
        isMock: false
      };
    }
  },

  /**
   * Updates an existing donation.
   */
  async updateDonation(id, updateData, { forceMock = false } = {}) {
    if (forceMock) {
      inMemoryDonations = inMemoryDonations.map((d) =>
        d.id === id ? { ...d, ...updateData, updatedAt: new Date().toISOString() } : d
      );
      const updated = inMemoryDonations.find((d) => d.id === id);
      return { success: true, data: updated, isMock: true };
    }

    try {
      const res = await apiClient.patch(`/donations/${id}`, updateData);
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to update donation',
        code: err.code,
        status: err.status,
        details: err.details,
        isMock: false
      };
    }
  },

  /**
   * Reserves surplus aid for a shelter.
   * Calls POST /api/donations/:id/reserve via Axios.
   */
  async reserveDonation(id, { shelterId, requestedQuantity, quantity } = {}, { forceMock = false } = {}) {
    const qty = Number(requestedQuantity || quantity);
    if (forceMock) {
      const item = inMemoryDonations.find((d) => d.id === id);
      if (!item) return { success: false, error: 'Donation not found', isMock: true };
      const currentAvail = item.availableQuantity !== undefined ? item.availableQuantity : item.quantity;
      item.availableQuantity = Math.max(0, currentAvail - (qty || currentAvail));
      if (item.availableQuantity === 0) item.status = 'RESERVED';
      return {
        success: true,
        data: {
          donation: item,
          reservation: { id: `res_${Date.now()}`, quantity: qty || currentAvail, shelterId }
        },
        isMock: true
      };
    }

    try {
      const payload = {
        shelterId,
        requestedQuantity: qty,
        title
      };
      const res = await apiClient.post(`/donations/${id}/reserve`, payload);
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to reserve donation',
        code: err.code,
        status: err.status,
        details: err.details,
        isMock: false
      };
    }
  }
};
