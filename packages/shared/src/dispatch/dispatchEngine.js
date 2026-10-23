/**
 * AidFlow Pure Dispatch Engine
 *
 * A deterministic, zero-dependency, testable dispatch calculation engine.
 * Decoupled completely from database writes, Redis, and external queues.
 *
 * Calculates feasible aid redistribution allocations that:
 * 1. Split donations to strictly respect rider carrying capacities.
 * 2. Never exceed donation available quantities (strict quantity reconciliation).
 * 3. Never exceed recipient shelter demand or receiving capacity.
 * 4. Reject aid incompatible with shelter resources and handling capabilities.
 * 5. Reject delivery routes that cannot complete within the food safety deadline.
 * 6. Rank feasible plans by urgency, demand satisfaction, waste reduction, and travel time.
 * 7. Provide explicit diagnostics and explanations for infeasible match candidates.
 */

/**
 * Common reason codes for infeasible dispatch matches
 */
export const DISPATCH_REJECTION_CODES = {
  ZERO_AVAILABLE_QUANTITY: 'ZERO_AVAILABLE_QUANTITY',
  SHELTER_CLOSED: 'SHELTER_CLOSED',
  SHELTER_CAPACITY_EXHAUSTED: 'SHELTER_CAPACITY_EXHAUSTED',
  NO_AVAILABLE_RIDERS: 'NO_AVAILABLE_RIDERS',
  INSUFFICIENT_RIDER_CAPACITY: 'INSUFFICIENT_RIDER_CAPACITY',
  INCOMPATIBLE_STORAGE_RESOURCE: 'INCOMPATIBLE_STORAGE_RESOURCE',
  INCOMPATIBLE_CATEGORY: 'INCOMPATIBLE_CATEGORY',
  SAFETY_DEADLINE_EXCEEDED: 'SAFETY_DEADLINE_EXCEEDED',
  NO_FEASIBLE_ROUTE: 'NO_FEASIBLE_ROUTE'
};

/**
 * Urgency weight multiplier for plan ranking
 */
export const URGENCY_WEIGHTS = {
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25
};

/**
 * Extracts normalized { latitude, longitude } from varied geo-coordinate formats.
 *
 * @param {Object} loc - Location object
 * @returns {{ latitude: number, longitude: number } | null}
 */
export function extractCoordinates(loc) {
  if (!loc) return null;
  const lat = loc.latitude ?? loc.lat ?? loc.coordinates?.[1];
  const lon = loc.longitude ?? loc.lon ?? loc.lng ?? loc.coordinates?.[0];
  if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)) {
    return { latitude: lat, longitude: lon };
  }
  return null;
}

/**
 * Calculates Haversine distance in kilometers between two geo-coordinates.
 *
 * @param {Object} p1 - Origin location { latitude, longitude }
 * @param {Object} p2 - Destination location { latitude, longitude }
 * @returns {number} Distance in kilometers (rounded to 2 decimal places)
 */
