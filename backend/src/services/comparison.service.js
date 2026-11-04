import { distance } from 'fastest-levenshtein';
import { newId } from '../utils/ids.js';
import { normalizeDate } from '../utils/dates.js';
import { isBlank, nameTokens } from '../utils/text.js';

export const MATCH = Object.freeze({ MATCH: 'match', POSSIBLE: 'possible_match', MISMATCH: 'mismatch' });

const SIMILARITY_THRESHOLD = 0.85;

function similarity(a, b) {
  if (!a && !b) return 1;
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - distance(a, b) / longest;
}

/** True if every token of the shorter name matches a token of the longer one, allowing initials. */
function initialsCompatible(short, long) {
  const remaining = [...long];
  for (const token of short) {
    let idx = remaining.indexOf(token);
    if (idx === -1 && token.length === 1) idx = remaining.findIndex((t) => t.startsWith(token));
    if (idx === -1) idx = remaining.findIndex((t) => t.length === 1 && token.startsWith(t));
    if (idx === -1) return false;
    remaining.splice(idx, 1);
  }
  return true;
}

/**
 * Compares two person names.
 *  - "Ravi Kumar" vs "RAVI  KUMAR" / "Kumar Ravi"  -> match
 *  - "R. Kumar"  vs "Ravi Kumar"                  -> possible_match (reviewer decides)
 *  - "Ravi Kumar" vs "Ravi Kumaar"                 -> possible_match (small spelling difference)
 *  - "Ravi Kumar" vs "Suresh Patel"                -> mismatch
 */
export function compareNames(a, b) {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return { result: MATCH.MISMATCH, score: 0, reason: 'empty name' };

  const joinedA = ta.join(' ');
  const joinedB = tb.join(' ');
  if (joinedA === joinedB) return { result: MATCH.MATCH, score: 1, reason: 'identical after normalisation' };

  const sortedA = [...ta].sort().join(' ');
  const sortedB = [...tb].sort().join(' ');
  if (sortedA === sortedB) return { result: MATCH.MATCH, score: 1, reason: 'same words in a different order' };

  // Names written without spaces, e.g. "RaviKumar" vs "Ravi Kumar"
  if (ta.join('') === tb.join('')) return { result: MATCH.MATCH, score: 1, reason: 'same letters, different spacing' };

  const score = Math.max(similarity(joinedA, joinedB), similarity(sortedA, sortedB));
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const usesInitials = [...ta, ...tb].some((t) => t.length === 1);

  if (usesInitials) {
    // With initials, string similarity is misleading ("A. Desai" vs "B. Desai" is 86% similar),
    // so the decision is based only on whether the initials fit the other name.
    return initialsCompatible(shorter, longer)
      ? { result: MATCH.POSSIBLE, score, reason: 'initials are consistent with the full name' }
      : { result: MATCH.MISMATCH, score, reason: 'initials do not match' };
  }
  if (score >= SIMILARITY_THRESHOLD) {
    return { result: MATCH.POSSIBLE, score, reason: 'small spelling difference' };
  }
  if (shorter.length >= 2 && initialsCompatible(shorter, longer)) {
    return { result: MATCH.POSSIBLE, score, reason: 'one name contains extra words' };
  }
  return { result: MATCH.MISMATCH, score, reason: 'names differ' };
}

export function compareDates(a, b) {
  const da = normalizeDate(a);
  const db = normalizeDate(b);
  if (!da || !db) return { result: MATCH.MISMATCH, score: 0, reason: 'unreadable date', a: da, b: db };
  return da === db
    ? { result: MATCH.MATCH, score: 1, reason: 'same date', a: da, b: db }
    : { result: MATCH.MISMATCH, score: 0, reason: 'different dates', a: da, b: db };
}

const LABELS = { person_name: 'Name', date_of_birth: 'Date of birth', father_name: "Father's name" };

function compareValues(kind, a, b) {
  return kind === 'date_of_birth' ? compareDates(a, b) : compareNames(a, b);
}

function toResult(comparison, { scope, documentId, rule, field, message, details }) {
  const passed = comparison.result === MATCH.MATCH;
  const severity = comparison.result === MATCH.MISMATCH ? 'error' : comparison.result === MATCH.POSSIBLE ? 'warning' : 'info';
  return {
    id: newId(), scope, documentId: documentId ?? null, rule, field, severity, passed, message,
    details: { ...details, match: comparison.result, similarity: Number(comparison.score.toFixed(2)), reason: comparison.reason },
  };
}

/** Compares extracted fields with what the submitter entered for the case. */
export function compareWithSubmitter({ documentId, documentName, fields, typeDef, caseRow }) {
  const submitterValues = { applicant_name: caseRow.applicant_name, applicant_dob: caseRow.applicant_dob };
  const results = [];
  for (const f of typeDef.fields) {
    if (!f.submitterField) continue;
    const entered = submitterValues[f.submitterField];
    const extracted = fields[f.key];
    if (isBlank(entered) || isBlank(extracted)) continue;
    const kind = f.type === 'date' ? 'date_of_birth' : 'person_name';
    const cmp = compareValues(kind, entered, extracted);
    const what = f.label;
    const message = {
      [MATCH.MATCH]: `${what} matches the details entered by the submitter`,
      [MATCH.POSSIBLE]: `${what} "${extracted}" is a possible match for the entered "${entered}" (${cmp.reason})`,
      [MATCH.MISMATCH]: `${what} "${extracted}" does not match the entered "${entered}"`,
    }[cmp.result];
    results.push(toResult(cmp, {
      scope: 'document', documentId, rule: 'matches_submitter', field: f.key, message,
      details: { entered, extracted, document: documentName },
    }));
  }
  return results;
}

/**
 * Compares corresponding fields (name, date of birth, father's name) across every
 * document in a case. Each pair of documents is compared once.
 * @param docs Array of { id, name, fields, typeDef }
 */
export function compareAcrossDocuments(docs) {
  const results = [];
  for (const kind of Object.keys(LABELS)) {
    const entries = [];
    for (const doc of docs) {
      const field = doc.typeDef.fields.find((f) => f.compareAs === kind);
      if (!field || isBlank(doc.fields[field.key])) continue;
      entries.push({ documentId: doc.id, document: doc.name, field: field.key, value: doc.fields[field.key] });
    }
    if (entries.length < 2) continue;

    let allMatch = true;
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const a = entries[i];
        const b = entries[j];
        const cmp = compareValues(kind, a.value, b.value);
        if (cmp.result === MATCH.MATCH) continue;
        allMatch = false;
        const message = cmp.result === MATCH.POSSIBLE
          ? `${LABELS[kind]} differs slightly between "${a.document}" ("${a.value}") and "${b.document}" ("${b.value}") — ${cmp.reason}`
          : `${LABELS[kind]} does not match: "${a.document}" has "${a.value}", "${b.document}" has "${b.value}"`;
        results.push(toResult(cmp, {
          scope: 'case', rule: `cross_document_${kind}`, field: kind, message,
          details: { documentIds: [a.documentId, b.documentId], documents: [a.document, b.document], values: [a.value, b.value] },
        }));
      }
    }
    if (allMatch) {
      results.push(toResult({ result: MATCH.MATCH, score: 1, reason: 'consistent' }, {
        scope: 'case', rule: `cross_document_${kind}`, field: kind,
        message: `${LABELS[kind]} is consistent across ${entries.length} documents`,
        details: { documentIds: entries.map((e) => e.documentId), documents: entries.map((e) => e.document) },
      }));
    }
  }
  return results;
}
