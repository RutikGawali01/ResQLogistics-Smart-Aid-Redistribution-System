/**
 * Socket.IO event name constants shared between client, server, and worker.
 */
export const SOCKET_EVENTS = {
  // Connection lifecycle
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Room management
  JOIN_ROOM: 'room:join',
  LEAVE_ROOM: 'room:leave',

  // Rider tracking
  RIDER_LOCATION_UPDATE: 'rider:location_update',
  RIDER_LOCATION_BROADCAST: 'rider:location_broadcast',
  RIDER_STATUS_CHANGED: 'rider:status_changed',

  // Assignment lifecycle
  ASSIGNMENT_OFFERED: 'assignment:offered',
  ASSIGNMENT_ACCEPTED: 'assignment:accepted',
  ASSIGNMENT_STATE_CHANGED: 'assignment:state_changed',

  // Surplus & Shelter events
  DONATION_CREATED: 'donation:created',
  DONATION_RESERVED: 'donation:reserved',
  SHELTER_CAPACITY_UPDATED: 'shelter:capacity_updated',

  // System & Dispatch alerts
  DISPATCH_RECOMMENDATION: 'dispatch:recommendation',
  SYSTEM_NOTIFICATION: 'system:notification'
};

/**
 * Standard socket room name conventions.
 */
export const SOCKET_ROOMS = {
  GLOBAL_DISPATCH: 'room:dispatch:global',
  SHELTER: (shelterId) => `room:shelter:${shelterId}`,
  RIDER: (riderId) => `room:rider:${riderId}`,
  DONOR: (donorId) => `room:donor:${donorId}`,
  ASSIGNMENT: (assignmentId) => `room:assignment:${assignmentId}`
};
