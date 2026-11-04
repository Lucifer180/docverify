import { caseRepository } from '../repositories/case.repository.js';
import { documentRepository } from '../repositories/document.repository.js';
import { extractedFieldRepository } from '../repositories/extractedField.repository.js';
import { validationResultRepository } from '../repositories/validationResult.repository.js';
import { reviewDecisionRepository } from '../repositories/reviewDecision.repository.js';
import { auditLogRepository } from '../repositories/auditLog.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { toCase, CASE_STATUS, PRELIMINARY_STATUS } from '../models/case.model.js';
import { toDocument, IN_PROGRESS_STATUSES } from '../models/document.model.js';
import { toExtractedFields } from '../models/extractedField.model.js';
import { toValidationResult } from '../models/validationResult.model.js';
import { toReviewDecision } from '../models/reviewDecision.model.js';
import { toAuditLog, AUDIT_ACTIONS } from '../models/auditLog.model.js';
import { ROLES } from '../models/user.model.js';
import { documentTypeService } from './documentType.service.js';
import { recordAudit } from './audit.service.js';
import { assertCanView, assertSubmitterCanEdit, canReveal, isStaff } from './access.service.js';
import { evaluateCase } from './processing.service.js';
import { maskFields, maskValue } from '../utils/mask.js';
import { newId, nowIso } from '../utils/ids.js';
import ApiError from '../utils/ApiError.js';

/** Masks sensitive values in audit details (field corrections store old/new values). */
function maskAuditDetails(details, typeMap) {
  if (!details?.changes) return details;
  const sensitive = new Set();
  for (const t of typeMap.values()) for (const f of t.fields) if (f.sensitive) sensitive.add(f.key);
  return {
    ...details,
    changes: details.changes.map((c) => (sensitive.has(c.field) ? { ...c, from: maskValue(c.from), to: maskValue(c.to) } : c)),
  };
}

