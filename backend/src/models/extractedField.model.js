export const FIELD_SOURCES = Object.freeze({ LLM: 'llm', REVIEWER: 'reviewer', MANUAL: 'manual' });

export function toExtractedFields(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentId: row.document_id,
    version: row.version,
    data: JSON.parse(row.data || '{}'),
    source: row.source,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    note: row.note,
    createdAt: row.created_at,
  };
}
