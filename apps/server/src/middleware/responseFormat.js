import { formatSuccessResponse, formatErrorResponse, ERROR_CODES } from '@aidflow/shared';

/**
 * Middleware that decorates Express res with standardized API response envelopes.
 */
export function responseFormatMiddleware(req, res, next) {
  res.success = function (data, message = null, meta = null, status = 200) {
    return res.status(status).json(formatSuccessResponse(data, message, meta));
  };

  res.fail = function (code = ERROR_CODES.BAD_REQUEST, message = 'An error occurred', details = null, status = 400) {
    return res.status(status).json(formatErrorResponse(code, message, details));
  };

  next();
}
