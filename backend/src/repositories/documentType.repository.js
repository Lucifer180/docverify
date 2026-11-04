import { getDb } from '../config/db.js';
import { nowIso } from '../utils/ids.js';

export const documentTypeRepository = {
  list({ includeInactive = false } = {}) {
    const sql = includeInactive
      ? 'SELECT * FROM document_types ORDER BY name'
      : 'SELECT * FROM document_types WHERE is_active = 1 ORDER BY name';
    return getDb().prepare(sql).all();
  },

  findByKey(key) {
    return getDb().prepare('SELECT * FROM document_types WHERE key = ?').get(key);
  },

  insertIfMissing({ key, name, description, fields, rules }) {
    getDb().prepare(`INSERT OR IGNORE INTO document_types (key, name, description, fields, rules)
                     VALUES (?, ?, ?, ?, ?)`)
      .run(key, name, description, JSON.stringify(fields), JSON.stringify(rules));
  },

  create({ key, name, description, fields, rules, isActive = true }) {
    getDb().prepare(`INSERT INTO document_types (key, name, description, fields, rules, is_active)
                     VALUES (?, ?, ?, ?, ?, ?)`)
      .run(key, name, description ?? null, JSON.stringify(fields), JSON.stringify(rules), isActive ? 1 : 0);
    return this.findByKey(key);
  },

  update(key, { name, description, fields, rules, isActive }) {
    const current = this.findByKey(key);
    if (!current) return null;
    getDb().prepare(`UPDATE document_types
                     SET name = ?, description = ?, fields = ?, rules = ?, is_active = ?, updated_at = ?
                     WHERE key = ?`)
      .run(
        name ?? current.name,
        description !== undefined ? description : current.description,
        fields ? JSON.stringify(fields) : current.fields,
        rules ? JSON.stringify(rules) : current.rules,
        isActive === undefined ? current.is_active : (isActive ? 1 : 0),
        nowIso(),
        key,
      );
    return this.findByKey(key);
  },
};
