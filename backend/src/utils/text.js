const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'shri', 'sri', 'smt', 'kumari', 'km', 'master', 'prof', 'late']);

/** Lower-cases, strips punctuation and honorifics, and collapses spaces. */
export function normalizeName(value) {
  if (!value) return '';
  return String(value)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,'`"’\-_/\\()]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(t))
    .join(' ');
}

export const nameTokens = (value) => normalizeName(value).split(' ').filter(Boolean);

/** Parses numbers such as "₹1,23,456.50", "45.5%", "1 200". Returns null if not a number. */
export function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[₹$€£,%\s]|rs\.?|inr/gi, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

export const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
  || (Array.isArray(v) && v.length === 0);
