import { ERROR_CODES } from '@aidflow/shared';

/**
 * Middleware that prevents clients from setting protected fields directly in request bodies.
 * @param {...string} protectedFields
 */
export function guardProtectedFields(...protectedFields) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') return next();

    for (const field of protectedFields) {
      if (req.body[field] !== undefined) {
        return res.fail(
          ERROR_CODES.PROTECTED_FIELD_MODIFICATION,
          `Cannot directly set protected field '${field}'. This property is managed internally by the AidFlow engine.`,
          { attemptedField: field, protectedFields },
          400
        );
      }
    }
    next();
  };
}
