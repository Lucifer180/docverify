import { z } from 'zod';
import { normalizeDate } from './dates.js';
import { parseNumber } from './text.js';

const toNullIfBlank = (v) => (v === undefined || v === '' || (typeof v === 'string' && v.trim() === '') ? null : v);

function zodForField(field) {
  switch (field.type) {
    case 'number':
      return z.preprocess((v) => {
        v = toNullIfBlank(v);
        if (v === null) return null;
        const n = parseNumber(v);
        return n === null ? v : n; // leave unparseable values so Zod reports them
      }, z.number().nullable());
    case 'date':
      // Dates are normalised to YYYY-MM-DD where possible. Values that cannot be read
      // are kept as text so the validation engine can report "invalid date".
      return z.preprocess((v) => {
        v = toNullIfBlank(v);
        if (v === null) return null;
        return normalizeDate(v) ?? String(v);
      }, z.string().nullable());
    case 'array': {
      const item = z.object(Object.fromEntries((field.itemFields || []).map((f) => [f.key, zodForField(f).optional()])));
      return z.preprocess((v) => toNullIfBlank(v), z.array(item).nullable());
    }
    default:
      return z.preprocess((v) => {
        v = toNullIfBlank(v);
        if (v === null) return null;
        return typeof v === 'number' ? String(v) : (typeof v === 'string' ? v.trim() : v);
      }, z.string().nullable());
  }
}

/** Builds the Zod schema used to validate LLM output for a document type. */
export function buildZodSchema(fields) {
  const shape = Object.fromEntries(fields.map((f) => [f.key, zodForField(f).optional()]));
  return z.object(shape).transform((obj) => {
    // Every field is always present in the stored record; missing ones become null.
    const out = {};
    for (const f of fields) {
      const v = obj[f.key];
      if (f.type === 'array' && Array.isArray(v)) {
        out[f.key] = v.map((item) => Object.fromEntries((f.itemFields || []).map((i) => [i.key, item[i.key] ?? null])));
      } else {
        out[f.key] = v ?? null;
      }
    }
    return out;
  });
}

function jsonSchemaForField(field) {
  const description = [field.label, field.hint, field.type === 'date' ? 'Format: YYYY-MM-DD' : null]
    .filter(Boolean).join('. ');
  switch (field.type) {
    case 'number':
      return { type: ['number', 'null'], description };
    case 'array': {
      const items = {
        type: 'object',
        properties: Object.fromEntries((field.itemFields || []).map((f) => [f.key, jsonSchemaForField(f)])),
        required: (field.itemFields || []).map((f) => f.key),
        additionalProperties: false,
      };
      return { type: ['array', 'null'], items, description };
    }
    default:
      return { type: ['string', 'null'], description };
  }
}

/** Builds the JSON Schema sent to the LLM's structured-output mode. */
export function buildJsonSchema(fields) {
  return {
    type: 'object',
    properties: Object.fromEntries(fields.map((f) => [f.key, jsonSchemaForField(f)])),
    required: fields.map((f) => f.key),
    additionalProperties: false,
  };
}

/** Turns Zod issues into short readable messages (used in the corrective retry prompt). */
export function formatZodIssues(error) {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

export function emptyFields(fields) {
  return Object.fromEntries(fields.map((f) => [f.key, null]));
}
