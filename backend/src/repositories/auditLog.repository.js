import { getDb } from '../config/db.js';

export const auditLogRepository = {
  insert({ userId, userEmail, action, entityType, entityId, details, ipAddress }) {
    getDb().prepare(`INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, details, ip_address)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(userId ?? null, userEmail ?? null, action, entityType ?? null, entityId ?? null,
        JSON.stringify(details || {}), ipAddress ?? null);
  },

  list({ action, entityType, entityId, userId, from, to, limit = 50, offset = 0 } = {}) {
    const where = [];
    const params = {};
    if (action) { where.push('action LIKE @action'); params.action = `${action}%`; }
    if (entityType) { where.push('entity_type = @entityType'); params.entityType = entityType; }
    if (entityId) { where.push('entity_id = @entityId'); params.entityId = entityId; }
    if (userId) { where.push('user_id = @userId'); params.userId = userId; }
    if (from) { where.push('created_at >= @from'); params.from = from; }
    if (to) { where.push('created_at <= @to'); params.to = to; }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = getDb().prepare(`SELECT * FROM audit_logs ${clause} ORDER BY id DESC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset });
    const total = getDb().prepare(`SELECT COUNT(*) AS n FROM audit_logs ${clause}`).get(params).n;
    return { rows, total };
  },

  /** Full history for a case: the case itself plus all of its documents. */
  listForCase(caseId, documentIds) {
    const ids = [caseId, ...documentIds];
    const placeholders = ids.map(() => '?').join(', ');
    return getDb().prepare(`SELECT * FROM audit_logs WHERE entity_id IN (${placeholders}) ORDER BY id DESC`).all(...ids);
  },
};
