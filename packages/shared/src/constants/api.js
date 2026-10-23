/**
 * Standard API endpoint prefixes agreed across the platform.
 */
export const ENDPOINT_PREFIXES = {
  AUTH: '/api/auth',
  DONATIONS: '/api/donations',
  SHELTERS: '/api/shelters',
  RIDERS: '/api/riders',
  DISPATCH: '/api/dispatch',
  ASSIGNMENTS: '/api/assignments',
  HEALTH: '/api/health'
};

/**
 * Standard error codes for API error envelopes.
 * @readonly
 * @enum {string}
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  BAD_REQUEST: 'BAD_REQUEST',
  PROTECTED_FIELD_MODIFICATION: 'PROTECTED_FIELD_MODIFICATION',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};

/**
 * Creates a standard successful API response envelope.
 * @template T
 * @param {T} data - Payload data
 * @param {string|null} [message=null] - Optional human-readable message
 * @param {Record<string, any>|null} [meta=null] - Optional metadata (e.g., pagination info)
 * @returns {{ success: true, data: T, message: string|null, meta: Record<string, any>|null, timestamp: string }}
 */
export function formatSuccessResponse(data, message = null, meta = null) {
  return {
    success: true,
    data,
    message,
    meta,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a standard error API response envelope.
 * @param {string} code - Error code from ERROR_CODES
 * @param {string} message - Human-readable description
 * @param {any} [details=null] - Additional contextual details (e.g. Zod errors, transition violations)
 * @returns {{ success: false, error: { code: string, message: string, details: any }, timestamp: string }}
 */
export function formatErrorResponse(code, message, details = null) {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    timestamp: new Date().toISOString()
  };
}
