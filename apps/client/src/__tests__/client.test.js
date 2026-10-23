import { describe, it, expect } from 'vitest';
import { api } from '../services/api.js';
import { ALL_ROLES } from '@aidflow/shared';

describe('AidFlow Client Foundation Tests', () => {
  it('falls back cleanly to mock data when backend is decoupled', async () => {
    const health = await api.checkHealth(true);
    expect(health.success).toBe(true);
    expect(health.isMock).toBe(true);
    expect(health.data.status).toBe('healthy');
  });

  it('provides seed donations in decoupled mode', async () => {
    const donations = await api.getDonations(true);
    expect(donations.success).toBe(true);
    expect(donations.data.length).toBeGreaterThan(0);
    expect(donations.data[0].pickupLocation.latitude).toBeDefined();
  });

  it('verifies all 4 roles are known on the frontend', () => {
    expect(ALL_ROLES).toHaveLength(4);
    expect(ALL_ROLES).toContain('ADMIN');
    expect(ALL_ROLES).toContain('DONOR');
    expect(ALL_ROLES).toContain('RIDER');
    expect(ALL_ROLES).toContain('SHELTER_MANAGER');
  });
});
