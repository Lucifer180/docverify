import { documentTypeRepository } from '../repositories/documentType.repository.js';
import { toDocumentType } from '../models/documentType.model.js';
import { defaultDocumentTypes } from '../database/seed-data/documentTypes.js';
import { recordAudit } from './audit.service.js';
import { AUDIT_ACTIONS } from '../models/auditLog.model.js';
import ApiError from '../utils/ApiError.js';

export const documentTypeService = {
  seedDefaults() {
    for (const t of defaultDocumentTypes) documentTypeRepository.insertIfMissing(t);
  },

  list({ includeInactive = false } = {}) {
    return documentTypeRepository.list({ includeInactive }).map(toDocumentType);
  },

  /** Map of key -> type definition (includes inactive types so old documents still render). */
  map() {
    return new Map(documentTypeRepository.list({ includeInactive: true }).map((r) => [r.key, toDocumentType(r)]));
  },

  get(key) {
    const t = toDocumentType(documentTypeRepository.findByKey(key));
    if (!t) throw ApiError.notFound('Document type not found');
    return t;
  },

  create(data, { user, ip }) {
    if (documentTypeRepository.findByKey(data.key)) throw ApiError.conflict('A document type with this key already exists');
    const created = toDocumentType(documentTypeRepository.create(data));
    recordAudit({ user, ip, action: AUDIT_ACTIONS.DOCUMENT_TYPE_CREATED, entityType: 'document_type', entityId: data.key,
      details: { fields: data.fields.length, rules: data.rules.length } });
    return created;
  },

  update(key, data, { user, ip }) {
    this.get(key);
    const updated = toDocumentType(documentTypeRepository.update(key, data));
    recordAudit({ user, ip, action: AUDIT_ACTIONS.DOCUMENT_TYPE_UPDATED, entityType: 'document_type', entityId: key,
      details: { changed: Object.keys(data) } });
    return updated;
  },
};
