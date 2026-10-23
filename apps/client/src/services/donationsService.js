import { apiClient } from './apiClient.js';
import { MOCK_DONATIONS } from './mockData.js';

let inMemoryDonations = [...MOCK_DONATIONS];

export const donationsService = {
  async getDonations({ forceMock = false, category, status } = {}) {
    if (forceMock) {
      let filtered = [...inMemoryDonations];
      if (category) filtered = filtered.filter((d) => d.category === category);
      if (status) filtered = filtered.filter((d) => d.status === status);
      return { success: true, data: filtered, isMock: true };
    }

    try {
      const params = {};
      if (category) params.category = category;
      if (status) params.status = status;
      const res = await apiClient.get('/donations', { params });
      return { success: true, data: res.data?.data || res.data, isMock: false };
    } catch {
      // Clean fallback to mock data for resilience
      let filtered = [...inMemoryDonations];
      if (category) filtered = filtered.filter((d) => d.category === category);
      if (status) filtered = filtered.filter((d) => d.status === status);
      return { success: true, data: filtered, isMock: true };
    }
  },

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
    } catch {
      const item = inMemoryDonations.find((d) => d.id === id);
      return item
        ? { success: true, data: item, isMock: true }
        : { success: false, error: 'Donation not found', isMock: true };
    }
  },

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
    } catch {
      const newDonation = {
        id: `don_mock_${Date.now()}`,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString(),
        ...donationData
      };
      inMemoryDonations = [newDonation, ...inMemoryDonations];
      return { success: true, data: newDonation, isMock: true };
    }
  },

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
    } catch {
      inMemoryDonations = inMemoryDonations.map((d) =>
        d.id === id ? { ...d, ...updateData, updatedAt: new Date().toISOString() } : d
      );
      const updated = inMemoryDonations.find((d) => d.id === id);
      return { success: true, data: updated, isMock: true };
    }
  }
};
