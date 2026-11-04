import { getDb } from '../config/db.js';
import { nowIso } from '../utils/ids.js';

const BASE_SELECT = `
  SELECT c.*, s.name AS submitter_name, r.name AS reviewer_name,
         (SELECT COUNT(*) FROM documents d WHERE d.case_id = c.id) AS document_count
  FROM cases c
  JOIN users s ON s.id = c.submitter_id
  LEFT JOIN users r ON r.id = c.assigned_reviewer_id`;

export const caseRepository = {
  /** Generates the next human-readable reference, e.g. CASE-2026-0007. */
  nextReference() {
    const year = new Date().getFullYear();
    const name = `case_ref_${year}`;
    const db = getDb();
    db.prepare(`INSERT INTO counters (name, value) VALUES (?, 1)
                ON CONFLICT(name) DO UPDATE SET value = value + 1`).run(name);
    const { value } = db.prepare('SELECT value FROM counters WHERE name = ?').get(name);
    return `CASE-${year}-${String(value).padStart(4, '0')}`;
  },

  create({ id, reference, title, applicantName, applicantDob, applicantDetails, submitterId }) {
    getDb().prepare(`INSERT INTO cases (id, reference, title, applicant_name, applicant_dob, applicant_details, submitter_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, reference, title, applicantName, applicantDob ?? null, JSON.stringify(applicantDetails || {}), submitterId);
    return this.findById(id);
  },

  findById(id) {
    return getDb().prepare(`${BASE_SELECT} WHERE c.id = ?`).get(id);
  },

  list({ submitterId, status, preliminaryStatus, assignedReviewerId, excludeOpen, search, limit = 20, offset = 0 } = {}) {
    const where = [];
    const params = {};
    if (submitterId) { where.push('c.submitter_id = @submitterId'); params.submitterId = submitterId; }
    if (status) { where.push('c.status = @status'); params.status = status; }
    if (preliminaryStatus) { where.push('c.preliminary_status = @preliminaryStatus'); params.preliminaryStatus = preliminaryStatus; }
    if (assignedReviewerId) { where.push('c.assigned_reviewer_id = @assignedReviewerId'); params.assignedReviewerId = assignedReviewerId; }
    if (excludeOpen) where.push("c.status <> 'open'");
    if (search) {
      where.push('(c.reference LIKE @search OR c.title LIKE @search OR c.applicant_name LIKE @search)');
      params.search = `%${search}%`;
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = getDb().prepare(`${BASE_SELECT} ${clause} ORDER BY c.updated_at DESC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset });
    const total = getDb().prepare(`SELECT COUNT(*) AS n FROM cases c ${clause}`).get(params).n;
    return { rows, total };
  },

  update(id, fields) {
    const columns = {
      title: 'title', applicantName: 'applicant_name', applicantDob: 'applicant_dob',
      applicantDetails: 'applicant_details', status: 'status', preliminaryStatus: 'preliminary_status',
      issueSummary: 'issue_summary', assignedReviewerId: 'assigned_reviewer_id',
      submittedAt: 'submitted_at', decidedAt: 'decided_at',
    };
    const sets = [];
    const params = { id, updated_at: nowIso() };
    for (const [key, column] of Object.entries(columns)) {
      if (fields[key] !== undefined) {
        sets.push(`${column} = @${column}`);
        params[column] = key === 'applicantDetails' ? JSON.stringify(fields[key]) : fields[key];
      }
    }
    if (sets.length) {
      getDb().prepare(`UPDATE cases SET ${sets.join(', ')}, updated_at = @updated_at WHERE id = @id`).run(params);
    }
    return this.findById(id);
  },

  countsByStatus({ submitterId } = {}) {
    const clause = submitterId ? 'WHERE submitter_id = ?' : '';
    const args = submitterId ? [submitterId] : [];
    const status = getDb().prepare(`SELECT status, COUNT(*) AS n FROM cases ${clause} GROUP BY status`).all(...args);
    const preliminary = getDb()
      .prepare(`SELECT preliminary_status AS status, COUNT(*) AS n FROM cases ${clause} GROUP BY preliminary_status`)
      .all(...args);
    return { status, preliminary };
  },
};
