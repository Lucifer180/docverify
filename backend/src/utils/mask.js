/**
 * Masks sensitive values, keeping only the last 4 characters visible.
 * "1234 5678 9012" -> "XXXX XXXX 9012", "ABCDE1234F" -> "XXXXXX234F"
 */
export function maskValue(value) {
  if (value === null || value === undefined || value === '') return value;
  const str = String(value);
  if (str.length <= 4) return 'X'.repeat(str.length);
  const visible = 4;
  let remainingToMask = str.replace(/\s/g, '').length - visible;
  let out = '';
  for (const ch of str) {
    if (/\s/.test(ch)) { out += ch; continue; }
    if (remainingToMask > 0) { out += 'X'; remainingToMask -= 1; } else { out += ch; }
  }
  return out;
}

/** Returns a copy of data with every sensitive field masked. */
export function maskFields(data, fieldDefs = []) {
  if (!data || typeof data !== 'object') return data;
  const sensitive = new Set(fieldDefs.filter((f) => f.sensitive).map((f) => f.key));
  const copy = { ...data };
  for (const key of Object.keys(copy)) {
    if (sensitive.has(key)) copy[key] = maskValue(copy[key]);
  }
  return copy;
}

// Patterns that look like identity numbers, cards, emails or phone numbers.
const SENSITIVE_PATTERNS = [
  [/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g, '[AADHAAR]'],
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[PAN]'],
  [/\b(?:\d[ -]?){13,19}\b/g, '[NUMBER]'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, '[EMAIL]'],
  [/(?:\+91[\s-]?)?\b[6-9]\d{9}\b/g, '[PHONE]'],
];

/** Scrubs identifiers from free text (used for logs). */
export function redactText(text) {
  if (typeof text !== 'string') return text;
  return SENSITIVE_PATTERNS.reduce((acc, [re, rep]) => acc.replace(re, rep), text);
}