export const caseService = {
  create(user, data, { ip }) {
    const id = newId();
    const row = caseRepository.create({
      id,
      reference: caseRepository.nextReference(),
      title: data.title,
      applicantName: data.applicantName,
      applicantDob: data.applicantDob,
      applicantDetails: data.applicantDetails,
      submitterId: user.id,
    });
    recordAudit({ user, ip, action: AUDIT_ACTIONS.CASE_CREATED, entityType: 'case', entityId: id,
      details: { reference: row.reference } });
    return toCase(row);
  },

  list(user, query) {
    const filter = { ...query };
    if (user.role === ROLES.SUBMITTER) filter.submitterId = user.id;
    if (user.role === ROLES.REVIEWER) filter.excludeOpen = true;
    if (query.mine && isStaff(user)) filter.assignedReviewerId = user.id;
    const { rows, total } = caseRepository.list(filter);
    return { items: rows.map(toCase), total };
  },

  /**
   * Full case view: documents with their latest extracted fields, all check results,
   * decisions and type definitions. Sensitive fields are masked unless a reviewer asks to reveal them.
   */
  getDetail(user, id, { reveal = false, ip } = {}) {
    const caseRow = caseRepository.findById(id);
    assertCanView(user, caseRow);
    const typeMap = documentTypeService.map();
    const showFull = reveal && canReveal(user);

    const documents = documentRepository.listByCase(id).map((row) => {
      const doc = toDocument(row);
      const latest = toExtractedFields(extractedFieldRepository.findLatest(row.id));
      const typeDef = typeMap.get(row.document_type);
      if (latest) {
        latest.data = showFull ? latest.data : maskFields(latest.data, typeDef?.fields);
      }
      doc.fields = latest;
      doc.versionCount = latest?.version || 0;
      return doc;
    });

    if (showFull) {
      recordAudit({ user, ip, action: AUDIT_ACTIONS.SENSITIVE_REVEALED, entityType: 'case', entityId: id });
    }

    const results = validationResultRepository.listByCase(id).map(toValidationResult);
    const types = {};
    for (const doc of documents) {
      if (doc.documentType && typeMap.has(doc.documentType)) types[doc.documentType] = typeMap.get(doc.documentType);
    }

    return {
      case: toCase(caseRow),
      documents,
      results,
      decisions: reviewDecisionRepository.listByCase(id).map(toReviewDecision),
      documentTypes: types,
      sensitiveRevealed: showFull,
      summary: {
        errors: results.filter((r) => !r.passed && r.severity === 'error').length,
        warnings: results.filter((r) => !r.passed && r.severity === 'warning').length,
        passedChecks: results.filter((r) => r.passed).length,
        processing: documents.filter((d) => IN_PROGRESS_STATUSES.has(d.status)).length,
      },
    };
  },

  async update(user, id, data, { ip }) {
    const caseRow = caseRepository.findById(id);
    assertSubmitterCanEdit(user, caseRow);
    const updated = caseRepository.update(id, data);
    recordAudit({ user, ip, action: AUDIT_ACTIONS.CASE_UPDATED, entityType: 'case', entityId: id,
      details: { changed: Object.keys(data) } });
    // Submitter details are compared with documents, so re-run the checks.
    if (documentRepository.listByCase(id).length) await evaluateCase(id);
    return toCase(caseRepository.findById(updated.id));
  },

  submit(user, id, { ip }) {
    const caseRow = caseRepository.findById(id);
    assertSubmitterCanEdit(user, caseRow);
    if (!documentRepository.listByCase(id).length) throw ApiError.badRequest('Upload at least one document before submitting');
    const updated = caseRepository.update(id, { status: CASE_STATUS.SUBMITTED, submittedAt: nowIso() });
    recordAudit({ user, ip, action: AUDIT_ACTIONS.CASE_SUBMITTED, entityType: 'case', entityId: id,
      details: { preliminaryStatus: updated.preliminary_status, resubmission: caseRow.status === CASE_STATUS.CORRECTION_REQUESTED } });
    return toCase(updated);
  },

  assign(user, id, reviewerId, { ip }) {
    const caseRow = caseRepository.findById(id);
    assertCanView(user, caseRow);
    if (!isStaff(user)) throw ApiError.forbidden('Only reviewers can be assigned');
    const target = reviewerId ?? user.id;
    if (user.role === ROLES.REVIEWER && target !== user.id) throw ApiError.forbidden('Reviewers can only assign cases to themselves');
    if (target) {
      const reviewer = userRepository.findById(target);
      if (!reviewer || ![ROLES.REVIEWER, ROLES.ADMIN].includes(reviewer.role) || !reviewer.is_active) {
        throw ApiError.badRequest('Selected user is not an active reviewer');
      }
    }
    const updated = caseRepository.update(id, { assignedReviewerId: target });
    recordAudit({ user, ip, action: AUDIT_ACTIONS.CASE_ASSIGNED, entityType: 'case', entityId: id, details: { reviewerId: target } });
    return toCase(updated);
  },

  history(user, id) {
    const caseRow = caseRepository.findById(id);
    assertCanView(user, caseRow);
    const docIds = documentRepository.listByCase(id).map((d) => d.id);
    const typeMap = documentTypeService.map();
    return auditLogRepository.listForCase(id, docIds).map(toAuditLog)
      .map((a) => ({ ...a, details: maskAuditDetails(a.details, typeMap) }));
  },

  dashboard(user) {
    const scope = user.role === ROLES.SUBMITTER ? { submitterId: user.id } : {};
    const counts = caseRepository.countsByStatus(scope);
    const toObj = (arr) => Object.fromEntries(arr.map((r) => [r.status, r.n]));
    const recent = this.list(user, { limit: 6, offset: 0 }).items;
    const awaitingReview = isStaff(user)
      ? caseRepository.list({ status: CASE_STATUS.SUBMITTED, limit: 1 }).total
      : undefined;
    const data = { status: toObj(counts.status), preliminary: toObj(counts.preliminary), recent, awaitingReview };
    if (isStaff(user)) {
      const s = documentRepository.stats();
      data.processing = {
        documents: s.total,
        avgProcessingMs: s.avg_total_ms ? Math.round(s.avg_total_ms) : null,
        maxProcessingMs: s.max_total_ms ? Math.round(s.max_total_ms) : null,
        avgTextMs: s.avg_text_ms ? Math.round(s.avg_text_ms) : null,
        avgLlmMs: s.avg_llm_ms ? Math.round(s.avg_llm_ms) : null,
        failed: s.failed || 0,
        manualEntry: s.manual_entry || 0,
      };
    }
    return data;
  },
};

export { PRELIMINARY_STATUS };
