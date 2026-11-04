import { getDb } from '../config/db.js';

export const validationResultRepository = {
  /** Replaces all results for a case in one transaction. */
  replaceForCase(caseId, results) {
    const db = getDb();
    const insert = db.prepare(`INSERT INTO validation_results
      (id, case_id, document_id, scope, rule, field, severity, passed, message, details)
      VALUES (@id, @caseId, @documentId, @scope, @rule, @field, @severity, @passed, @message, @details)`);
    db.transaction(() => {
      db.prepare('DELETE FROM validation_results WHERE case_id = ?').run(caseId);
      for (const r of results) {
        insert.run({
          id: r.id, caseId, documentId: r.documentId ?? null, scope: r.scope, rule: r.rule,
          field: r.field ?? null, severity: r.severity, passed: r.passed ? 1 : 0, message: r.message,
          details: JSON.stringify(r.details || {}),
        });
      }
    })();
  },

  listByCase(caseId) {
    return getDb().prepare(`SELECT * FROM validation_results WHERE case_id = ?
      ORDER BY passed ASC, CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at`).all(caseId);
  },
};
