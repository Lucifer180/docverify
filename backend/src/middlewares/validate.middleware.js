import ApiError from '../utils/ApiError.js';

/**
 * Validates request parts with Zod schemas. Parsed values are placed on req.valid
 * (Express 5 makes req.query read-only, so we never overwrite it).
 *   router.post('/', validate({ body: schema }), controller)
 */
export const validate = (schemas) => (req, _res, next) => {
  req.valid = req.valid || {};
  const errors = [];
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (result.success) {
      req.valid[part] = result.data;
    } else {
      for (const issue of result.error.issues) {
        errors.push({ location: part, field: issue.path.join('.') || null, message: issue.message });
      }
    }
  }
  if (errors.length) return next(ApiError.badRequest('Validation failed', errors));
  return next();
};
