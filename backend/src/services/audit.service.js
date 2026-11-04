import { auditLogRepository } from '../repositories/auditLog.repository.js';
import { toAuditLog } from '../models/auditLog.model.js';
import logger from '../utils/logger.js';

/**
 * Writes an append-only audit entry. Callers must pass masked values for
 * sensitive fields; the audit log never stores raw identity numbers.
 * Audit failures are logged but never break the user's request.
 */
export function recordAudit({ user, action, entityType, entityId, details, ip }) {
  try {
    auditLogRepository.insert({
      userId: user?.id, userEmail: user?.email, action, entityType, entityId, details, ipAddress: ip,
    });
  } catch (err) {
    logger.error('Failed to write audit log', { action, error: err.message });
  }
}

export const auditService = {
  list(query) {
    const { rows, total } = auditLogRepository.list(query);
    return { items: rows.map(toAuditLog), total };
  },
};
