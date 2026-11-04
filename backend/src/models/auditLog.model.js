export const AUDIT_ACTIONS = Object.freeze({
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGIN_FAILED: 'user.login_failed',
  USER_UPDATED: 'user.updated',
  CASE_CREATED: 'case.created',
  CASE_UPDATED: 'case.updated',
  CASE_SUBMITTED: 'case.submitted',
  CASE_ASSIGNED: 'case.assigned',
  CASE_DECISION: 'case.decision',
  CASE_REPORT_EXPORTED: 'case.report_exported',
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_DELETED: 'document.deleted',
  DOCUMENT_REPROCESSED: 'document.reprocess_requested',
  DOCUMENT_VIEWED: 'document.file_viewed',
  PROCESSING_TEXT_EXTRACTED: 'processing.text_extracted',
  PROCESSING_FIELDS_EXTRACTED: 'processing.fields_extracted',
  PROCESSING_VALIDATED: 'processing.validated',
  PROCESSING_FAILED: 'processing.failed',
  FIELDS_CORRECTED: 'fields.corrected',
  SENSITIVE_REVEALED: 'fields.sensitive_revealed',
  DOCUMENT_TYPE_CREATED: 'document_type.created',
  DOCUMENT_TYPE_UPDATED: 'document_type.updated',
  RETENTION_PURGE: 'retention.purged',
});

export function toAuditLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: JSON.parse(row.details || '{}'),
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  };
}
