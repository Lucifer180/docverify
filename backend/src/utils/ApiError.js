/**
 * Operational error with an HTTP status code. Anything thrown that is not an
 * ApiError is treated as an unexpected 500 by the error middleware.
 */
export default class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message = 'Bad request', details) { return new ApiError(400, message, details); }
  static unauthorized(message = 'Authentication required') { return new ApiError(401, message); }
  static forbidden(message = 'You do not have permission to do this') { return new ApiError(403, message); }
  static notFound(message = 'Not found') { return new ApiError(404, message); }
  static conflict(message = 'Conflict') { return new ApiError(409, message); }
  static payloadTooLarge(message = 'File is too large') { return new ApiError(413, message); }
  static unsupportedMedia(message = 'Unsupported file type') { return new ApiError(415, message); }
}
