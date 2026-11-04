import { describe, it, expect } from 'vitest';
import { buildZodSchema, buildJsonSchema } from '../../src/utils/schemaBuilder.js';
import { maskValue, redactText } from '../../src/utils/mask.js';
import { defaultDocumentTypes } from '../../src/database/seed-data/documentTypes.js';

const invoice = defaultDocumentTypes.find((t) => t.key === 'invoice');

describe('schema builder', () => {
  it('normalises numbers and dates and fills missing fields with null', () => {
    const parsed = buildZodSchema(invoice.fields).parse({ total_amount: '₹1,180.00', invoice_date: '10/01/2025', extra: 1 });
    expect(parsed.total_amount).toBe(1180);
    expect(parsed.invoice_date).toBe('2025-01-10');
    expect(parsed.vendor_name).toBeNull();
    expect(parsed).not.toHaveProperty('extra');
  });

  it('rejects wrong types', () => {
    expect(buildZodSchema(invoice.fields).safeParse({ total_amount: 'lots' }).success).toBe(false);
    expect(buildZodSchema(invoice.fields).safeParse({ vendor_name: { a: 1 } }).success).toBe(false);
  });

  it('builds a strict JSON schema for structured outputs', () => {
    const schema = buildJsonSchema(invoice.fields);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(invoice.fields.map((f) => f.key));
    expect(schema.properties.line_items.items.required).toEqual(['description', 'quantity', 'unit_price', 'amount']);
  });
});

describe('masking', () => {
  it('keeps only the last four characters', () => {
    expect(maskValue('1234 5678 9012')).toBe('XXXX XXXX 9012');
    expect(maskValue('ABCDE1234F')).toBe('XXXXXX234F');
    expect(maskValue(null)).toBeNull();
  });

  it('redacts identifiers from log text', () => {
    const out = redactText('Aadhaar 2345 6789 0123, PAN ABCDE1234F, mail a@b.com, phone 9876543210');
    expect(out).not.toMatch(/2345|ABCDE1234F|a@b\.com|9876543210/);
  });
});
