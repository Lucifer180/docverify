import env from '../config/env.js';
import { documentRepository } from '../repositories/document.repository.js';
import { caseRepository } from '../repositories/case.repository.js';
import { extractedFieldRepository } from '../repositories/extractedField.repository.js';
import { validationResultRepository } from '../repositories/validationResult.repository.js';
import { DOCUMENT_STATUS, IN_PROGRESS_STATUSES } from '../models/document.model.js';
import { PRELIMINARY_STATUS } from '../models/case.model.js';
import { FIELD_SOURCES } from '../models/extractedField.model.js';
import { AUDIT_ACTIONS } from '../models/auditLog.model.js';
import { extractText, prepareTextForLlm } from './ocr.service.js';
import { classifyAndExtract, explainIssues } from './extraction.service.js';
import { validateDocument } from './validation.service.js';
import { compareAcrossDocuments, compareWithSubmitter } from './comparison.service.js';
import { documentTypeService } from './documentType.service.js';
import { storageService } from './storage.service.js';
import { recordAudit } from './audit.service.js';
import { newId } from '../utils/ids.js';
import { emptyFields } from '../utils/schemaBuilder.js';
import logger from '../utils/logger.js';

const MIN_TEXT_CHARS = 20;
const LOW_CLASSIFICATION_CONFIDENCE = 0.6;
const SYSTEM_ACTOR = { id: null, email: 'system' };

/**
 * Full pipeline for one document:
 *   text extraction (text layer or OCR) -> LLM classification + extraction -> case evaluation.
 * Each stage saves its output, so a retry after a failure resumes where it stopped.
 */
export async function processDocument(documentId) {
  let doc = documentRepository.findById(documentId);
  if (!doc) return; // deleted while queued
  const timings = JSON.parse(doc.timings || '{}');
  const started = Date.now();

  // ---- Stage 1: text extraction (skipped on retry if already done)
  if (doc.raw_text === null) {
    const t0 = Date.now();
    const filePath = storageService.resolve(doc.stored_name);
    const extracted = await extractText(filePath, doc.mime_type);
    timings.textMs = Date.now() - t0;
    doc = documentRepository.update(documentId, {
      rawText: extracted.text,
      extractionMethod: extracted.method,
      ocrConfidence: extracted.confidence === null ? null : Number(extracted.confidence.toFixed(1)),
      pageCount: extracted.pageCount,
      status: DOCUMENT_STATUS.TEXT_EXTRACTED,
      timings,
    });
    recordAudit({ user: SYSTEM_ACTOR, action: AUDIT_ACTIONS.PROCESSING_TEXT_EXTRACTED, entityType: 'document',
      entityId: documentId, details: { method: extracted.method, pages: extracted.pageCount,
        characters: extracted.text.length, ocrConfidence: doc.ocr_confidence } });
  }

  // ---- Stage 2: LLM classification and structured extraction
  const types = documentTypeService.list();
  const text = prepareTextForLlm(doc.raw_text || '');
  const t1 = Date.now();
  let extraction;
  if (text.replace(/\s/g, '').length < MIN_TEXT_CHARS) {
    // Too little text to send to the LLM: leave it for manual entry.
    const other = types.find((t) => t.key === 'other') || types[0];
    extraction = { documentType: other.key, classificationConfidence: 0, fields: emptyFields(other.fields),
      needsManualEntry: true, model: null, skippedReason: 'not enough text' };
  } else {
    extraction = await classifyAndExtract(text, types);
  }
  timings.llmMs = Date.now() - t1;

  extractedFieldRepository.addVersion({
    id: newId(), documentId, data: extraction.fields, source: FIELD_SOURCES.LLM,
    note: extraction.needsManualEntry ? 'Automatic extraction failed; manual entry required' : null,
  });
  documentRepository.update(documentId, {
    documentType: extraction.documentType,
    classificationConfidence: Number(extraction.classificationConfidence.toFixed(2)),
    llmModel: extraction.model,
    needsManualEntry: extraction.needsManualEntry,
    status: DOCUMENT_STATUS.FIELDS_EXTRACTED,
    errorMessage: null,
    timings,
  });
  recordAudit({ user: SYSTEM_ACTOR, action: AUDIT_ACTIONS.PROCESSING_FIELDS_EXTRACTED, entityType: 'document',
    entityId: documentId, details: { documentType: extraction.documentType, confidence: extraction.classificationConfidence,
      model: extraction.model, attempts: extraction.attempts, needsManualEntry: extraction.needsManualEntry,
      skippedReason: extraction.skippedReason } });

  // ---- Stage 3: validation and comparison across the whole case
  const t2 = Date.now();
  await evaluateCase(doc.case_id);
  timings.validateMs = Date.now() - t2;
  timings.totalMs = (timings.textMs || 0) + timings.llmMs + timings.validateMs;
  timings.wallMs = Date.now() - started;
  documentRepository.update(documentId, { timings });
}

/** Called by the job queue when all retries are used up. */
export async function markProcessingFailed(documentId, error) {
  const doc = documentRepository.findById(documentId);
  if (!doc) return;
  documentRepository.update(documentId, {
    status: DOCUMENT_STATUS.PROCESSING_FAILED,
    errorMessage: String(error?.message || error).slice(0, 500),
  });
  recordAudit({ user: SYSTEM_ACTOR, action: AUDIT_ACTIONS.PROCESSING_FAILED, entityType: 'document', entityId: documentId,
    details: { error: String(error?.message || error).slice(0, 200) } });
  await evaluateCase(doc.case_id);
}

// Increments for every evaluation, so a slow explanation from an older run never overwrites a newer one.
const evaluationSeq = new Map();

