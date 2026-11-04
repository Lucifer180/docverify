import multer from 'multer';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.path}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let error = err;

  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: `A file is larger than ${Math.round(env.maxFileSizeBytes / 1024 / 1024)} MB`,
      LIMIT_FILE_COUNT: `You can upload at most ${env.maxFilesPerUpload} files at a time`,
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field (use "files")',
    };
    error = new ApiError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, messages[err.code] || err.message);
  } else if (err?.type === 'entity.too.large') {
    error = ApiError.payloadTooLarge('Request body is too large');
  } else if (err instanceof SyntaxError && 'body' in err) {
    error = ApiError.badRequest('Malformed JSON body');
  } else if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    error = ApiError.conflict('This record already exists');
  }

  if (!(error instanceof ApiError)) {
    // Unexpected error: log without sensitive content and hide details from the client.
    logger.error('Unhandled error', { method: req.method, path: req.path, error: err?.message, stack: env.isProduction ? undefined : err?.stack });
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }

  return res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(error.details ? { errors: error.details } : {}),
  });
}
