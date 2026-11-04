import { IN_PROGRESS } from '../../constants/app.constants';

export const isEditableBySubmitter = (c) => c.status === 'open' || c.status === 'correction_requested';
export const isDecided = (c) => c.status === 'approved' || c.status === 'rejected';

/** Failed checks only (errors and warnings), errors first. */
export function issuesOf(results, { documentId } = {}) {
  return results
    .filter((r) => !r.passed && r.severity !== 'info')
    .filter((r) => !documentId || r.documentId === documentId || r.details?.documentIds?.includes(documentId))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}

export const isProcessing = (detail) => Boolean(detail)
  && (detail.case.preliminaryStatus === 'processing' || detail.documents.some((d) => IN_PROGRESS.has(d.status)));

export const RULE_LABELS = {
  required: 'Required field', format: 'Format', pattern: 'Format', matches_submitter: 'Matches entered details',
  cross_document_person_name: 'Name across documents', cross_document_date_of_birth: 'Date of birth across documents',
  cross_document_father_name: "Father's name across documents", low_quality_image: 'Image quality',
  low_ocr_confidence: 'OCR confidence', manual_entry_required: 'Manual entry', low_classification_confidence: 'Document type',
  unsupported_document_type: 'Unsupported type', processing_failed: 'Processing',
};

export const ruleLabel = (rule) => RULE_LABELS[rule] || rule.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
