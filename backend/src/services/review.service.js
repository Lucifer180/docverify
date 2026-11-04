import { caseRepository } from '../repositories/case.repository.js';
import { documentRepository } from '../repositories/document.repository.js';
import { reviewDecisionRepository } from '../repositories/reviewDecision.repository.js';
import { toCase, CASE_STATUS, PRELIMINARY_STATUS } from '../models/case.model.js';
import { DECISIONS, COMMENT_REQUIRED } from '../models/reviewDecision.model.js';
import { IN_PROGRESS_STATUSES } from '../models/document.model.js';
import { AUDIT_ACTIONS } from '../models/auditLog.model.js';
import { assertReviewerCanAct } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { newId, nowIso } from '../utils/ids.js';
import { transaction } from '../config/db.js';
import ApiError from '../utils/ApiError.js';

const STATUS_FOR_DECISION = {
  [DECISIONS.APPROVED]: CASE_STATUS.APPROVED,
  [DECISIONS.REJECTED]: CASE_STATUS.REJECTED,
  [DECISIONS.CORRECTION_REQUESTED]: CASE_STATUS.CORRECTION_REQUESTED,
};

export const reviewService = {
  /** Records the human decision. Automated results are never an approval on their own. */
  decide(user, caseId, { decision, comment }, { ip }) {
    const caseRow = caseRepository.findById(caseId);
    assertReviewerCanAct(user, caseRow);

    const trimmed = comment?.trim() || '';
    if (COMMENT_REQUIRED.has(decision) && !trimmed) {
      throw ApiError.badRequest('A comment is required when rejecting or requesting corrections');
    }
    const docs = documentRepository.listByCase(caseId);
    if (docs.some((d) => IN_PROGRESS_STATUSES.has(d.status))) {
      throw ApiError.conflict('Some documents are still being processed');
    }
    if (decision === DECISIONS.APPROVED && caseRow.preliminary_status === PRELIMINARY_STATUS.FLAGGED && !trimmed) {
      throw ApiError.badRequest('Add a comment explaining why this flagged case is approved');
    }

    transaction(() => {
      reviewDecisionRepository.create({ id: newId(), caseId, reviewerId: user.id, decision, comment: trimmed || null });
      caseRepository.update(caseId, {
        status: STATUS_FOR_DECISION[decision],
        decidedAt: decision === DECISIONS.CORRECTION_REQUESTED ? null : nowIso(),
        assignedReviewerId: caseRow.assigned_reviewer_id || user.id,
      });
    });
    recordAudit({ user, ip, action: AUDIT_ACTIONS.CASE_DECISION, entityType: 'case', entityId: caseId,
      details: { decision, comment: trimmed || undefined, preliminaryStatus: caseRow.preliminary_status } });
    return toCase(caseRepository.findById(caseId));
  },
};
