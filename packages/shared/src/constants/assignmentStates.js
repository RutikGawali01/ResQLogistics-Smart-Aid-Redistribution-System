/**
 * State lifecycle values for an AidFlow delivery assignment.
 * @readonly
 * @enum {string}
 */
export const ASSIGNMENT_STATUS = {
  UNASSIGNED: 'UNASSIGNED',
  PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
  ACCEPTED: 'ACCEPTED',
  PICKUP_IN_PROGRESS: 'PICKUP_IN_PROGRESS',
  PICKED_UP: 'PICKED_UP',
  DELIVERY_IN_PROGRESS: 'DELIVERY_IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED'
};

/**
 * Array of all valid assignment states.
 */
export const ALL_ASSIGNMENT_STATUSES = Object.values(ASSIGNMENT_STATUS);

/**
 * Terminal states in the assignment lifecycle.
 * Once entered, an assignment cannot transition further.
 */
export const TERMINAL_ASSIGNMENT_STATUSES = [
  ASSIGNMENT_STATUS.DELIVERED,
  ASSIGNMENT_STATUS.CANCELLED,
  ASSIGNMENT_STATUS.FAILED
];

/**
 * Valid directed state transition map.
 * Defines permissible next states for any given current state.
 */
export const VALID_ASSIGNMENT_TRANSITIONS = {
  [ASSIGNMENT_STATUS.UNASSIGNED]: [
    ASSIGNMENT_STATUS.PENDING_ACCEPTANCE,
    ASSIGNMENT_STATUS.CANCELLED
  ],
  [ASSIGNMENT_STATUS.PENDING_ACCEPTANCE]: [
    ASSIGNMENT_STATUS.ACCEPTED,
    ASSIGNMENT_STATUS.UNASSIGNED, // Timeout or rider rejection
    ASSIGNMENT_STATUS.CANCELLED
  ],
  [ASSIGNMENT_STATUS.ACCEPTED]: [
    ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS,
    ASSIGNMENT_STATUS.UNASSIGNED, // Re-assignment if rider unassigns before departure
    ASSIGNMENT_STATUS.CANCELLED
  ],
  [ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS]: [
    ASSIGNMENT_STATUS.PICKED_UP,
    ASSIGNMENT_STATUS.CANCELLED,
    ASSIGNMENT_STATUS.FAILED
  ],
  [ASSIGNMENT_STATUS.PICKED_UP]: [
    ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS,
    ASSIGNMENT_STATUS.FAILED
  ],
  [ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS]: [
    ASSIGNMENT_STATUS.DELIVERED,
    ASSIGNMENT_STATUS.FAILED
  ],
  [ASSIGNMENT_STATUS.DELIVERED]: [],
  [ASSIGNMENT_STATUS.CANCELLED]: [],
  [ASSIGNMENT_STATUS.FAILED]: []
};

/**
 * Validates whether a state transition is permissible.
 * @param {string} currentStatus - The current status of the assignment
 * @param {string} nextStatus - The proposed next status
 * @returns {{ valid: boolean, reason?: string }}
 */
export function canTransitionAssignment(currentStatus, nextStatus) {
  if (!ALL_ASSIGNMENT_STATUSES.includes(currentStatus)) {
    return {
      valid: false,
      reason: `Unknown current status: "${currentStatus}". Must be one of: ${ALL_ASSIGNMENT_STATUSES.join(', ')}`
    };
  }

  if (!ALL_ASSIGNMENT_STATUSES.includes(nextStatus)) {
    return {
      valid: false,
      reason: `Unknown target status: "${nextStatus}". Must be one of: ${ALL_ASSIGNMENT_STATUSES.join(', ')}`
    };
  }

  if (currentStatus === nextStatus) {
    return {
      valid: false,
      reason: `State transition is a no-op: Assignment is already in status "${currentStatus}"`
    };
  }

  if (TERMINAL_ASSIGNMENT_STATUSES.includes(currentStatus)) {
    return {
      valid: false,
      reason: `Cannot transition from terminal state "${currentStatus}" to "${nextStatus}"`
    };
  }

  const allowedNext = VALID_ASSIGNMENT_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(nextStatus)) {
    return {
      valid: false,
      reason: `Invalid transition from "${currentStatus}" to "${nextStatus}". Permitted next states: [${allowedNext.join(', ')}]`
    };
  }

  return { valid: true };
}
