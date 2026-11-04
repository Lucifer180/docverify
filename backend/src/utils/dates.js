const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const pad = (n) => String(n).padStart(2, '0');

function build(y, m, d) {
  y = Number(y); m = Number(m); d = Number(d);
  if (y < 100) y += y > 50 ? 1900 : 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Normalises a date string to ISO YYYY-MM-DD. Numeric dates are read as
 * day/month/year (the Indian convention) unless the first part is a 4-digit year.
 * Returns null when the value cannot be read as a real calendar date.
 */
export function normalizeDate(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:T.*)?$/);
  if (m) return build(m[1], m[2], m[3]);

  m = s.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{2,4})$/);
  if (m) return build(m[3], m[2], m[1]);

  m = s.match(/^(\d{1,2})[-/.\s]+([A-Za-z]+)[-/.,\s]+(\d{2,4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) return build(m[3], MONTHS[m[2].toLowerCase()], m[1]);

  m = s.match(/^([A-Za-z]+)[-/.\s]+(\d{1,2}),?[-/.\s]+(\d{4})$/);
  if (m && MONTHS[m[1].toLowerCase()]) return build(m[3], MONTHS[m[1].toLowerCase()], m[2]);

  return null;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Whole years between two ISO dates. */
export function yearsBetween(fromIso, toIso) {
  const a = new Date(fromIso); const b = new Date(toIso);
  let years = b.getUTCFullYear() - a.getUTCFullYear();
  const beforeBirthday = b.getUTCMonth() < a.getUTCMonth()
    || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years;
}
