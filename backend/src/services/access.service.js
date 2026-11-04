import { ROLES } from '../models/user.model.js';
import { CASE_STATUS, EDITABLE_BY_SUBMITTER } from '../models/case.model.js';
import ApiError from '../utils/ApiError.js';

export const isStaff = (user) => user.role === ROLES.REVIEWER || user.role === ROLES.ADMIN;

/** Read access: submitters see their own cases; reviewers see submitted cases; admins see everything. */
export function assertCanView(user, caseRow) {
  if (!caseRow) throw ApiError.notFound('Case not found');
  if (user.role === ROLES.ADMIN) return;
  if (user.role === ROLES.SUBMITTER && caseRow.submitter_id === user.id) return;
  if (user.role === ROLES.REVIEWER && caseRow.status !== CASE_STATUS.OPEN) return;
  // Respond with 404 so case IDs belonging to others are not revealed.
  throw ApiError.notFound('Case not found');
}

/** Submitter edits (details, uploads, deletes) are allowed only while the case is open or sent back. */
export function assertSubmitterCanEdit(user, caseRow) {
  assertCanView(user, caseRow);
  const owner = caseRow.submitter_id === user.id;
  if (!owner && user.role !== ROLES.ADMIN) throw ApiError.forbidden('Only the submitter can change this case');
  if (!EDITABLE_BY_SUBMITTER.has(caseRow.status)) {
    throw ApiError.conflict('This case can no longer be changed (it is under review or already decided)');
  }
}

/** Reviewer actions (corrections, decisions) are allowed on submitted cases only. */
export function assertReviewerCanAct(user, caseRow) {
  assertCanView(user, caseRow);
  if (!isStaff(user)) throw ApiError.forbidden('Only reviewers can do this');
  if (caseRow.status !== CASE_STATUS.SUBMITTED) {
    throw ApiError.conflict('Reviewer actions are only possible on cases that are submitted for review');
  }
}

/** Sensitive values are shown in full only to reviewers/admins who explicitly ask (and it is audited). */
export const canReveal = (user) => isStaff(user);
