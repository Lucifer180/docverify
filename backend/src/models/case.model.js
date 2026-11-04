export const CASE_STATUS = Object.freeze({
  OPEN: 'open',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CORRECTION_REQUESTED: 'correction_requested',
});

export const PRELIMINARY_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  PASSED: 'passed', // "Passed Automated Checks" - not an approval
  FLAGGED: 'flagged', // "Flagged for Review"
});

/** Statuses in which the submitter may still add documents or edit details. */
export const EDITABLE_BY_SUBMITTER = new Set([CASE_STATUS.OPEN, CASE_STATUS.CORRECTION_REQUESTED]);

export function toCase(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    applicantName: row.applicant_name,
    applicantDob: row.applicant_dob,
    applicantDetails: JSON.parse(row.applicant_details || '{}'),
    submitterId: row.submitter_id,
    submitterName: row.submitter_name,
    assignedReviewerId: row.assigned_reviewer_id,
    assignedReviewerName: row.reviewer_name,
    status: row.status,
    preliminaryStatus: row.preliminary_status,
    issueSummary: row.issue_summary,
    documentCount: row.document_count,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
