export const DECISIONS = Object.freeze({
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CORRECTION_REQUESTED: 'correction_requested',
});

/** Decisions that must include a reviewer comment. */
export const COMMENT_REQUIRED = new Set([DECISIONS.REJECTED, DECISIONS.CORRECTION_REQUESTED]);

export function toReviewDecision(row) {
  if (!row) return null;
  return {
    id: row.id,
    caseId: row.case_id,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    decision: row.decision,
    comment: row.comment,
    createdAt: row.created_at,
  };
}
