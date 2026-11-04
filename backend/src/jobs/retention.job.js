import env from '../config/env.js';
import { documentRepository } from '../repositories/document.repository.js';
import { storageService } from '../services/storage.service.js';
import { recordAudit } from '../services/audit.service.js';
import { AUDIT_ACTIONS } from '../models/auditLog.model.js';
import logger from '../utils/logger.js';

/**
 * Deletes stored files (and their extracted text) for decided cases older than
 * DOCUMENT_RETENTION_DAYS. Metadata and the audit trail are kept.
 */
export async function purgeExpiredDocuments(now = new Date()) {
  const cutoff = new Date(now.getTime() - env.documentRetentionDays * 24 * 60 * 60 * 1000).toISOString();
  const expired = documentRepository.findExpired(cutoff).filter((d) => storageService.exists(d.stored_name));
  for (const doc of expired) {
    await storageService.remove(doc.stored_name);
    documentRepository.update(doc.id, { rawText: '', errorMessage: 'File deleted after the retention period' });
    recordAudit({ user: { email: 'system' }, action: AUDIT_ACTIONS.RETENTION_PURGE, entityType: 'document',
      entityId: doc.id, details: { retentionDays: env.documentRetentionDays } });
  }
  if (expired.length) logger.info(`Retention: deleted ${expired.length} expired file(s)`);
  return expired.length;
}

let timer;
export function startRetentionSchedule() {
  const DAY = 24 * 60 * 60 * 1000;
  purgeExpiredDocuments().catch((e) => logger.error('Retention purge failed', { error: e.message }));
  timer = setInterval(() => {
    purgeExpiredDocuments().catch((e) => logger.error('Retention purge failed', { error: e.message }));
  }, DAY);
  timer.unref();
}
export function stopRetentionSchedule() { if (timer) clearInterval(timer); }
