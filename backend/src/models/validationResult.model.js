export const SEVERITY = Object.freeze({ ERROR: 'error', WARNING: 'warning', INFO: 'info' });

export function toValidationResult(row) {
  if (!row) return null;
  return {
    id: row.id,
    caseId: row.case_id,
    documentId: row.document_id,
    scope: row.scope,
    rule: row.rule,
    field: row.field,
    severity: row.severity,
    passed: Boolean(row.passed),
    message: row.message,
    details: JSON.parse(row.details || '{}'),
    createdAt: row.created_at,
  };
}
