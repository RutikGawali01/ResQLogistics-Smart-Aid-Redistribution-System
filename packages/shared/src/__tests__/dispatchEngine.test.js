import { describe, it, expect } from 'vitest';
import {
  calculateDispatchAllocations,
  calculateDistanceKm,
  validateHandlingCompatibility,
  validateSafetyDeadline,
  rankAllocationScore,
  DISPATCH_REJECTION_CODES
} from '../dispatch/dispatchEngine.js';

describe('AidFlow Dispatch Engine Suite', () => {
  const baseTime = new Date('2026-10-23T12:00:00.000Z');

  describe('1. 180-Meal Donation Split Across Multiple Shelters and Couriers', () => {
    it('splits a 180-meal donation across multiple riders respecting individual capacity and reconciles quantities', () => {
      const donation = {
        id: 'don_180',
        title: 'Fresh Prepared Lunch Meals',
        aidType: 'PREPARED_MEALS',
        availableQuantity: 180,
        quantity: 180,
        unit: 'MEALS',
        storageRequirement: 'ROOM_TEMPERATURE',
        safeUseDeadline: new Date(baseTime.getTime() + 4 * 3600000).toISOString(), // 4 hours
        pickupLocation: { latitude: 37.7749, longitude: -122.4194, address: 'Community Kitchen' }
      };

      const shelters = [
        {
          id: 'shl_urgent_alpha',
          name: 'Downtown Safe Haven',
          isOpen: true,
          currentDemand: 100,
          receivingCapacity: 120,
          urgencyLevel: 'CRITICAL',
          availableResources: ['ROOM_TEMPERATURE', 'REFRIGERATION'],
          location: { latitude: 37.7833, longitude: -122.4167, address: 'Mission St Shelter' }
        },
        {
          id: 'shl_beta',
          name: 'East Bay Care Shelter',
          isOpen: true,
          currentDemand: 100,
          receivingCapacity: 100,
          urgencyLevel: 'MEDIUM',
          availableResources: ['ROOM_TEMPERATURE'],
          location: { latitude: 37.7900, longitude: -122.4000, address: 'East Bay Hub' }
        }
      ];

      const riders = [
        {
          id: 'rider_cargo_1',
          name: 'Alex Rivera',
          isAvailable: true,
          status: 'AVAILABLE',
          capacity: 50,
          availableCapacity: 50,
          vehicleType: 'CARGO_BIKE',
          currentLocation: { latitude: 37.7750, longitude: -122.4190 }
        },
        {
          id: 'rider_cargo_2',
          name: 'Jordan Smith',
          isAvailable: true,
          status: 'AVAILABLE',
          capacity: 60,
          availableCapacity: 60,
          vehicleType: 'VAN',
          currentLocation: { latitude: 37.7760, longitude: -122.4200 }
        },
        {
          id: 'rider_cargo_3',
          name: 'Taylor Chen',
          isAvailable: true,
          status: 'AVAILABLE',
          capacity: 70,
          availableCapacity: 70,
          vehicleType: 'VAN',
          currentLocation: { latitude: 37.7740, longitude: -122.4180 }
        }
      ];

      const result = calculateDispatchAllocations({
        donations: donation,
        shelters,
        riders,
        options: { currentTime: baseTime }
      });

      expect(result.success).toBe(true);
      expect(result.plans.length).toBeGreaterThanOrEqual(3);

      // Total allocated meals must exactly equal 180
      expect(result.metrics.allocatedTotal).toBe(180);
      expect(result.metrics.unallocatedTotal).toBe(0);
      expect(result.metrics.reconciled).toBe(true);
      expect(result.metrics.initialAvailableQuantity).toBe(180);

      // Verify each leg never exceeds the rider's individual capacity
      const riderCapMap = { rider_cargo_1: 50, rider_cargo_2: 60, rider_cargo_3: 70 };
      const riderAllocatedMap = {};

      for (const leg of result.plans) {
        expect(leg.allocatedQuantity).toBeGreaterThan(0);
        riderAllocatedMap[leg.rider.id] = (riderAllocatedMap[leg.rider.id] || 0) + leg.allocatedQuantity;
      }

      for (const [riderId, totalAllocated] of Object.entries(riderAllocatedMap)) {
        expect(totalAllocated).toBeLessThanOrEqual(riderCapMap[riderId]);
      }

      // Verify shelter demand is respected
      const shelterAllocatedMap = {};
      for (const leg of result.plans) {
        shelterAllocatedMap[leg.shelter.id] = (shelterAllocatedMap[leg.shelter.id] || 0) + leg.allocatedQuantity;
      }
      expect(shelterAllocatedMap['shl_urgent_alpha']).toBeLessThanOrEqual(100);
      expect(shelterAllocatedMap['shl_beta']).toBeLessThanOrEqual(100);

      // The critical urgency shelter should be prioritized
      expect(shelterAllocatedMap['shl_urgent_alpha']).toBeGreaterThan(0);
    });
  });

  describe('2. Limited Rider Capacity & Quantity Reconciliation', () => {
    it('allocates only up to available fleet capacity and reconciles unallocated remainder with explicit diagnostic', () => {
      const donation = {
        id: 'don_180_limited',
        title: '180 Packaged Dinners',
        aidType: 'PREPARED_MEALS',
        availableQuantity: 180,
        unit: 'MEALS',
        safeUseDeadline: new Date(baseTime.getTime() + 6 * 3600000).toISOString(),
        pickupLocation: { latitude: 37.7749, longitude: -122.4194 }
      };

      const shelters = [
        {
          id: 'shl_large',
          name: 'Metro Center',
          isOpen: true,
          currentDemand: 200,
          receivingCapacity: 250,
          availableResources: ['ROOM_TEMPERATURE'],
          urgencyLevel: 'HIGH',
          location: { latitude: 37.7800, longitude: -122.4100 }
        }
      ];

      // Total rider fleet capacity is only 75 meals (40 + 35)
      const riders = [
        {
          id: 'rider_small_1',
          name: 'Sam',
          isAvailable: true,
          capacity: 40,
          availableCapacity: 40,
          currentLocation: { latitude: 37.7749, longitude: -122.4194 }
        },
        {
          id: 'rider_small_2',
          name: 'Morgan',
          isAvailable: true,
          capacity: 35,
          availableCapacity: 35,
          currentLocation: { latitude: 37.7749, longitude: -122.4194 }
        }
      ];

      const result = calculateDispatchAllocations({
        donations: donation,
        shelters,
        riders,
        options: { currentTime: baseTime }
      });

      expect(result.success).toBe(true);
      expect(result.metrics.allocatedTotal).toBe(75);
      expect(result.metrics.unallocatedTotal).toBe(105);
      expect(result.metrics.reconciled).toBe(true);
      expect(result.metrics.allocatedTotal + result.metrics.unallocatedTotal).toBe(180);

      // Explanations must articulate the unallocated surplus
      const capacityExplanation = result.infeasibleExplanations.find(
        (e) => e.code === DISPATCH_REJECTION_CODES.INSUFFICIENT_RIDER_CAPACITY
      );
      expect(capacityExplanation).toBeDefined();
      expect(capacityExplanation.unallocatedQuantity).toBe(105);
    });
  });

  describe('3. Shelter Demand and Receiving Capacity Limits', () => {
    it('never exceeds shelter demand or receiving capacity across multiple distribution legs', () => {
      const donation = {
        id: 'don_surplus',
        title: 'Warehouse Surplus',
        aidType: 'PREPARED_MEALS',
        availableQuantity: 150,
        unit: 'MEALS',
        safeUseDeadline: new Date(baseTime.getTime() + 8 * 3600000).toISOString(),
        pickupLocation: { latitude: 37.7749, longitude: -122.4194 }
      };

      const shelters = [
        {
          id: 'shl_capped_space',
          name: 'Capped Receiving Capacity Hub',
          isOpen: true,
          currentDemand: 100, // Wants 100
          receivingCapacity: 30, // But only has space for 30
          urgencyLevel: 'HIGH',
          availableResources: ['ROOM_TEMPERATURE'],
          location: { latitude: 37.7800, longitude: -122.4100 }
        },
        {
          id: 'shl_capped_demand',
          name: 'Capped Demand Hub',
          isOpen: true,
          currentDemand: 45, // Only needs 45
          receivingCapacity: 200, // Large space
          urgencyLevel: 'HIGH',
          availableResources: ['ROOM_TEMPERATURE'],
          location: { latitude: 37.7850, longitude: -122.4050 }
        }
      ];

      const riders = [
        {
          id: 'rider_fleet_van',
          name: 'Fleet Van 1',
          isAvailable: true,
          capacity: 200,
          availableCapacity: 200,
          currentLocation: { latitude: 37.7749, longitude: -122.4194 }
        }
      ];

      const result = calculateDispatchAllocations({
        donations: donation,
        shelters,
        riders,
        options: { currentTime: baseTime }
      });

      // Shl 1 should receive at most 30 (effective demand min(100, 30))
      // Shl 2 should receive at most 45 (effective demand min(45, 200))
      // Total allocated: 30 + 45 = 75
      // Unallocated: 150 - 75 = 75
      expect(result.metrics.allocatedTotal).toBe(75);
      expect(result.metrics.unallocatedTotal).toBe(75);
      expect(result.metrics.reconciled).toBe(true);

      const leg1 = result.plans.find((p) => p.shelter.id === 'shl_capped_space');
      const leg2 = result.plans.find((p) => p.shelter.id === 'shl_capped_demand');

      expect(leg1.allocatedQuantity).toBe(30);
      expect(leg2.allocatedQuantity).toBe(45);
    });
  });

  describe('4. Incompatible Aid Rejection', () => {
    it('rejects aid when shelter lacks required storage handling resources (refrigeration)', () => {
      const chilledDonation = {
        id: 'don_chilled_dairy',
        title: 'Chilled Milk and Yogurt',
        aidType: 'DAIRY',
        storageRequirement: 'REFRIGERATED',
        availableQuantity: 50,
        unit: 'KG',
        safeUseDeadline: new Date(baseTime.getTime() + 4 * 3600000).toISOString(),
        pickupLocation: { latitude: 37.7749, longitude: -122.4194 }
      };

      const dryShelter = {
        id: 'shl_dry_only',
        name: 'Dry Goods Pantry',
        isOpen: true,
        currentDemand: 100,
        receivingCapacity: 100,
        availableResources: ['DRY_STORAGE', 'ROOM_TEMPERATURE'], // NO REFRIGERATION
        location: { latitude: 37.7800, longitude: -122.4100 }
      };

      const rider = {
        id: 'rider_1',
        name: 'Rider 1',
        isAvailable: true,
        capacity: 100,
        availableCapacity: 100,
        currentLocation: { latitude: 37.7749, longitude: -122.4194 }
      };

      const result = calculateDispatchAllocations({
        donations: chilledDonation,
        shelters: [dryShelter],
        riders: [rider],
        options: { currentTime: baseTime }
      });

      expect(result.success).toBe(false);
      expect(result.plans.length).toBe(0);
      expect(result.metrics.allocatedTotal).toBe(0);
      expect(result.metrics.unallocatedTotal).toBe(50);
      expect(result.metrics.reconciled).toBe(true);

      const rejection = result.infeasibleExplanations.find(
        (e) => e.code === DISPATCH_REJECTION_CODES.INCOMPATIBLE_STORAGE_RESOURCE
      );
      expect(rejection).toBeDefined();
      expect(rejection.reason).toContain('lacks refrigeration');
    });

    it('rejects aid when shelter restricts accepted categories', () => {
      const medicalDonation = {
        id: 'don_med_kits',
        title: 'First Aid Emergency Kits',
        aidType: 'MEDICAL',
        availableQuantity: 20,
        unit: 'KITS',
        safeUseDeadline: new Date(baseTime.getTime() + 48 * 3600000).toISOString(),
        pickupLocation: { latitude: 37.7749, longitude: -122.4194 }
      };

      const foodOnlyShelter = {
        id: 'shl_food_bank',
        name: 'Community Food Kitchen',
        isOpen: true,
        currentDemand: 50,
        receivingCapacity: 50,
        acceptedCategories: ['PREPARED_MEALS', 'PRODUCE', 'BAKERY'], // MEDICAL not accepted
        availableResources: ['DRY_STORAGE'],
        location: { latitude: 37.7800, longitude: -122.4100 }
      };

      const rider = {
        id: 'rider_1',
        name: 'Rider 1',
        isAvailable: true,
        capacity: 50,
        availableCapacity: 50,
        currentLocation: { latitude: 37.7749, longitude: -122.4194 }
      };

      const result = calculateDispatchAllocations({
        donations: medicalDonation,
        shelters: [foodOnlyShelter],
        riders: [rider],
        options: { currentTime: baseTime }
      });

      expect(result.success).toBe(false);
      expect(result.plans.length).toBe(0);
      const rejection = result.infeasibleExplanations.find(
        (e) => e.code === DISPATCH_REJECTION_CODES.INCOMPATIBLE_CATEGORY
      );
      expect(rejection).toBeDefined();
      expect(rejection.reason).toContain('does not accept category "MEDICAL"');
    });
  });

  describe('5. Safety Deadline & Insufficient Time Gating', () => {
    it('rejects dispatch plans that cannot reasonably complete before the safety deadline', () => {
      // Donation expires in 15 minutes from baseTime
      const shortLifeDonation = {
        id: 'don_quick_expire',
        title: 'Warm Soup Containers',
        aidType: 'PREPARED_MEALS',
        availableQuantity: 40,
        unit: 'MEALS',
        safeUseDeadline: new Date(baseTime.getTime() + 15 * 60000).toISOString(), // 15 mins
        pickupLocation: { latitude: 37.7749, longitude: -122.4194 }
      };

      // Shelter is ~10 km away; transit + handoff takes ~45 minutes
      const shelter = {
        id: 'shl_distant',
        name: 'Outer Bay Shelter',
        isOpen: true,
        currentDemand: 50,
        receivingCapacity: 50,
        availableResources: ['ROOM_TEMPERATURE'],
        location: { latitude: 37.8500, longitude: -122.3000 }
      };

      const rider = {
        id: 'rider_distant',
        name: 'Bicycle Courier',
        isAvailable: true,
        capacity: 50,
        availableCapacity: 50,
        currentLocation: { latitude: 37.7600, longitude: -122.4300 }
      };

      const result = calculateDispatchAllocations({
        donations: shortLifeDonation,
        shelters: [shelter],
        riders: [rider],
        options: { currentTime: baseTime, pickupHandoffMinutes: 10, dropoffHandoffMinutes: 10 }
      });

      expect(result.success).toBe(false);
      expect(result.plans.length).toBe(0);
      expect(result.metrics.allocatedTotal).toBe(0);
      expect(result.metrics.unallocatedTotal).toBe(40);

      const deadlineRejection = result.infeasibleExplanations.find(
        (e) => e.code === DISPATCH_REJECTION_CODES.SAFETY_DEADLINE_EXCEEDED
      );
      expect(deadlineRejection).toBeDefined();
      expect(deadlineRejection.reason).toContain('Safety deadline exceeded');
    });
  });

  describe('6. Plan Ranking Multi-Objective Scoring', () => {
    it('ranks candidate allocations higher when shelter urgency is CRITICAL compared to LOW', () => {
      const criticalScore = rankAllocationScore({
        urgencyLevel: 'CRITICAL',
        allocatedQuantity: 50,
        initialDonationQuantity: 50,
        shelterDemand: 50,
        totalTripMinutes: 20,
        safetyMarginMinutes: 60
      });

      const lowScore = rankAllocationScore({
        urgencyLevel: 'LOW',
        allocatedQuantity: 50,
        initialDonationQuantity: 50,
        shelterDemand: 50,
        totalTripMinutes: 20,
        safetyMarginMinutes: 60
      });

      expect(criticalScore.score).toBeGreaterThan(lowScore.score);
      expect(criticalScore.breakdown.urgencyWeight).toBe(100);
      expect(lowScore.breakdown.urgencyWeight).toBe(25);
    });

    it('penalizes allocations with excessively long travel times', () => {
      const nearTrip = rankAllocationScore({
        urgencyLevel: 'HIGH',
        allocatedQuantity: 50,
        initialDonationQuantity: 50,
        shelterDemand: 50,
        totalTripMinutes: 15,
        safetyMarginMinutes: 60
      });

      const farTrip = rankAllocationScore({
        urgencyLevel: 'HIGH',
        allocatedQuantity: 50,
        initialDonationQuantity: 50,
        shelterDemand: 50,
        totalTripMinutes: 60,
        safetyMarginMinutes: 60
      });

      expect(nearTrip.score).toBeGreaterThan(farTrip.score);
    });
  });

  describe('7. Closed Shelter & Empty Input Handling', () => {
    it('returns an explicit diagnostic when candidate shelter is closed', () => {
      const donation = {
        id: 'don_test',
        availableQuantity: 50,
        safeUseDeadline: new Date(baseTime.getTime() + 4 * 3600000).toISOString()
      };

      const closedShelter = {
        id: 'shl_closed',
        name: 'Closed Weekend Shelter',
        isOpen: false, // Closed!
        currentDemand: 50,
        receivingCapacity: 50
      };

      const result = calculateDispatchAllocations({
        donations: donation,
        shelters: [closedShelter],
        riders: [],
        options: { currentTime: baseTime }
      });

      expect(result.success).toBe(false);
      const explanation = result.infeasibleExplanations.find(
        (e) => e.code === DISPATCH_REJECTION_CODES.SHELTER_CLOSED
      );
      expect(explanation).toBeDefined();
      expect(explanation.reason).toContain('marked closed');
    });

    it('handles empty input gracefully and reports zero available quantity', () => {
      const result = calculateDispatchAllocations({
        donations: [],
        shelters: [],
        riders: []
      });

      expect(result.success).toBe(false);
      expect(result.metrics.allocatedTotal).toBe(0);
      expect(result.metrics.reconciled).toBe(true);
    });
  });
});
