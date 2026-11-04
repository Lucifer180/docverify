export const FIELD_TYPES = ['string', 'date', 'number', 'email', 'phone', 'array'];
export const COMPARE_KEYS = ['person_name', 'date_of_birth', 'father_name'];
export const SUBMITTER_FIELDS = ['applicant_name', 'applicant_dob'];

export function toDocumentType(row) {
  if (!row) return null;
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    fields: JSON.parse(row.fields || '[]'),
    rules: JSON.parse(row.rules || '[]'),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
