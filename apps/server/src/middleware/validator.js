import { ERROR_CODES } from '@aidflow/shared';

/**
 * Validates req.body using a Zod schema.
 * @param {import('zod').ZodSchema} schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const formattedErrors = result.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      return res.fail(
        ERROR_CODES.VALIDATION_ERROR,
        'Request validation failed',
        formattedErrors,
        422
      );
    }
    req.validatedBody = result.data;
    next();
  };
}

/**
 * Validates req.query using a Zod schema.
 * @param {import('zod').ZodSchema} schema
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const formattedErrors = result.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      return res.fail(
        ERROR_CODES.VALIDATION_ERROR,
        'Query validation failed',
        formattedErrors,
        422
      );
    }
    req.validatedQuery = result.data;
    next();
  };
}
