import { getDb } from '../config/db.js';
import { nowIso } from '../utils/ids.js';

export const userRepository = {
  create({ id, name, email, passwordHash, role }) {
    getDb().prepare(`INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`)
      .run(id, name, email, passwordHash, role);
    return this.findById(id);
  },

  findById(id) {
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByEmail(email) {
    return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  count() {
    return getDb().prepare('SELECT COUNT(*) AS n FROM users').get().n;
  },

  list({ role, search, limit = 50, offset = 0 } = {}) {
    const where = [];
    const params = {};
    if (role) { where.push('role = @role'); params.role = role; }
    if (search) { where.push('(name LIKE @search OR email LIKE @search)'); params.search = `%${search}%`; }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = getDb().prepare(`SELECT * FROM users ${clause} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset });
    const total = getDb().prepare(`SELECT COUNT(*) AS n FROM users ${clause}`).get(params).n;
    return { rows, total };
  },

  update(id, fields) {
    const columns = { name: 'name', role: 'role', isActive: 'is_active', passwordHash: 'password_hash' };
    const sets = [];
    const params = { id, updated_at: nowIso() };
    for (const [key, column] of Object.entries(columns)) {
      if (fields[key] !== undefined) {
        sets.push(`${column} = @${column}`);
        params[column] = key === 'isActive' ? (fields[key] ? 1 : 0) : fields[key];
      }
    }
    if (!sets.length) return this.findById(id);
    getDb().prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = @updated_at WHERE id = @id`).run(params);
    return this.findById(id);
  },
};
