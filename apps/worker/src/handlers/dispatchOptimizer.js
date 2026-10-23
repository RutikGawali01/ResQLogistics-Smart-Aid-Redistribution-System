import { redispatchEligibleDonations } from '../recovery/failureRecoveryService.js';

/**
 * Handler that processes background dispatch matching for unassigned donations and riders.
 */
export async function dispatchOptimizerHandler(payload = {}) {
  const now = payload.now ? new Date(payload.now) : new Date();
  console.log(`[DispatchOptimizer] Running automated courier dispatch cycle at ${now.toISOString()}...`);

  const results = await redispatchEligibleDonations({ now });

  console.log(
    `[DispatchOptimizer] Optimization cycle complete. Success: ${results.success}. Plans: ${results.plans?.length || 0}`
  );

  return results;
}
