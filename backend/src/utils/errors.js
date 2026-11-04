/** A failure that may succeed if retried later (timeouts, rate limits, network errors). */
export class TransientError extends Error {
  constructor(message, { cause, retryAfterMs } = {}) {
    super(message);
    this.name = 'TransientError';
    this.cause = cause;
    this.retryAfterMs = retryAfterMs;
  }
}

/** A failure that will not succeed on retry (bad API key, malformed file). */
export class PermanentError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'PermanentError';
    this.cause = cause;
  }
}
