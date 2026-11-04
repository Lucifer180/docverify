export const ROLES = Object.freeze({ SUBMITTER: 'submitter', REVIEWER: 'reviewer', ADMIN: 'admin' });
export const ROLE_LIST = Object.values(ROLES);

/** Converts a DB row to the public user shape (never includes the password hash). */
export function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
