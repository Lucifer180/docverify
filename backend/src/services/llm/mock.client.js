import { normalizeDate } from '../../utils/dates.js';
import { parseNumber } from '../../utils/text.js';

/**
 * Offline stand-in for the LLM, used when LLM_PROVIDER=mock or no GROK_API_KEY is set.
 * It reads "Label: value" lines using each field's label and a few common synonyms.
 * It is far less capable than a real LLM but lets the whole pipeline run offline and in tests.
 */

const TYPE_KEYWORDS = {
  invoice: ['invoice', 'gstin', 'bill to', 'subtotal', 'tax invoice', 'amount due', 'cgst', 'sgst'],
  certificate: ['marks', 'mark sheet', 'marksheet', 'certificate', 'university', 'board', 'roll', 'register no',
    'examination', 'percentage', 'result', 'degree'],
  identity_document: ['aadhaar', 'aadhar', 'income tax department', 'permanent account number', 'passport',
    'driving licence', 'election commission', 'unique identification', 'government of india', 'uid'],
  application_form: ['application form', 'applicant', 'applied for', 'signature of applicant', 'declaration',
    'application'],
};

const SYNONYMS = {
  full_name: ['name', 'full name', 'holder name'],
  student_name: ['name of the student', 'student name', 'name of candidate', 'candidate name', 'name'],
  applicant_name: ['applicant name', 'name of applicant', 'full name', 'name'],
  person_name: ['name'],
  date_of_birth: ['date of birth', 'dob', 'd.o.b', 'birth date', 'year of birth'],
  father_name: ["father's name", 'father name', 'fathers name', "father's / guardian's name", 'guardian name', 'father'],
  document_number: ['aadhaar number', 'aadhaar no', 'pan', 'permanent account number', 'passport no', 'passport number',
    'licence no', 'dl no', 'epic no', 'id number', 'document number', 'number'],
  id_type: ['id type', 'document type'],
  register_number: ['register number', 'register no', 'reg no', 'roll number', 'roll no', 'enrolment no', 'seat no'],
  institution_name: ['institution', 'school', 'college', 'institute', 'name of institution'],
  board_or_university: ['board', 'university'],
  year_of_passing: ['year of passing', 'year of exam', 'passing year', 'year'],
  total_marks: ['marks obtained', 'total marks obtained', 'grand total', 'total marks', 'total'],
  max_marks: ['maximum marks', 'max marks', 'out of'],
  invoice_number: ['invoice number', 'invoice no', 'invoice #', 'bill no', 'bill number'],
  invoice_date: ['invoice date', 'date of invoice', 'bill date', 'date'],
  due_date: ['due date', 'payment due'],
  vendor_name: ['vendor', 'seller', 'from', 'supplier', 'vendor name', 'sold by'],
  vendor_gstin: ['gstin', 'gst no', 'gst number', 'vendor gstin'],
  buyer_name: ['bill to', 'buyer', 'customer', 'buyer name', 'sold to'],
  subtotal: ['subtotal', 'sub total', 'taxable value'],
  tax_amount: ['tax amount', 'tax', 'gst', 'igst', 'total tax'],
  total_amount: ['total amount', 'grand total', 'amount payable', 'total due', 'total'],
  issue_date: ['date of issue', 'issue date', 'issued on'],
  phone: ['phone', 'mobile', 'contact number', 'phone number'],
  email: ['email', 'e-mail', 'email id'],
  applied_for: ['applied for', 'course applied', 'position applied', 'post applied', 'course'],
  application_date: ['application date', 'date of application', 'date'],
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function findLabelled(lines, labels) {
  // Longer labels first so "date of birth" wins over "date".
  const sorted = [...labels].sort((a, b) => b.length - a.length);
  for (const label of sorted) {
    const re = new RegExp(`(?:^|\\b)${escapeRe(label)}\\s*[:\\-–]\\s*(.+)$`, 'i');
    for (const line of lines) {
      const m = line.match(re);
      if (m) {
        let value = m[1].trim();
        // Stop at the next "Label:" on the same line.
        value = value.split(/\s{2,}(?=[A-Z][A-Za-z'’ /.]{1,30}\s*:)/)[0].trim();
        if (value) return value;
      }
    }
  }
  return null;
}

function detectIdType(text) {
  const t = text.toLowerCase();
  if (/aadhaar|aadhar|unique identification/.test(t)) return 'Aadhaar';
  if (/permanent account number|income tax department/.test(t)) return 'PAN';
  if (/passport/.test(t)) return 'Passport';
  if (/driving licen[cs]e/.test(t)) return 'Driving Licence';
  if (/election commission|voter/.test(t)) return 'Voter ID';
  return 'Other';
}

function extractLineItems(lines) {
  const items = [];
  // "<description> <qty> <unit price> <amount>" with numbers at the end of the line
  const re = /^(.+?)\s+(\d+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)$/;
  for (const line of lines) {
    const m = line.trim().match(re);
    if (m && !/total|subtotal|tax|qty|quantity/i.test(m[1])) {
      items.push({
        description: m[1].trim(), quantity: parseNumber(m[2]), unit_price: parseNumber(m[3]), amount: parseNumber(m[4]),
      });
    }
  }
  return items.length ? items : null;
}

export class MockClient {
  constructor() {
    this.name = 'mock';
  }

  get modelId() {
    return 'mock/rule-based-extractor';
  }

  async classify({ text, types }) {
    const t = text.toLowerCase();
    const keys = new Set(types.map((x) => x.key));
    let best = { key: 'other', score: 0 };
    for (const [key, words] of Object.entries(TYPE_KEYWORDS)) {
      if (!keys.has(key)) continue;
      const score = words.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
      if (score > best.score) best = { key, score };
    }
    const confidence = best.score === 0 ? 0.3 : Math.min(0.95, 0.5 + best.score * 0.12);
    return { document_type: best.key, confidence, reason: `Matched ${best.score} keyword(s)` };
  }

  async extract({ text, type }) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const data = {};
    for (const field of type.fields) {
      if (field.type === 'array') {
        data[field.key] = field.key === 'line_items' ? extractLineItems(lines) : null;
        continue;
      }
      if (field.key === 'id_type') { data[field.key] = detectIdType(text); continue; }
      const labels = [field.label.toLowerCase(), field.key.replace(/_/g, ' '), ...(SYNONYMS[field.key] || [])];
      let value = findLabelled(lines, labels);
      if (value !== null) {
        if (field.type === 'date') {
          const m = value.match(/\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/);
          value = normalizeDate(m ? m[0] : value) ?? value;
        }
        if (field.type === 'number') {
          const pct = field.key === 'percentage';
          const n = parseNumber(pct ? value.replace('%', '') : value.split('/')[0]);
          value = n ?? value;
        }
        if (field.key === 'max_marks' && typeof value === 'string') value = parseNumber(value);
      }
      if (field.key === 'max_marks' && value === null) {
        const m = text.match(/(\d{2,4})\s*\/\s*(\d{2,4})/);
        if (m) value = Number(m[2]);
      }
      data[field.key] = value;
    }
    return { data, raw: JSON.stringify(data) };
  }

  async explain({ issues }) {
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    const parts = [];
    if (errors.length) parts.push(`${errors.length} error(s) need attention, starting with: ${errors[0].message}.`);
    if (warnings.length) parts.push(`${warnings.length} warning(s) should be checked, for example: ${warnings[0].message}.`);
    parts.push('These are preliminary automated checks; please compare the flagged fields with the original document.');
    return parts.join(' ');
  }
}
