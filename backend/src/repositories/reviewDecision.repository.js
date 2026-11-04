import { getDb } from '../config/db.js';

export const reviewDecisionRepository = {
  create({ id, caseId, reviewerId, decision, comment }) {
    getDb().prepare('INSERT INTO review_decisions (id, case_id, reviewer_id, decision, comment) VALUES (?, ?, ?, ?, ?)')
      .run(id, caseId, reviewerId, decision, comment ?? null);
  },

  listByCase(caseId) {
    return getDb().prepare(`SELECT rd.*, u.name AS reviewer_name FROM review_decisions rd
                            JOIN users u ON u.id = rd.reviewer_id
                            WHERE rd.case_id = ? ORDER BY rd.created_at DESC`).all(caseId);
  },
};
