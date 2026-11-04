import { describe, it, expect } from 'vitest';
import { validateDocument } from '../../src/services/validation.service.js';
import { defaultDocumentTypes } from '../../src/database/seed-data/documentTypes.js';

const type = (key) => defaultDocumentTypes.find((t) => t.key === key);
const failed = (results) => results.filter((r) => !r.passed).map((r) => r.rule);

describe('validateDocument', () => {
  it('passes a consistent invoice', () => {
    const results = validateDocument({ documentId: 'd', typeDef: type('invoice'), fields: {
      invoice_number: 'INV-1', invoice_date: '2025-01-10', due_date: '2025-02-10', vendor_name: 'ACME',
      vendor_gstin: '29ABCDE1234F1Z5', subtotal: 1000, tax_amount: 180, total_amount: 1180,
      line_items: [{ description: 'x', quantity: 2, unit_price: 500, amount: 1000 }],
    } });
    expect(failed(results)).toEqual([]);
  });

  it('flags wrong totals, line items and a bad GSTIN', () => {
    const results = validateDocument({ documentId: 'd', typeDef: type('invoice'), fields: {
      invoice_number: 'INV-1', invoice_date: '2025-01-10', vendor_name: 'ACME', vendor_gstin: '29ABCDE1234F125',
      subtotal: 1000, tax_amount: 180, total_amount: 1200,
      line_items: [{ description: 'x', quantity: 2, unit_price: 400, amount: 900 }],
    } });
    expect(failed(results)).toEqual(expect.arrayContaining(['pattern', 'subtotal_plus_tax', 'line_items_sum', 'line_item_math']));
  });

  it('reports missing required fields and invalid formats', () => {
    const results = validateDocument({ documentId: 'd', typeDef: type('identity_document'), fields: {
      id_type: 'Aadhaar', full_name: null, date_of_birth: '31/02/2004', document_number: '1234',
    } });
    const rules = failed(results);
    expect(rules).toContain('required');
    expect(rules).toContain('format');
    expect(rules).toContain('aadhaar_format');
  });

  it('checks date logic', () => {
    const results = validateDocument({ documentId: 'd', typeDef: type('identity_document'), fields: {
      id_type: 'PAN', full_name: 'A', date_of_birth: '2099-01-01', document_number: 'ABCDE1234F',
      issue_date: '2020-01-01', expiry_date: '2019-01-01',
    } });
    expect(failed(results)).toEqual(expect.arrayContaining(['dob_not_future', 'issue_before_expiry']));
    expect(results.find((r) => r.rule === 'pan_format').passed).toBe(true);
  });

  it('checks marks and percentage on certificates', () => {
    const results = validateDocument({ documentId: 'd', typeDef: type('certificate'), fields: {
      student_name: 'A', register_number: '1', institution_name: 'X', year_of_passing: 2021,
      total_marks: 540, max_marks: 500, percentage: 88,
    } });
    expect(failed(results)).toEqual(expect.arrayContaining(['marks_within_max', 'percentage_consistent']));
  });

  it('masks sensitive values in result details', () => {
    const results = validateDocument({ documentId: 'd', typeDef: type('identity_document'), fields: {
      id_type: 'Aadhaar', full_name: 'A', date_of_birth: '2000-01-01', document_number: '1234 5678 9012',
    } });
    const r = results.find((x) => x.rule === 'aadhaar_format');
    expect(r.details.value).toBe('XXXX XXXX 9012');
  });
});
