import { newId } from '../utils/ids.js';
import { normalizeDate, todayIso, yearsBetween } from '../utils/dates.js';
import { isBlank, parseNumber } from '../utils/text.js';
import { maskValue } from '../utils/mask.js';

/**
 * Deterministic validation engine. The LLM never decides whether a document passes;
 * every result here comes from a rule with a name, the values compared and a severity.
 *
 * Supported rule types (configured per document type):
 *   date_not_future      { field }
 *   date_not_past        { field }
 *   date_order           { before, after, allowEqual? }
 *   number_range         { field, min?, max? }        max may be "current_year"
 *   number_lte           { field, otherField }
 *   sum_equals           { fields: [...], target, tolerance? }
 *   array_sum_equals     { array, itemField, target, tolerance? }
 *   line_item_math       { array, quantity, unitPrice, amount, tolerance? }
 *   percentage_consistent{ obtained, maximum, percentage, tolerance? }
 *   min_age_at_year      { dobField, yearField, minYears }
 *   pattern              { field, pattern, stripSpaces? }
 *   pattern_if           { field, when: { field, equals }, pattern, stripSpaces? }
 *   one_of               { field, values: [...] }
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^(?:\+?\d{1,3}[\s-]?)?\d{10}$/;

export const RULE_TYPES = [
  'date_not_future', 'date_not_past', 'date_order', 'number_range', 'number_lte', 'sum_equals',
  'array_sum_equals', 'line_item_math', 'percentage_consistent', 'min_age_at_year', 'pattern', 'pattern_if', 'one_of',
];

function result({ documentId, rule, field, severity = 'error', passed, message, details }) {
  return { id: newId(), documentId, scope: 'document', rule, field: field ?? null, severity, passed, message, details: details || {} };
}

const display = (field, value) => (field?.sensitive ? maskValue(value) : value);

function getDate(fields, key) {
  return isBlank(fields[key]) ? null : normalizeDate(fields[key]);
}

function getNum(fields, key) {
  return isBlank(fields[key]) ? null : parseNumber(fields[key]);
}

/** Field-level checks: required, data type/format and per-field patterns. */
function checkFields(fields, typeDef, documentId) {
  const out = [];
  for (const f of typeDef.fields) {
    const value = fields[f.key];
    if (isBlank(value)) {
      if (f.required) {
        out.push(result({ documentId, rule: 'required', field: f.key, passed: false,
          message: `${f.label} is required but was not found` }));
      }
      continue;
    }
    if (f.required) {
      out.push(result({ documentId, rule: 'required', field: f.key, severity: 'info', passed: true,
        message: `${f.label} is present` }));
    }

    let formatError = null;
    if (f.type === 'date' && !normalizeDate(value)) formatError = `${f.label} "${value}" is not a valid date`;
    if (f.type === 'number' && parseNumber(value) === null) formatError = `${f.label} "${value}" is not a valid number`;
    if (f.type === 'email' && !EMAIL_RE.test(String(value).trim())) formatError = `${f.label} "${value}" is not a valid email`;
    if (f.type === 'phone' && !PHONE_RE.test(String(value).replace(/[\s()-]/g, ''))) {
      formatError = `${f.label} is not a valid phone number`;
    }
    if (f.type === 'array' && !Array.isArray(value)) formatError = `${f.label} should be a list`;
    if (formatError) {
      out.push(result({ documentId, rule: 'format', field: f.key, passed: false, message: formatError,
        details: { value: display(f, value), expectedType: f.type } }));
      continue;
    }

    if (f.pattern) {
      const normalized = String(value).replace(/\s/g, '').toUpperCase();
      const ok = new RegExp(f.pattern).test(normalized);
      out.push(result({ documentId, rule: 'pattern', field: f.key, passed: ok, severity: ok ? 'info' : 'error',
        message: ok ? `${f.label} format is valid` : (f.patternMessage || `${f.label} does not match the expected format`),
        details: { value: display(f, value) } }));
    }
  }
  return out;
}

