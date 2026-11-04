import { getDb } from '../config/db.js';

export const extractedFieldRepository = {
  /** Adds a new version of the extracted data for a document. */
  addVersion({ id, documentId, data, source, createdBy = null, note = null }) {
    const db = getDb();
    const { next } = db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS next FROM extracted_fields WHERE document_id = ?')
      .get(documentId);
    db.prepare(`INSERT INTO extracted_fields (id, document_id, version, data, source, created_by, note)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, documentId, next, JSON.stringify(data), source, createdBy, note);
    return this.findLatest(documentId);
  },

  findLatest(documentId) {
    return getDb().prepare(`SELECT ef.*, u.name AS created_by_name FROM extracted_fields ef
                            LEFT JOIN users u ON u.id = ef.created_by
                            WHERE ef.document_id = ? ORDER BY ef.version DESC LIMIT 1`).get(documentId);
  },

  listVersions(documentId) {
    return getDb().prepare(`SELECT ef.*, u.name AS created_by_name FROM extracted_fields ef
                            LEFT JOIN users u ON u.id = ef.created_by
                            WHERE ef.document_id = ? ORDER BY ef.version DESC`).all(documentId);
  },
};
