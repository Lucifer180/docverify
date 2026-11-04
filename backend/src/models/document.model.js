export const DOCUMENT_STATUS = Object.freeze({
  UPLOADED: 'uploaded',
  TEXT_EXTRACTED: 'text_extracted',
  FIELDS_EXTRACTED: 'fields_extracted',
  PASSED: 'passed',
  FLAGGED: 'flagged',
  PROCESSING_FAILED: 'processing_failed',
});

export const IN_PROGRESS_STATUSES = new Set([
  DOCUMENT_STATUS.UPLOADED, DOCUMENT_STATUS.TEXT_EXTRACTED, DOCUMENT_STATUS.FIELDS_EXTRACTED,
]);

export const ALLOWED_MIME_TYPES = Object.freeze({
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
});

export function toDocument(row, { includeText = false } = {}) {
  if (!row) return null;
  const doc = {
    id: row.id,
    caseId: row.case_id,
    uploadedBy: row.uploaded_by,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    pageCount: row.page_count,
    status: row.status,
    documentType: row.document_type,
    classificationConfidence: row.classification_confidence,
    extractionMethod: row.extraction_method,
    ocrConfidence: row.ocr_confidence,
    llmModel: row.llm_model,
    needsManualEntry: Boolean(row.needs_manual_entry),
    errorMessage: row.error_message,
    timings: JSON.parse(row.timings || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeText) doc.rawText = row.raw_text;
  return doc;
}
