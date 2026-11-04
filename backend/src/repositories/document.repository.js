import { getDb } from '../config/db.js';
import { nowIso } from '../utils/ids.js';

export const documentRepository = {
  create(doc) {
    getDb().prepare(`INSERT INTO documents (id, case_id, uploaded_by, original_name, stored_name, mime_type, size_bytes, sha256)
                     VALUES (@id, @caseId, @uploadedBy, @originalName, @storedName, @mimeType, @sizeBytes, @sha256)`)
      .run(doc);
    return this.findById(doc.id);
  },

  findById(id) {
    return getDb().prepare('SELECT * FROM documents WHERE id = ?').get(id);
  },

  listByCase(caseId) {
    return getDb().prepare('SELECT * FROM documents WHERE case_id = ? ORDER BY created_at').all(caseId);
  },

  findDuplicateInCase(caseId, sha256) {
    return getDb().prepare('SELECT id, original_name FROM documents WHERE case_id = ? AND sha256 = ?').get(caseId, sha256);
  },

  update(id, fields) {
    const columns = {
      status: 'status', pageCount: 'page_count', documentType: 'document_type',
      classificationConfidence: 'classification_confidence', extractionMethod: 'extraction_method',
      ocrConfidence: 'ocr_confidence', rawText: 'raw_text', llmModel: 'llm_model',
      needsManualEntry: 'needs_manual_entry', errorMessage: 'error_message', timings: 'timings',
    };
    const sets = [];
    const params = { id, updated_at: nowIso() };
    for (const [key, column] of Object.entries(columns)) {
      if (fields[key] !== undefined) {
        sets.push(`${column} = @${column}`);
        let v = fields[key];
        if (key === 'timings') v = JSON.stringify(v);
        if (key === 'needsManualEntry') v = v ? 1 : 0;
        params[column] = v;
      }
    }
    if (sets.length) {
      getDb().prepare(`UPDATE documents SET ${sets.join(', ')}, updated_at = @updated_at WHERE id = @id`).run(params);
    }
    return this.findById(id);
  },

  delete(id) {
    getDb().prepare('DELETE FROM documents WHERE id = ?').run(id);
  },

  /** Documents older than the retention cutoff in finished cases. */
  findExpired(cutoffIso) {
    return getDb().prepare(`SELECT d.* FROM documents d JOIN cases c ON c.id = d.case_id
                            WHERE c.status IN ('approved', 'rejected') AND d.created_at < ?`).all(cutoffIso);
  },

  stats() {
    return getDb().prepare(`SELECT COUNT(*) AS total,
        AVG(CAST(json_extract(timings, '$.totalMs') AS REAL)) AS avg_total_ms,
        MAX(CAST(json_extract(timings, '$.totalMs') AS REAL)) AS max_total_ms,
        AVG(CAST(json_extract(timings, '$.textMs') AS REAL)) AS avg_text_ms,
        AVG(CAST(json_extract(timings, '$.llmMs') AS REAL)) AS avg_llm_ms,
        SUM(CASE WHEN status = 'processing_failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN needs_manual_entry = 1 THEN 1 ELSE 0 END) AS manual_entry
      FROM documents`).get();
  },
};
