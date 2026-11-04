export const JOB_TYPES = Object.freeze({ PROCESS_DOCUMENT: 'process_document', EVALUATE_CASE: 'evaluate_case' });
export const JOB_STATUS = Object.freeze({ QUEUED: 'queued', RUNNING: 'running', DONE: 'done', FAILED: 'failed' });

export function toJob(row) {
  if (!row) return null;
  return { ...row, payload: JSON.parse(row.payload || '{}') };
}
