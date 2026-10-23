import { ASSIGNMENT_STATUS } from '@aidflow/shared';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Mock datasets for independent frontend development
const MOCK_DATA = {
  health: {
    status: 'healthy',
    service: 'aidflow-mock-adapter',
    database: 'simulated',
    socketIO: 'simulated'
  },
  donations: [
    {
      id: 'don_mock_01',
      title: 'Artisan Sourdough & Pastries',
      category: 'BAKERY',
      quantity: 35,
      unit: 'loaves',
      storageRequirement: 'ROOM_TEMPERATURE',
      expirationDate: new Date(Date.now() + 86400000 * 2).toISOString(),
      pickupLocation: {
        address: '220 Market St, San Francisco, CA',
        latitude: 37.7925,
        longitude: -122.3995,
        contactName: 'Golden Grain Bakery'
      },
      status: 'AVAILABLE'
    },
    {
      id: 'don_mock_02',
      title: 'Fresh Organic Greens & Fruits',
      category: 'PRODUCE',
      quantity: 80,
      unit: 'kg',
      storageRequirement: 'REFRIGERATED',
      expirationDate: new Date(Date.now() + 86400000).toISOString(),
      pickupLocation: {
        address: '580 Valencia St, San Francisco, CA',
        latitude: 37.7645,
        longitude: -122.4215,
        contactName: 'Mission Organics'
      },
      status: 'AVAILABLE'
    }
  ],
  shelters: [
    {
      id: 'shl_mock_01',
      name: 'Downtown Hope Refuge',
      address: '100 Mission St, San Francisco, CA',
      location: { latitude: 37.7915, longitude: -122.3980 },
      capacity: { currentOccupancy: 85, maxCapacity: 100, mealsNeededPerDay: 150 },
      urgencyLevel: 'HIGH',
      acceptedCategories: ['PERISHABLE', 'PREPARED_MEALS', 'PRODUCE']
    },
    {
      id: 'shl_mock_02',
      name: 'St. Jude Community Center',
      address: '450 Castro St, San Francisco, CA',
      location: { latitude: 37.7609, longitude: -122.4350 },
      capacity: { currentOccupancy: 30, maxCapacity: 60, mealsNeededPerDay: 80 },
      urgencyLevel: 'MEDIUM',
      acceptedCategories: ['NON_PERISHABLE', 'CLOTHING', 'HYGIENE']
    }
  ],
  riders: [
    {
      id: 'rdr_mock_01',
      name: 'Carlos Ruiz',
      vehicleType: 'E_BIKE',
      status: 'AVAILABLE',
      currentLocation: { latitude: 37.7790, longitude: -122.4100 }
    },
    {
      id: 'rdr_mock_02',
      name: 'Maya Patel',
      vehicleType: 'VAN',
      status: 'AVAILABLE',
      currentLocation: { latitude: 37.7850, longitude: -122.4000 }
    }
  ],
  assignments: [
    {
      id: 'asg_mock_01',
      donationId: 'don_mock_01',
      shelterId: 'shl_mock_01',
      riderId: 'rdr_mock_01',
      status: ASSIGNMENT_STATUS.PENDING_ACCEPTANCE,
      pickupLocation: {
        address: '220 Market St, San Francisco',
        latitude: 37.7925,
        longitude: -122.3995
      },
      deliveryLocation: {
        address: '100 Mission St, San Francisco',
        latitude: 37.7915,
        longitude: -122.3980
      },
      timeline: { assignedAt: new Date().toISOString() }
    }
  ]
};

export const api = {
  /**
   * Health check query attempting live backend first, falling back to mock
   */
  async checkHealth(forceMock = false) {
    if (forceMock) return { success: true, data: MOCK_DATA.health, isMock: true };
    try {
      const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return { ...json, isMock: false };
    } catch {
      return { success: true, data: MOCK_DATA.health, isMock: true };
    }
  },

  async getDonations(forceMock = false) {
    if (forceMock) return { success: true, data: MOCK_DATA.donations, isMock: true };
    try {
      const res = await fetch(`${BASE_URL}/donations`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return { ...json, isMock: false };
    } catch {
      return { success: true, data: MOCK_DATA.donations, isMock: true };
    }
  },

  async getShelters(forceMock = false) {
    if (forceMock) return { success: true, data: MOCK_DATA.shelters, isMock: true };
    try {
      const res = await fetch(`${BASE_URL}/shelters`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return { ...json, isMock: false };
    } catch {
      return { success: true, data: MOCK_DATA.shelters, isMock: true };
    }
  },

  async getRiders(forceMock = false) {
    if (forceMock) return { success: true, data: MOCK_DATA.riders, isMock: true };
    try {
      const res = await fetch(`${BASE_URL}/riders`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return { ...json, isMock: false };
    } catch {
      return { success: true, data: MOCK_DATA.riders, isMock: true };
    }
  },

  async getAssignments(forceMock = false) {
    if (forceMock) return { success: true, data: MOCK_DATA.assignments, isMock: true };
    try {
      const res = await fetch(`${BASE_URL}/assignments`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return { ...json, isMock: false };
    } catch {
      return { success: true, data: MOCK_DATA.assignments, isMock: true };
    }
  },

  async transitionAssignmentState(assignmentId, targetStatus, forceMock = false) {
    if (forceMock) {
      const asg = MOCK_DATA.assignments.find(a => a.id === assignmentId) || MOCK_DATA.assignments[0];
      asg.status = targetStatus;
      return { success: true, data: asg, isMock: true };
    }
    const res = await fetch(`${BASE_URL}/assignments/${assignmentId}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetStatus })
    });
    return await res.json();
  }
};