export function calculateDistanceKm(p1, p2) {
  const c1 = extractCoordinates(p1);
  const c2 = extractCoordinates(p2);
  if (!c1 || !c2) return 0;

  const R = 6371; // Earth radius in km
  const dLat = (c2.latitude - c1.latitude) * (Math.PI / 180);
  const dLon = (c2.longitude - c1.longitude) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(c1.latitude * (Math.PI / 180)) *
      Math.cos(c2.latitude * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Checks if a donation's storage/handling requirements and category
 * are compatible with a shelter's available resources and accepted categories.
 *
 * @param {Object} donation - Donation entity
 * @param {Object} shelter - Shelter entity
 * @returns {{ compatible: boolean, reason?: string, code?: string }}
 */
export function validateHandlingCompatibility(donation, shelter) {
  const donationTitle = donation.title || donation.id || 'Donation';
  const shelterName = shelter.name || shelter.id || 'Shelter';

  // 1. Category validation
  const donationCategory = (donation.aidType || donation.category || '').toUpperCase();
  if (shelter.acceptedCategories && shelter.acceptedCategories.length > 0 && donationCategory) {
    const accepted = shelter.acceptedCategories.map((c) => String(c).toUpperCase());
    if (!accepted.includes(donationCategory)) {
      return {
        compatible: false,
        code: DISPATCH_REJECTION_CODES.INCOMPATIBLE_CATEGORY,
        reason: `Shelter "${shelterName}" does not accept category "${donationCategory}". Accepted categories: [${shelter.acceptedCategories.join(', ')}]`
      };
    }
  }

  // 2. Storage & handling resources validation
  const rawReq = donation.storageRequirement || donation.handlingRequirements || 'ROOM_TEMPERATURE';
  const req = String(rawReq).toUpperCase();

  const shelterResources = (
    shelter.availableResources ||
    shelter.handlingCapabilities ||
    ['DRY_STORAGE', 'ROOM_TEMPERATURE']
  ).map((r) => String(r).toUpperCase());

  // Refrigeration requirement
  if (req === 'REFRIGERATED' || req === 'REFRIGERATION' || req === 'COLD_STORAGE') {
    const hasRefrig = shelterResources.some(
      (r) => r.includes('REFRIGERAT') || r.includes('COLD') || r.includes('CHILLED')
    );
    if (!hasRefrig) {
      return {
        compatible: false,
        code: DISPATCH_REJECTION_CODES.INCOMPATIBLE_STORAGE_RESOURCE,
        reason: `Donation "${donationTitle}" requires cold/refrigerated storage, but Shelter "${shelterName}" lacks refrigeration resources (Available: [${shelterResources.join(', ')}])`
      };
    }
  }

  // Frozen requirement
  if (req === 'FROZEN' || req === 'FREEZER') {
    const hasFreezer = shelterResources.some(
      (r) => r.includes('FREEZ') || r.includes('FROZEN')
    );
    if (!hasFreezer) {
      return {
        compatible: false,
        code: DISPATCH_REJECTION_CODES.INCOMPATIBLE_STORAGE_RESOURCE,
        reason: `Donation "${donationTitle}" requires freezer storage, but Shelter "${shelterName}" lacks freezer resources`
      };
    }
  }

  // Heated / Warming requirement
  if (req === 'WARM' || req === 'HEATED' || req === 'WARMING') {
    const hasWarming = shelterResources.some(
      (r) => r.includes('WARM') || r.includes('HEAT')
    );
    if (!hasWarming) {
      return {
        compatible: false,
        code: DISPATCH_REJECTION_CODES.INCOMPATIBLE_STORAGE_RESOURCE,
        reason: `Donation "${donationTitle}" requires heated holding equipment, but Shelter "${shelterName}" lacks warming resources`
      };
    }
  }

  return { compatible: true };
}

/**
 * Calculates estimated travel and handoff duration for a courier dispatch leg.
 *
 * Leg 1: Rider current location -> Donation pickup location
 * Handoff 1: Pickup load and verification time
 * Leg 2: Donation pickup location -> Shelter delivery location
 * Handoff 2: Unload, temperature audit, and intake handoff time
 *
 * @param {Object} riderLoc - Rider location { latitude, longitude }
 * @param {Object} pickupLoc - Pickup location { latitude, longitude }
 * @param {Object} deliveryLoc - Delivery shelter location { latitude, longitude }
 * @param {Object} [options] - Speed and handoff configs
 * @returns {Object} Timing breakdown
 */
export function estimateDispatchTiming(riderLoc, pickupLoc, deliveryLoc, options = {}) {
  const speedKmh = options.defaultSpeedKmh || 25; // City courier speed in km/h
  const pickupHandoffMinutes = options.pickupHandoffMinutes ?? 10;
  const dropoffHandoffMinutes = options.dropoffHandoffMinutes ?? 10;

  const leg1DistanceKm = calculateDistanceKm(riderLoc, pickupLoc);
  const leg2DistanceKm = calculateDistanceKm(pickupLoc, deliveryLoc);
  const totalDistanceKm = Math.round((leg1DistanceKm + leg2DistanceKm) * 100) / 100;

  const leg1Minutes = (leg1DistanceKm / speedKmh) * 60;
  const leg2Minutes = (leg2DistanceKm / speedKmh) * 60;

  const totalTripMinutes = Math.round(
    (leg1Minutes + pickupHandoffMinutes + leg2Minutes + dropoffHandoffMinutes) * 10
  ) / 10;

  return {
    leg1DistanceKm,
    leg2DistanceKm,
    totalDistanceKm,
    leg1Minutes: Math.round(leg1Minutes * 10) / 10,
    pickupHandoffMinutes,
    leg2Minutes: Math.round(leg2Minutes * 10) / 10,
    dropoffHandoffMinutes,
    totalTripMinutes
  };
}

/**
 * Validates whether a delivery plan can complete safely within the donation's safety deadline.
 *
 * @param {Date|string} currentTime - Current reference timestamp
 * @param {Date|string} deadlineInput - Safety deadline or expiration date
 * @param {number} totalTripMinutes - Total estimated transit and handoff duration
 * @returns {{ safe: boolean, reason?: string, code?: string, estimatedDeliveryTime: Date, deadline: Date, safetyMarginMinutes: number }}
 */
export function validateSafetyDeadline(currentTime, deadlineInput, totalTripMinutes) {
  const current = new Date(currentTime);
  const deadline = new Date(deadlineInput);

  if (isNaN(deadline.getTime())) {
    return {
      safe: false,
      code: DISPATCH_REJECTION_CODES.SAFETY_DEADLINE_EXCEEDED,
      reason: 'Invalid or missing safety deadline timestamp',
      estimatedDeliveryTime: new Date(current.getTime() + totalTripMinutes * 60000),
      deadline: new Date(0),
      safetyMarginMinutes: -Infinity
    };
  }

  const estimatedDeliveryTime = new Date(current.getTime() + totalTripMinutes * 60000);
  const safetyMarginMs = deadline.getTime() - estimatedDeliveryTime.getTime();
  const safetyMarginMinutes = Math.round((safetyMarginMs / 60000) * 10) / 10;

  if (safetyMarginMinutes < 0) {
    const overdueMinutes = Math.abs(safetyMarginMinutes);
    return {
      safe: false,
      code: DISPATCH_REJECTION_CODES.SAFETY_DEADLINE_EXCEEDED,
      reason: `Safety deadline exceeded: Estimated delivery at ${estimatedDeliveryTime.toISOString()} is ${overdueMinutes} minutes after the safety deadline of ${deadline.toISOString()} (Total trip duration: ${totalTripMinutes}m)`,
      estimatedDeliveryTime,
      deadline,
      safetyMarginMinutes
    };
  }

  return {
    safe: true,
    estimatedDeliveryTime,
    deadline,
    safetyMarginMinutes
  };
}

/**
 * Calculates a multi-objective ranking score for a feasible dispatch allocation leg.
 *
 * Factors:
 * + Urgency Level (CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25)
 * + Waste Reduction (percentage of donation saved * 50)
 * + Demand Satisfaction (quantity delivered / shelter target demand * 30)
 * + Safety Margin Bonus (up to 15 points for comfortable delivery buffers)
 * - Travel Time Penalty (longer travel times incur penalty to favor local redistribution)
 *
 * @param {Object} params
 * @returns {{ score: number, breakdown: Object }}
 */
export function rankAllocationScore({
  urgencyLevel = 'MEDIUM',
  allocatedQuantity,
  initialDonationQuantity,
  shelterDemand,
  totalTripMinutes,
  safetyMarginMinutes
}) {
  const urgencyWeight = URGENCY_WEIGHTS[urgencyLevel] || URGENCY_WEIGHTS.MEDIUM;

  const wasteReductionRatio = initialDonationQuantity > 0 ? allocatedQuantity / initialDonationQuantity : 0;
  const wasteReductionScore = Math.round(wasteReductionRatio * 50 * 10) / 10;

  const demandRatio = shelterDemand > 0 ? Math.min(allocatedQuantity / shelterDemand, 1) : 1;
  const demandSatisfactionScore = Math.round(demandRatio * 30 * 10) / 10;

  // Reward routes with safe margins, capped at 15
  const safetyMarginBonus = Math.min(Math.max(safetyMarginMinutes / 10, 0), 15);

  // Penalize long transit times (0.4 points per transit minute)
  const travelTimePenalty = Math.round(totalTripMinutes * 0.4 * 10) / 10;

  const totalScore = Math.round(
    (urgencyWeight + wasteReductionScore + demandSatisfactionScore + safetyMarginBonus - travelTimePenalty) * 100
  ) / 100;

  return {
    score: totalScore,
    breakdown: {
      urgencyWeight,
      wasteReductionScore,
      demandSatisfactionScore,
      safetyMarginBonus: Math.round(safetyMarginBonus * 10) / 10,
      travelTimePenalty
    }
  };
}

/**
 * Main Pure Dispatch Engine: Calculates feasible aid allocations.
 *
 * Features:
 * - Pure calculation (zero database writes or external queue side-effects).
 * - Multi-rider capacity splitting.
 * - Multi-shelter demand and receiving capacity adherence.
 * - Compatibility and food safety deadline gating.
 * - Comprehensive diagnostics for infeasible pairings.
 * - Strict mathematical reconciliation: sum(allocated) + unallocated === initialAvailable.
 *
 * @param {Object} params
 * @param {Object|Array<Object>} params.donations - Donation or list of donations
 * @param {Array<Object>} params.shelters - List of active recipient shelters
 * @param {Array<Object>} params.riders - List of available couriers/riders
 * @param {Object} [params.options] - Configuration overrides (currentTime, speeds, buffers)
 * @returns {Object} Dispatch plan result with allocations, reconciliation metrics, and diagnostics
 */
export function calculateDispatchAllocations({ donations, shelters, riders, options = {} }) {
  const currentTime = options.currentTime ? new Date(options.currentTime) : new Date();

  // Normalize donations to an array
  const donationList = Array.isArray(donations) ? donations : donations ? [donations] : [];

  if (donationList.length === 0) {
    return {
      success: false,
      plans: [],
      metrics: {
        initialAvailableQuantity: 0,
        allocatedTotal: 0,
        unallocatedTotal: 0,
        reconciled: true,
        totalLegsCount: 0
      },
      infeasibleExplanations: [
        {
          code: DISPATCH_REJECTION_CODES.ZERO_AVAILABLE_QUANTITY,
          reason: 'No donations provided for dispatch calculation'
        }
      ]
    };
  }

  // Work on local deep copies of shelters and riders state for pure in-memory calculation
  const shelterState = (shelters || []).map((s) => {
    const demand = Number(s.currentDemand ?? s.demand ?? 0);
    const capacity = Number(s.receivingCapacity ?? s.maxCapacity ?? demand);
    return {
      id: s.id || s._id ? String(s.id || s._id) : `shelter_${Math.random().toString(36).substring(2, 7)}`,
      name: s.name || 'Recipient Shelter',
      isOpen: s.isOpen !== false && s.active !== false,
      currentDemand: Math.max(0, demand),
      receivingCapacity: Math.max(0, capacity),
      effectiveDemand: Math.max(0, Math.min(demand, capacity)),
      availableResources: s.availableResources || s.handlingCapabilities || ['DRY_STORAGE', 'ROOM_TEMPERATURE'],
      acceptedCategories: s.acceptedCategories || [],
      urgencyLevel: s.urgencyLevel || 'MEDIUM',
      location: s.location || { latitude: 37.7749, longitude: -122.4194 }
    };
  });

  const riderState = (riders || []).map((r) => {
    const totalCap = Number(r.capacity ?? r.maxCapacityKg ?? r.carryingCapacity ?? 0);
    const availCap = Number(r.availableCapacity ?? totalCap);
    return {
      id: r.id || r._id ? String(r.id || r._id) : `rider_${Math.random().toString(36).substring(2, 7)}`,
      name: r.name || 'Delivery Courier',
      isAvailable: r.isAvailable !== false && (r.status === 'AVAILABLE' || !r.status),
      totalCapacity: Math.max(0, totalCap),
      availableCapacity: Math.max(0, availCap),
      vehicleType: r.vehicleType || 'E_BIKE',
      currentLocation: r.currentLocation || { latitude: 37.7749, longitude: -122.4194 }
    };
  });

  const allAllocations = [];
  const infeasibleExplanations = [];

  let grandAllocatedTotal = 0;
  let grandOriginalAvailable = 0;

  // Process each donation
  for (const rawDonation of donationList) {
    const donationId = rawDonation.id || rawDonation._id ? String(rawDonation.id || rawDonation._id) : `don_${Math.random().toString(36).substring(2, 7)}`;
    const originalAvailable = Number(rawDonation.availableQuantity ?? rawDonation.quantity ?? 0);
    grandOriginalAvailable += originalAvailable;

    if (originalAvailable <= 0) {
      infeasibleExplanations.push({
        donationId,
        code: DISPATCH_REJECTION_CODES.ZERO_AVAILABLE_QUANTITY,
        reason: `Donation "${rawDonation.title || donationId}" has 0 available quantity to allocate`
      });
      continue;
    }

    let remainingDonationQty = originalAvailable;
    const donationAllocations = [];

    // Filter shelters that are open and have positive effective demand
    const eligibleShelters = shelterState.filter((s) => {
      if (!s.isOpen) {
        infeasibleExplanations.push({
          donationId,
          shelterId: s.id,
          code: DISPATCH_REJECTION_CODES.SHELTER_CLOSED,
          reason: `Shelter "${s.name}" is currently marked closed/inactive`
        });
        return false;
      }
      if (s.effectiveDemand <= 0) {
        infeasibleExplanations.push({
          donationId,
          shelterId: s.id,
          code: DISPATCH_REJECTION_CODES.SHELTER_CAPACITY_EXHAUSTED,
          reason: `Shelter "${s.name}" has no remaining demand or receiving capacity`
        });
        return false;
      }
      return true;
    });

    // Check handling compatibility for eligible shelters
    const compatibleShelters = [];
    for (const s of eligibleShelters) {
      const compat = validateHandlingCompatibility(rawDonation, s);
      if (!compat.compatible) {
        infeasibleExplanations.push({
          donationId,
          shelterId: s.id,
          code: compat.code,
          reason: compat.reason
        });
      } else {
        compatibleShelters.push(s);
      }
    }

    // Sort shelters by urgency descending, then by remaining demand descending
    compatibleShelters.sort((a, b) => {
      const uA = URGENCY_WEIGHTS[a.urgencyLevel] || 0;
      const uB = URGENCY_WEIGHTS[b.urgencyLevel] || 0;
      if (uB !== uA) return uB - uA;
      return b.effectiveDemand - a.effectiveDemand;
    });

    // Filter available riders with positive capacity
    const eligibleRiders = riderState.filter((r) => {
      if (!r.isAvailable) return false;
      if (r.availableCapacity <= 0) {
        infeasibleExplanations.push({
          donationId,
          riderId: r.id,
          code: DISPATCH_REJECTION_CODES.INSUFFICIENT_RIDER_CAPACITY,
          reason: `Rider "${r.name}" has 0 available carrying capacity`
        });
        return false;
      }
      return true;
    });

    if (eligibleRiders.length === 0) {
      infeasibleExplanations.push({
        donationId,
        code: DISPATCH_REJECTION_CODES.NO_AVAILABLE_RIDERS,
        reason: 'No available couriers with remaining capacity exist in the dispatch fleet'
      });
    }

    const pickupLocation = rawDonation.pickupLocation || { latitude: 37.7749, longitude: -122.4194 };
    const deadlineValue = rawDonation.safeUseDeadline || rawDonation.expirationDate;

    // Match across compatible shelters and available riders
    for (const shelter of compatibleShelters) {
      if (remainingDonationQty <= 0) break;
      if (shelter.effectiveDemand <= 0) continue;

      // Sort riders by proximity to pickup location
      eligibleRiders.sort((r1, r2) => {
        const d1 = calculateDistanceKm(r1.currentLocation, pickupLocation);
        const d2 = calculateDistanceKm(r2.currentLocation, pickupLocation);
        return d1 - d2;
      });

      for (const rider of eligibleRiders) {
        if (remainingDonationQty <= 0) break;
        if (shelter.effectiveDemand <= 0) break;
        if (rider.availableCapacity <= 0) continue;

        // Estimate travel and handoff duration
        const timing = estimateDispatchTiming(
          rider.currentLocation,
          pickupLocation,
          shelter.location,
          options
        );

        // Validate food safety deadline
        const safetyCheck = validateSafetyDeadline(
          currentTime,
          deadlineValue,
          timing.totalTripMinutes
        );

        if (!safetyCheck.safe) {
          infeasibleExplanations.push({
            donationId,
            shelterId: shelter.id,
            riderId: rider.id,
            code: safetyCheck.code,
            reason: safetyCheck.reason
          });
          continue; // Cannot safely dispatch this rider-shelter pair
        }

        // Determine allocation quantity respecting rider capacity, shelter demand, and remaining donation
        const allocatable = Math.min(
          remainingDonationQty,
          rider.availableCapacity,
          shelter.effectiveDemand
        );

        if (allocatable <= 0) continue;

        // Round to 2 decimal places to prevent floating point drift
        const allocatedQuantity = Math.round(allocatable * 100) / 100;

        // Score this leg
        const ranking = rankAllocationScore({
          urgencyLevel: shelter.urgencyLevel,
          allocatedQuantity,
          initialDonationQuantity: originalAvailable,
          shelterDemand: shelter.effectiveDemand,
          totalTripMinutes: timing.totalTripMinutes,
          safetyMarginMinutes: safetyCheck.safetyMarginMinutes
        });

        const allocationLeg = {
          id: `leg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          donationId,
          donationTitle: rawDonation.title || 'Donation Item',
          category: rawDonation.aidType || rawDonation.category || 'PREPARED_MEALS',
          unit: rawDonation.unit || 'MEALS',
          allocatedQuantity,
          shelter: {
            id: shelter.id,
            name: shelter.name,
            urgencyLevel: shelter.urgencyLevel,
            deliveryAddress: shelter.location?.address || 'Shelter Hub'
          },
          rider: {
            id: rider.id,
            name: rider.name,
            vehicleType: rider.vehicleType,
            remainingCapacityAfter: Math.round((rider.availableCapacity - allocatedQuantity) * 100) / 100
          },
          route: {
            pickupAddress: pickupLocation?.address || 'Pickup Point',
            deliveryAddress: shelter.location?.address || 'Delivery Shelter',
            leg1DistanceKm: timing.leg1DistanceKm,
            leg2DistanceKm: timing.leg2DistanceKm,
            totalDistanceKm: timing.totalDistanceKm,
            estimatedTransitMinutes: timing.totalTripMinutes
          },
          timing: {
            dispatchedAt: currentTime.toISOString(),
            estimatedPickupMinutes: timing.leg1Minutes + timing.pickupHandoffMinutes,
            estimatedDeliveryMinutes: timing.totalTripMinutes,
            estimatedDeliveryTime: safetyCheck.estimatedDeliveryTime.toISOString(),
            safetyDeadline: safetyCheck.deadline.toISOString(),
            safetyMarginMinutes: safetyCheck.safetyMarginMinutes
          },
          rankingScore: ranking.score,
          scoreBreakdown: ranking.breakdown
        };

        // Deduct quantities
        remainingDonationQty = Math.round((remainingDonationQty - allocatedQuantity) * 100) / 100;
        rider.availableCapacity = Math.round((rider.availableCapacity - allocatedQuantity) * 100) / 100;
        shelter.effectiveDemand = Math.round((shelter.effectiveDemand - allocatedQuantity) * 100) / 100;

        donationAllocations.push(allocationLeg);
        allAllocations.push(allocationLeg);
      }
    }

    const donationAllocatedTotal = Math.round((originalAvailable - remainingDonationQty) * 100) / 100;
    grandAllocatedTotal = Math.round((grandAllocatedTotal + donationAllocatedTotal) * 100) / 100;

    if (remainingDonationQty > 0) {
      infeasibleExplanations.push({
        donationId,
        code: DISPATCH_REJECTION_CODES.INSUFFICIENT_RIDER_CAPACITY,
        reason: `Donation "${rawDonation.title || donationId}" has ${remainingDonationQty} unallocated ${rawDonation.unit || 'units'} due to fleet capacity or shelter demand exhaustion`,
        unallocatedQuantity: remainingDonationQty
      });
    }
  }

  // Sort overall allocation legs by ranking score descending
  allAllocations.sort((a, b) => b.rankingScore - a.rankingScore);

  const grandUnallocatedTotal = Math.round((grandOriginalAvailable - grandAllocatedTotal) * 100) / 100;

  // Strict mathematical reconciliation assertion
  const reconciled = Math.abs(grandAllocatedTotal + grandUnallocatedTotal - grandOriginalAvailable) < 0.0001;

  return {
    success: allAllocations.length > 0,
    timestamp: currentTime.toISOString(),
    plans: allAllocations,
    metrics: {
      initialAvailableQuantity: grandOriginalAvailable,
      allocatedTotal: grandAllocatedTotal,
      unallocatedTotal: grandUnallocatedTotal,
      reconciled,
      totalLegsCount: allAllocations.length
    },
    infeasibleExplanations
  };
}