/** Evaluates one configured rule. Returns null when the needed fields are missing. */
function evaluateRule(rule, fields, typeDef, documentId) {
  const label = (key) => typeDef.fields.find((f) => f.key === key)?.label || key;
  const fieldDef = (key) => typeDef.fields.find((f) => f.key === key);
  const severity = rule.severity || 'error';
  const tol = rule.tolerance ?? 0.01;
  const base = { documentId, rule: rule.id || rule.type, severity };

  switch (rule.type) {
    case 'date_not_future': {
      const d = getDate(fields, rule.field);
      if (!d) return null;
      const ok = d <= todayIso();
      return result({ ...base, field: rule.field, passed: ok,
        message: ok ? `${label(rule.field)} is not in the future` : (rule.message || `${label(rule.field)} (${d}) is in the future`),
        details: { value: d, today: todayIso() } });
    }
    case 'date_not_past': {
      const d = getDate(fields, rule.field);
      if (!d) return null;
      const ok = d >= todayIso();
      return result({ ...base, field: rule.field, passed: ok,
        message: ok ? `${label(rule.field)} has not passed` : (rule.message || `${label(rule.field)} (${d}) has passed`),
        details: { value: d, today: todayIso() } });
    }
    case 'date_order': {
      const a = getDate(fields, rule.before);
      const b = getDate(fields, rule.after);
      if (!a || !b) return null;
      const ok = rule.allowEqual ? a <= b : a < b;
      return result({ ...base, field: rule.after, passed: ok,
        message: ok ? `${label(rule.before)} is before ${label(rule.after)}`
          : (rule.message || `${label(rule.before)} (${a}) should be before ${label(rule.after)} (${b})`),
        details: { [rule.before]: a, [rule.after]: b } });
    }
    case 'number_range': {
      const n = getNum(fields, rule.field);
      if (n === null) return null;
      const max = rule.max === 'current_year' ? new Date().getFullYear() : rule.max;
      const ok = (rule.min === undefined || n >= rule.min) && (max === undefined || max === null || n <= max);
      const range = `${rule.min ?? '-∞'} to ${max ?? '∞'}`;
      return result({ ...base, field: rule.field, passed: ok,
        message: ok ? `${label(rule.field)} is within ${range}` : (rule.message || `${label(rule.field)} (${n}) is outside ${range}`),
        details: { value: n, min: rule.min ?? null, max: max ?? null } });
    }
    case 'number_lte': {
      const a = getNum(fields, rule.field);
      const b = getNum(fields, rule.otherField);
      if (a === null || b === null) return null;
      const ok = a <= b;
      return result({ ...base, field: rule.field, passed: ok,
        message: ok ? `${label(rule.field)} does not exceed ${label(rule.otherField)}`
          : (rule.message || `${label(rule.field)} (${a}) exceeds ${label(rule.otherField)} (${b})`),
        details: { [rule.field]: a, [rule.otherField]: b } });
    }
    case 'sum_equals': {
      const parts = rule.fields.map((k) => getNum(fields, k));
      const target = getNum(fields, rule.target);
      if (parts.some((p) => p === null) || target === null) return null;
      const sum = parts.reduce((x, y) => x + y, 0);
      const ok = Math.abs(sum - target) <= tol;
      return result({ ...base, field: rule.target, passed: ok,
        message: ok ? `${rule.fields.map(label).join(' + ')} equals ${label(rule.target)}`
          : (rule.message || `${rule.fields.map(label).join(' + ')} = ${sum}, but ${label(rule.target)} is ${target}`),
        details: { sum: Number(sum.toFixed(2)), target, difference: Number((sum - target).toFixed(2)) } });
    }
    case 'array_sum_equals': {
      const items = fields[rule.array];
      const target = getNum(fields, rule.target);
      if (!Array.isArray(items) || !items.length || target === null) return null;
      const values = items.map((i) => parseNumber(i?.[rule.itemField]));
      if (values.some((v) => v === null)) return null;
      const sum = values.reduce((x, y) => x + y, 0);
      const ok = Math.abs(sum - target) <= tol;
      return result({ ...base, field: rule.target, passed: ok,
        message: ok ? `Line items add up to ${label(rule.target)}`
          : (rule.message || `Line items add up to ${sum}, but ${label(rule.target)} is ${target}`),
        details: { sum: Number(sum.toFixed(2)), target, items: values.length } });
    }
    case 'line_item_math': {
      const items = fields[rule.array];
      if (!Array.isArray(items) || !items.length) return null;
      const bad = [];
      items.forEach((item, idx) => {
        const q = parseNumber(item?.[rule.quantity]);
        const p = parseNumber(item?.[rule.unitPrice]);
        const a = parseNumber(item?.[rule.amount]);
        if (q === null || p === null || a === null) return;
        if (Math.abs(q * p - a) > tol) bad.push({ line: idx + 1, expected: Number((q * p).toFixed(2)), actual: a });
      });
      const ok = bad.length === 0;
      return result({ ...base, field: rule.array, passed: ok,
        message: ok ? 'Each line item amount equals quantity × unit price'
          : (rule.message ? `${rule.message} (line ${bad.map((b) => b.line).join(', ')})` : 'Some line item amounts are wrong'),
        details: { mismatches: bad } });
    }
    case 'percentage_consistent': {
      const o = getNum(fields, rule.obtained);
      const m = getNum(fields, rule.maximum);
      const p = getNum(fields, rule.percentage);
      if (o === null || m === null || p === null || m === 0) return null;
      const expected = (o / m) * 100;
      const ok = Math.abs(expected - p) <= (rule.tolerance ?? 1);
      return result({ ...base, field: rule.percentage, passed: ok,
        message: ok ? 'Percentage matches marks obtained ÷ maximum marks'
          : (rule.message || `Percentage is ${p}, but marks give ${expected.toFixed(2)}`),
        details: { expected: Number(expected.toFixed(2)), actual: p } });
    }
    case 'min_age_at_year': {
      const dob = getDate(fields, rule.dobField);
      const year = getNum(fields, rule.yearField);
      if (!dob || year === null) return null;
      const age = yearsBetween(dob, `${year}-12-31`);
      const ok = age >= rule.minYears;
      return result({ ...base, field: rule.yearField, passed: ok,
        message: ok ? `Age in ${year} is plausible (${age})` : (rule.message || `Age in ${year} would only be ${age}`),
        details: { age, minYears: rule.minYears } });
    }
    case 'pattern':
    case 'pattern_if': {
      if (rule.type === 'pattern_if') {
        const actual = String(fields[rule.when?.field] ?? '').trim().toLowerCase();
        if (actual !== String(rule.when?.equals ?? '').toLowerCase()) return null;
      }
      const v = fields[rule.field];
      if (isBlank(v)) return null;
      const normalized = rule.stripSpaces ? String(v).replace(/[\s-]/g, '').toUpperCase() : String(v);
      const ok = new RegExp(rule.pattern).test(normalized);
      return result({ ...base, field: rule.field, passed: ok,
        message: ok ? `${label(rule.field)} format is valid` : (rule.message || `${label(rule.field)} has an invalid format`),
        details: { value: display(fieldDef(rule.field), v) } });
    }
    case 'one_of': {
      const v = fields[rule.field];
      if (isBlank(v)) return null;
      const ok = rule.values.map((x) => String(x).toLowerCase()).includes(String(v).toLowerCase());
      return result({ ...base, field: rule.field, passed: ok,
        message: ok ? `${label(rule.field)} is an allowed value` : (rule.message || `${label(rule.field)} "${v}" is not an allowed value`),
        details: { value: v, allowed: rule.values } });
    }
    default:
      return result({ ...base, severity: 'warning', passed: false, message: `Unknown rule type "${rule.type}"` });
  }
}

/** Runs all field checks and business rules for one document. */
export function validateDocument({ documentId, fields, typeDef }) {
  const results = checkFields(fields, typeDef, documentId);
  // A field with a format error is not used in further rules (avoids duplicate noise).
  const badFormat = new Set(results.filter((r) => r.rule === 'format').map((r) => r.field));
  const usable = Object.fromEntries(Object.entries(fields).filter(([k]) => !badFormat.has(k)));
  for (const rule of typeDef.rules || []) {
    const r = evaluateRule(rule, usable, typeDef, documentId);
    if (r) results.push(r);
  }
  return results;
}
