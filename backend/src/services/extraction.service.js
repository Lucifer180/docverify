import { getLlmClient } from './llm/index.js';
import { buildZodSchema, emptyFields, formatZodIssues } from '../utils/schemaBuilder.js';
import { TransientError, PermanentError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const CLASSIFY_CHARS = 4000;

/**
 * Classifies a document and extracts structured fields with the LLM.
 *
 * Flow: classify -> extract with the type's schema -> validate with Zod ->
 * one corrective retry with the validation errors -> otherwise mark for manual entry.
 *
 * Transient API errors (timeouts, rate limits) are re-thrown so the job queue can retry.
 */
export async function classifyAndExtract(text, documentTypes) {
  const llm = getLlmClient();
  const types = documentTypes.filter((t) => t.isActive !== false);
  const typeKeys = new Set(types.map((t) => t.key));
  const started = Date.now();

  // ---- 1. Classification
  let classification;
  try {
    classification = await llm.classify({ text: text.slice(0, CLASSIFY_CHARS), types });
  } catch (err) {
    if (err instanceof TransientError) throw err;
    throw new PermanentError(`Classification failed: ${err.message}`, { cause: err });
  }

  let typeKey = classification?.document_type;
  if (!typeKeys.has(typeKey)) typeKey = typeKeys.has('other') ? 'other' : types[0]?.key;
  let confidence = Number(classification?.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));

  const type = types.find((t) => t.key === typeKey);
  if (!type) throw new PermanentError('No document types are configured');

  // ---- 2. Extraction + schema validation (with one corrective retry)
  const schema = buildZodSchema(type.fields);
  let previousErrors;
  let attempts = 0;
  for (; attempts < 2; attempts += 1) {
    let response;
    try {
      response = await llm.extract({ text, type, previousErrors });
    } catch (err) {
      if (err instanceof TransientError) throw err;
      throw new PermanentError(`Extraction failed: ${err.message}`, { cause: err });
    }

    if (!response?.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
      previousErrors = ['The reply was not a JSON object. Return only one JSON object with the listed keys.'];
      continue;
    }
    const result = schema.safeParse(response.data);
    if (result.success) {
      return {
        documentType: type.key,
        classificationConfidence: confidence,
        classificationReason: classification?.reason || null,
        fields: result.data,
        needsManualEntry: false,
        attempts: attempts + 1,
        model: llm.modelId,
        llmMs: Date.now() - started,
      };
    }
    previousErrors = formatZodIssues(result.error).slice(0, 15);
    logger.warn('LLM output failed schema validation', { type: type.key, attempt: attempts + 1, issues: previousErrors });
  }

  // ---- 3. Give up: fields left blank for a reviewer to enter manually
  return {
    documentType: type.key,
    classificationConfidence: confidence,
    classificationReason: classification?.reason || null,
    fields: emptyFields(type.fields),
    needsManualEntry: true,
    schemaErrors: previousErrors,
    attempts,
    model: llm.modelId,
    llmMs: Date.now() - started,
  };
}

/** Asks the LLM for a plain-language summary of rule results. Never changes a result. */
export async function explainIssues(issues) {
  if (!issues.length) return null;
  try {
    return await getLlmClient().explain({
      issues: issues.slice(0, 25).map((i) => ({ severity: i.severity, rule: i.rule, field: i.field, message: i.message })),
    });
  } catch (err) {
    logger.warn('Could not generate issue explanation', { error: err.message });
    return null;
  }
}