/** Quality checks that come from extraction itself rather than from the document content. */
function qualityChecks(doc) {
  const out = [];
  const add = (rule, severity, message, details = {}) => out.push({
    id: newId(), documentId: doc.id, scope: 'document', rule, field: null, severity, passed: false, message, details,
  });
  const textLength = (doc.raw_text || '').replace(/\s/g, '').length;
  if (textLength < MIN_TEXT_CHARS) {
    add('low_quality_image', 'error', 'Little or no text could be read. Low-quality image — the submitter may need to re-upload.',
      { characters: textLength });
  } else if (doc.extraction_method === 'ocr' && doc.ocr_confidence !== null && doc.ocr_confidence < env.ocrLowConfidence) {
    add('low_ocr_confidence', 'warning', `Low-quality image: OCR confidence is ${doc.ocr_confidence}%. Check values against the original.`,
      { ocrConfidence: doc.ocr_confidence, threshold: env.ocrLowConfidence });
  }
  if (doc.needs_manual_entry) {
    add('manual_entry_required', 'error', 'Fields could not be extracted automatically and must be entered by a reviewer');
  }
  if (doc.classification_confidence !== null && doc.classification_confidence < LOW_CLASSIFICATION_CONFIDENCE
    && !doc.needs_manual_entry) {
    add('low_classification_confidence', 'warning',
      `Document type is uncertain (confidence ${Math.round(doc.classification_confidence * 100)}%). Confirm the type.`,
      { confidence: doc.classification_confidence });
  }
  if (doc.document_type === 'other') {
    add('unsupported_document_type', 'warning', 'This document did not match a supported type and needs a manual check');
  }
  return out;
}

/**
 * Re-runs every rule and comparison for a case, stores the results and sets the
 * preliminary status of each document and of the case.
 * "Passed Automated Checks" only means no inconsistencies were found - it is not an approval.
 */
export async function evaluateCase(caseId) {
  const caseRow = caseRepository.findById(caseId);
  if (!caseRow) return null;
  const seq = (evaluationSeq.get(caseId) || 0) + 1;
  evaluationSeq.set(caseId, seq);

  const typeMap = documentTypeService.map();
  const docs = documentRepository.listByCase(caseId);
  const results = [];
  const evaluated = [];

  for (const doc of docs) {
    if (IN_PROGRESS_STATUSES.has(doc.status) && doc.status !== DOCUMENT_STATUS.FIELDS_EXTRACTED) continue;
    if (doc.status === DOCUMENT_STATUS.PROCESSING_FAILED) {
      results.push({ id: newId(), documentId: doc.id, scope: 'document', rule: 'processing_failed', field: null,
        severity: 'error', passed: false, message: `Processing failed: ${doc.error_message || 'unknown error'}`, details: {} });
      continue;
    }
    const typeDef = typeMap.get(doc.document_type);
    const latest = extractedFieldRepository.findLatest(doc.id);
    if (!typeDef || !latest) continue;
    const fields = JSON.parse(latest.data);

    results.push(...qualityChecks(doc));
    if (!doc.needs_manual_entry) {
      results.push(...validateDocument({ documentId: doc.id, fields, typeDef }));
      results.push(...compareWithSubmitter({ documentId: doc.id, documentName: doc.original_name, fields, typeDef, caseRow }));
      evaluated.push({ id: doc.id, name: doc.original_name, fields, typeDef });
    }
  }
  results.push(...compareAcrossDocuments(evaluated));
  validationResultRepository.replaceForCase(caseId, results);

  // Per-document status: flagged if it has any failed error/warning (including case-level mismatches it is part of).
  const failing = results.filter((r) => !r.passed && (r.severity === 'error' || r.severity === 'warning'));
  const flaggedDocs = new Set();
  for (const r of failing) {
    if (r.documentId) flaggedDocs.add(r.documentId);
    for (const id of r.details?.documentIds || []) flaggedDocs.add(id);
  }
  for (const doc of docs) {
    if (doc.status === DOCUMENT_STATUS.PROCESSING_FAILED) continue;
    if (IN_PROGRESS_STATUSES.has(doc.status) && doc.status !== DOCUMENT_STATUS.FIELDS_EXTRACTED) continue;
    const status = flaggedDocs.has(doc.id) ? DOCUMENT_STATUS.FLAGGED : DOCUMENT_STATUS.PASSED;
    if (doc.status !== status) documentRepository.update(doc.id, { status });
  }

  const fresh = documentRepository.listByCase(caseId);
  let preliminary;
  if (!fresh.length) preliminary = PRELIMINARY_STATUS.PENDING;
  else if (fresh.some((d) => IN_PROGRESS_STATUSES.has(d.status))) preliminary = PRELIMINARY_STATUS.PROCESSING;
  else if (failing.length || fresh.some((d) => d.status !== DOCUMENT_STATUS.PASSED)) preliminary = PRELIMINARY_STATUS.FLAGGED;
  else preliminary = PRELIMINARY_STATUS.PASSED;

  caseRepository.update(caseId, { preliminaryStatus: preliminary });

  if (preliminary !== PRELIMINARY_STATUS.PROCESSING) {
    recordAudit({ user: SYSTEM_ACTOR, action: AUDIT_ACTIONS.PROCESSING_VALIDATED, entityType: 'case', entityId: caseId,
      details: { preliminaryStatus: preliminary, checks: results.length, issues: failing.length } });
    // Plain-language summary, phrased by the LLM from the rule results only.
    const summary = failing.length ? await explainIssues(failing) : null;
    if (evaluationSeq.get(caseId) === seq) caseRepository.update(caseId, { issueSummary: summary ?? '' });
  }
  logger.debug('Case evaluated', { caseId, preliminary, checks: results.length, issues: failing.length });
  return { preliminaryStatus: preliminary, results };
}
