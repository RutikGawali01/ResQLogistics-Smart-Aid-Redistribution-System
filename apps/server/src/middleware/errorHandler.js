import { ERROR_CODES, formatErrorResponse } from '@aidflow/shared';

/**
 * Global Express error handling middleware.
 */
export function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', err);

  if (err.name === 'CastError') {
    return res
      .status(400)
      .json(formatErrorResponse(ERROR_CODES.BAD_REQUEST, `Invalid resource identifier: '${err.value}'`));
  }

  const status = err.status || err.statusCode || 500;
  const code = err.code || ERROR_CODES.INTERNAL_SERVER_ERROR;
  const message = err.message || 'An unexpected internal error occurred';
  const details = process.env.NODE_ENV === 'development' ? { stack: err.stack } : null;

  return res.status(status).json(formatErrorResponse(code, message, details));
}
