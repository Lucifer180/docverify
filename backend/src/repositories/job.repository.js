import { getDb } from '../config/db.js';
import { nowIso } from '../utils/ids.js';

export const jobRepository = {
  enqueue({ id, type, payload, maxAttempts, runAt = nowIso() }) {
    getDb().prepare('INSERT INTO jobs (id, type, payload, max_attempts, run_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, type, JSON.stringify(payload || {}), maxAttempts, runAt);
  },

  /** Atomically claims the next due job. */
  claimNext() {
    const now = nowIso();
    return getDb().prepare(`UPDATE jobs SET status = 'running', attempts = attempts + 1, updated_at = @now
      WHERE id = (SELECT id FROM jobs WHERE status = 'queued' AND run_at <= @now ORDER BY run_at LIMIT 1)
      RETURNING *`).get({ now });
  },

  complete(id) {
    getDb().prepare("UPDATE jobs SET status = 'done', last_error = NULL, updated_at = ? WHERE id = ?").run(nowIso(), id);
  },

  retryLater(id, error, runAt) {
    getDb().prepare("UPDATE jobs SET status = 'queued', last_error = ?, run_at = ?, updated_at = ? WHERE id = ?")
      .run(error, runAt, nowIso(), id);
  },

  fail(id, error) {
    getDb().prepare("UPDATE jobs SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?").run(error, nowIso(), id);
  },

  /** Jobs left 'running' by a crash or restart are put back in the queue. */
  requeueStale() {
    return getDb().prepare("UPDATE jobs SET status = 'queued', updated_at = ? WHERE status = 'running'").run(nowIso()).changes;
  },

  hasPendingForPayload(type, key, value) {
    return Boolean(getDb().prepare(`SELECT 1 FROM jobs WHERE type = ? AND status IN ('queued', 'running')
      AND json_extract(payload, '$.' || ?) = ? LIMIT 1`).get(type, key, value));
  },

  makeAllDue() {
    getDb().prepare("UPDATE jobs SET run_at = ? WHERE status = 'queued'").run(new Date(0).toISOString());
  },

  counts() {
    return getDb().prepare('SELECT status, COUNT(*) AS n FROM jobs GROUP BY status').all();
  },
};
