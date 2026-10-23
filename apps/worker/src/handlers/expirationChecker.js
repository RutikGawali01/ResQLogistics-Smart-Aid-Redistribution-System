import { runPeriodicMaintenanceCycle } from '../recovery/failureRecoveryService.js';

/**
 * Handler that scans for donations close to expiration, stale reservations,
 * overdue assignments, and closed shelter recovery.
 */
export async function expirationCheckerHandler(payload = {}) {
  const now = payload.now ? new Date(payload.now) : new Date();
  console.log(`[ExpirationChecker] Executing periodic deadline & failure recovery cycle at ${now.toISOString()}...`);

  const results = await runPeriodicMaintenanceCycle({ now });

  console.log(
    `[ExpirationChecker] Cycle complete: ` +
    `${results.expiredReservationsProcessed} expired reservations released, ` +
    `${results.stalledRidersReassigned} stalled riders reassigned, ` +
    `${results.safetyExpiredAssignments} food-safety expired assignments flagged.`
  );

  return results;
}
