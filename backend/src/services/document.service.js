import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { fileTypeFromBuffer } from 'file-type';
import env from '../config/env.js';
import { caseRepository } from '../repositories/case.repository.js';
import { documentRepository } from '../repositories/document.repository.js';
import { extractedFieldRepository } from '../repositories/extractedField.repository.js';
import { toDocument, ALLOWED_MIME_TYPES, DOCUMENT_STATUS, IN_PROGRESS_STATUSES } from '../models/document.model.js';
import { toExtractedFields, FIELD_SOURCES } from '../models/extractedField.model.js';
import { PRELIMINARY_STATUS } from '../models/case.model.js';
import { AUDIT_ACTIONS } from '../models/auditLog.model.js';
import { storageService } from './storage.service.js';
import { documentTypeService } from './documentType.service.js';
import { recordAudit } from './audit.service.js';
import { assertCanView, assertSubmitterCanEdit, assertReviewerCanAct, canReveal, isStaff } from './access.service.js';
import { evaluateCase } from './processing.service.js';
import { queueDocumentProcessing } from '../jobs/document.jobs.js';
import { buildZodSchema, formatZodIssues } from '../utils/schemaBuilder.js';
import { maskFields, maskValue } from '../utils/mask.js';
import { newId, sha256 } from '../utils/ids.js';
import ApiError from '../utils/ApiError.js';

const SAFE_NAME = /[^\w.\- ()]/g;

/**
 * Checks a file's extension, declared MIME type and real content signature.
 * Returns the trusted MIME type or an error message.
 */
export async function inspectFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExts = Object.values(ALLOWED_MIME_TYPES).flat();
  if (!allowedExts.includes(ext)) return { error: `${file.originalname}: only PDF, JPG and PNG files are allowed` };
  if (!file.size) return { error: `${file.originalname}: the file is empty` };
  if (file.size > env.maxFileSizeBytes) {
    return { error: `${file.originalname}: file is larger than ${Math.round(env.maxFileSizeBytes / 1024 / 1024)} MB` };
  }
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !ALLOWED_MIME_TYPES[detected.mime]) {
    return { error: `${file.originalname}: the file content is not a real PDF, JPG or PNG` };
  }
  if (!ALLOWED_MIME_TYPES[detected.mime].includes(ext)) {
    return { error: `${file.originalname}: the extension does not match the file content (${detected.mime})` };
  }
  return { mime: detected.mime, ext: ext === '.jpeg' ? '.jpg' : ext };
}

