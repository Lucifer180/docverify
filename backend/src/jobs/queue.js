import env from '../config/env.js';
import { jobRepository } from '../repositories/job.repository.js';
import { toJob } from '../models/job.model.js';
import { PermanentError } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
import logger from '../utils/logger.js';

/**
 * A small persistent job queue stored in SQLite.
 * Long-running OCR and LLM work runs here instead of inside web requests.
 * Jobs survive restarts; failed jobs are retried with increasing delays.
 */
const handlers = new Map();
let timer = null;
let running = 0;
let stopping = false;

export function registerHandler(type, { handle, onFailed }) {
  handlers.set(type, { handle, onFailed });
}

export function enqueue(type, payload, { delayMs = 0 } = {}) {
  const id = newId();
  jobRepository.enqueue({
    id, type, payload, maxAttempts: env.jobMaxAttempts, runAt: new Date(Date.now() + delayMs).toISOString(),
  });
  if (timer) setImmediate(tick);
  return id;
}

export function backoffMs(attempt, retryAfterMs) {
  if (retryAfterMs) return Math.min(retryAfterMs, 10 * 60 * 1000);
  return Math.min(5000 * 2 ** (attempt - 1), 5 * 60 * 1000); // 5s, 10s, 20s, 40s ... max 5 min
}

async function runJob(row) {
  const job = toJob(row);
  const handler = handlers.get(job.type);
  if (!handler) {
    jobRepository.fail(job.id, `No handler for job type ${job.type}`);
    return;
  }
  try {
    await handler.handle(job.payload, job);
    jobRepository.complete(job.id);
  } catch (err) {
    const message = String(err?.message || err).slice(0, 1000);
    const permanent = err instanceof PermanentError;
    if (!permanent && job.attempts < job.max_attempts) {
      const delay = backoffMs(job.attempts, err.retryAfterMs);
      logger.warn('Job failed, will retry', { type: job.type, attempt: job.attempts, delayMs: delay, error: message });
      jobRepository.retryLater(job.id, message, new Date(Date.now() + delay).toISOString());
    } else {
      logger.error('Job failed permanently', { type: job.type, attempts: job.attempts, error: message });
      jobRepository.fail(job.id, message);
      try { await handler.onFailed?.(job.payload, err); } catch (e) { logger.error('onFailed handler error', { error: e.message }); }
    }
  }
}

function tick() {
  if (stopping) return;
  while (running < env.jobConcurrency) {
    const row = jobRepository.claimNext();
    if (!row) break;
    running += 1;
    runJob(row).finally(() => {
      running -= 1;
      if (!stopping) setImmediate(tick);
    });
  }
}

export function startQueue() {
  stopping = false;
  const resumed = jobRepository.requeueStale();
  if (resumed) logger.info(`Resumed ${resumed} interrupted job(s)`);
  timer = setInterval(tick, env.jobPollIntervalMs);
  tick();
}

export async function stopQueue() {
  stopping = true;
  if (timer) clearInterval(timer);
  timer = null;
  const deadline = Date.now() + 10000;
  while (running > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
}

/** Runs queued jobs until none are left (used by tests and scripts). Ignores scheduled delays. */
export async function drainQueue({ ignoreDelay = true, maxJobs = 500 } = {}) {
  let processed = 0;
  for (;;) {
    if (ignoreDelay) {
      // Make delayed retries due now.
      jobRepository.makeAllDue();
    }
    const row = jobRepository.claimNext();
    if (!row || processed >= maxJobs) break;
    await runJob(row);
    processed += 1;
  }
  return processed;
}