export const documentService = {
  /**
   * Stores uploaded files and queues them for processing. All files are checked first;
   * if any file is rejected, nothing is stored.
   */
  async upload(user, caseId, files, { ip }) {
    const caseRow = caseRepository.findById(caseId);
    assertSubmitterCanEdit(user, caseRow);
    if (!files?.length) throw ApiError.badRequest('Select at least one file to upload');

    const inspected = [];
    const errors = [];
    const hashes = new Set();
    for (const file of files) {
      const check = await inspectFile(file);
      if (check.error) { errors.push(check.error); continue; }
      const hash = sha256(file.buffer);
      const dup = documentRepository.findDuplicateInCase(caseId, hash);
      if (dup || hashes.has(hash)) { errors.push(`${file.originalname}: this file has already been uploaded to this case`); continue; }
      hashes.add(hash);
      inspected.push({ file, ...check, hash });
    }
    if (errors.length) throw ApiError.badRequest('Upload rejected', errors);

    const created = [];
    for (const item of inspected) {
      const storedName = await storageService.save(item.file.buffer, item.ext);
      const id = newId();
      const originalName = path.basename(item.file.originalname).replace(SAFE_NAME, '_').slice(0, 200);
      const row = documentRepository.create({
        id, caseId, uploadedBy: user.id, originalName, storedName, mimeType: item.mime,
        sizeBytes: item.file.size, sha256: item.hash,
      });
      recordAudit({ user, ip, action: AUDIT_ACTIONS.DOCUMENT_UPLOADED, entityType: 'document', entityId: id,
        details: { caseId, name: originalName, mime: item.mime, size: item.file.size } });
      queueDocumentProcessing(id);
      created.push(toDocument(row));
    }
    caseRepository.update(caseId, { preliminaryStatus: PRELIMINARY_STATUS.PROCESSING });
    return created;
  },

  getForUser(user, documentId) {
    const row = documentRepository.findById(documentId);
    if (!row) throw ApiError.notFound('Document not found');
    const caseRow = caseRepository.findById(row.case_id);
    assertCanView(user, caseRow);
    return { row, caseRow };
  },

  /** Issues a short-lived link for viewing the original file. */
  createFileLink(user, documentId, { ip }) {
    const { row } = this.getForUser(user, documentId);
    if (!storageService.exists(row.stored_name)) throw ApiError.notFound('The original file is no longer stored');
    const token = jwt.sign({ doc: row.id, sub: user.id, type: 'file' }, env.jwtSecret, {
      expiresIn: env.fileLinkExpiresIn, issuer: 'docverify',
    });
    recordAudit({ user, ip, action: AUDIT_ACTIONS.DOCUMENT_VIEWED, entityType: 'document', entityId: row.id });
    return { url: `/api/files/${token}`, mimeType: row.mime_type, expiresIn: env.fileLinkExpiresIn };
  },

  /** Resolves a file link token to a stream. */
  openFileByToken(token) {
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret, { issuer: 'docverify' });
    } catch {
      throw ApiError.unauthorized('This file link has expired. Reopen the document to get a new link.');
    }
    if (payload.type !== 'file') throw ApiError.unauthorized('Invalid file link');
    const row = documentRepository.findById(payload.doc);
    if (!row || !storageService.exists(row.stored_name)) throw ApiError.notFound('File not found');
    const filePath = storageService.resolve(row.stored_name);
    return { stream: fs.createReadStream(filePath), mimeType: row.mime_type, name: row.original_name, size: fs.statSync(filePath).size };
  },

  async remove(user, documentId, { ip }) {
    const { row, caseRow } = this.getForUser(user, documentId);
    assertSubmitterCanEdit(user, caseRow);
    documentRepository.delete(row.id);
    await storageService.remove(row.stored_name);
    recordAudit({ user, ip, action: AUDIT_ACTIONS.DOCUMENT_DELETED, entityType: 'document', entityId: row.id,
      details: { caseId: row.case_id, name: row.original_name } });
    await evaluateCase(row.case_id);
  },

  /** Re-runs the pipeline. fromScratch=true also repeats text extraction/OCR. */
  reprocess(user, documentId, { fromScratch = false, ip }) {
    const { row, caseRow } = this.getForUser(user, documentId);
    if (!isStaff(user) && caseRow.submitter_id !== user.id) throw ApiError.forbidden();
    if (IN_PROGRESS_STATUSES.has(row.status) && row.status !== DOCUMENT_STATUS.FIELDS_EXTRACTED) {
      throw ApiError.conflict('This document is already being processed');
    }
    documentRepository.update(row.id, {
      status: DOCUMENT_STATUS.UPLOADED, errorMessage: null, ...(fromScratch ? { rawText: null } : {}),
    });
    caseRepository.update(row.case_id, { preliminaryStatus: PRELIMINARY_STATUS.PROCESSING });
    queueDocumentProcessing(row.id);
    recordAudit({ user, ip, action: AUDIT_ACTIONS.DOCUMENT_REPROCESSED, entityType: 'document', entityId: row.id,
      details: { fromScratch } });
    return toDocument(documentRepository.findById(row.id));
  },

  /** Raw extracted text, for reviewers comparing OCR output with the original. */
  rawText(user, documentId, { ip }) {
    const { row } = this.getForUser(user, documentId);
    if (!isStaff(user)) throw ApiError.forbidden('Only reviewers can view the extracted text');
    recordAudit({ user, ip, action: AUDIT_ACTIONS.SENSITIVE_REVEALED, entityType: 'document', entityId: row.id,
      details: { what: 'raw_text' } });
    return { text: row.raw_text, method: row.extraction_method, ocrConfidence: row.ocr_confidence };
  },

  versions(user, documentId, { reveal = false } = {}) {
    const { row } = this.getForUser(user, documentId);
    const typeMap = documentTypeService.map();
    return extractedFieldRepository.listVersions(row.id).map((v) => {
      const item = toExtractedFields(v);
      if (!(reveal && canReveal(user))) {
        // Each version may belong to a different type if the reviewer reclassified the document.
        const allFields = [...typeMap.values()].flatMap((t) => t.fields);
        item.data = maskFields(item.data, allFields);
      }
      return item;
    });
  },

  /**
   * Saves reviewer corrections as a new version (the original extracted values are kept),
   * optionally changing the document type, then re-runs all checks for the case.
   */
  async correctFields(user, documentId, { documentType, fields, note }, { ip }) {
    const { row, caseRow } = this.getForUser(user, documentId);
    assertReviewerCanAct(user, caseRow);
    if (IN_PROGRESS_STATUSES.has(row.status) && row.status !== DOCUMENT_STATUS.FIELDS_EXTRACTED) {
      throw ApiError.conflict('Wait for processing to finish before correcting fields');
    }

    const typeKey = documentType || row.document_type;
    const typeDef = documentTypeService.get(typeKey);
    const latest = extractedFieldRepository.findLatest(row.id);
    const previous = latest && typeKey === row.document_type ? JSON.parse(latest.data) : {};

    // Masked values sent back unchanged from the UI must not overwrite the real value.
    const incoming = { ...fields };
    for (const f of typeDef.fields) {
      if (f.sensitive && typeof incoming[f.key] === 'string' && incoming[f.key] === maskValue(previous[f.key])) {
        incoming[f.key] = previous[f.key];
      }
    }
    const merged = { ...previous, ...incoming };
    const parsed = buildZodSchema(typeDef.fields).safeParse(merged);
    if (!parsed.success) throw ApiError.badRequest('Some fields have the wrong type', formatZodIssues(parsed.error));

    const changes = [];
    for (const f of typeDef.fields) {
      const before = previous[f.key] ?? null;
      const after = parsed.data[f.key] ?? null;
      if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ field: f.key, from: before, to: after });
    }
    if (!changes.length && typeKey === row.document_type) throw ApiError.badRequest('No changes to save');

    const source = row.needs_manual_entry ? FIELD_SOURCES.MANUAL : FIELD_SOURCES.REVIEWER;
    const version = extractedFieldRepository.addVersion({
      id: newId(), documentId: row.id, data: parsed.data, source, createdBy: user.id, note: note || null,
    });
    documentRepository.update(row.id, {
      documentType: typeKey,
      needsManualEntry: false,
      ...(typeKey !== row.document_type ? { classificationConfidence: 1 } : {}),
    });

    recordAudit({ user, ip, action: AUDIT_ACTIONS.FIELDS_CORRECTED, entityType: 'document', entityId: row.id, details: {
      caseId: row.case_id, version: version.version, source, note: note || undefined,
      typeChanged: typeKey !== row.document_type ? { from: row.document_type, to: typeKey } : undefined,
      changes: changes.map((c) => {
        const def = typeDef.fields.find((f) => f.key === c.field);
        return def?.sensitive ? { field: c.field, from: maskValue(c.from), to: maskValue(c.to) } : c;
      }),
    } });

    await evaluateCase(row.case_id);
    return toExtractedFields(extractedFieldRepository.findLatest(row.id));
  },
};
