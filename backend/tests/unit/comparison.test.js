import { describe, it, expect } from 'vitest';
import { compareNames, compareDates, compareAcrossDocuments, compareWithSubmitter } from '../../src/services/comparison.service.js';
import { defaultDocumentTypes } from '../../src/database/seed-data/documentTypes.js';

const type = (key) => defaultDocumentTypes.find((t) => t.key === key);

describe('compareNames', () => {
  it.each([
    ['Ravi Kumar', 'RAVI  KUMAR', 'match'],
    ['Ravi Kumar', 'Kumar, Ravi', 'match'],
    ['Mr. Ravi Kumar', 'Ravi Kumar', 'match'],
    ['R. Kumar', 'Ravi Kumar', 'possible_match'],
    ['Ravi Kumar', 'Ravi Kumaar', 'possible_match'],
    ['Ravi Kumar Sharma', 'Ravi Sharma', 'possible_match'],
    ['Ravi Kumar', 'Suresh Patel', 'mismatch'],
    ['A. Desai', 'B. Desai', 'mismatch'],
  ])('%s vs %s -> %s', (a, b, expected) => {
    expect(compareNames(a, b).result).toBe(expected);
  });
});

describe('compareDates', () => {
  it('matches the same date written differently', () => {
    expect(compareDates('12/03/2004', '2004-03-12').result).toBe('match');
  });
  it('flags different dates', () => {
    expect(compareDates('12/03/2004', '13/03/2004').result).toBe('mismatch');
  });
});

describe('compareAcrossDocuments', () => {
  const docs = [
    { id: 'a', name: 'id.png', typeDef: type('identity_document'), fields: { full_name: 'Ravi Kumar', date_of_birth: '2004-03-12' } },
    { id: 'b', name: 'marks.pdf', typeDef: type('certificate'), fields: { student_name: 'RAVI KUMAR', date_of_birth: '2004-04-12' } },
  ];

  it('reports a date-of-birth mismatch as an error and name as consistent', () => {
    const results = compareAcrossDocuments(docs);
    const dob = results.find((r) => r.rule === 'cross_document_date_of_birth');
    const name = results.find((r) => r.rule === 'cross_document_person_name');
    expect(dob.passed).toBe(false);
    expect(dob.severity).toBe('error');
    expect(dob.details.documentIds).toEqual(['a', 'b']);
    expect(name.passed).toBe(true);
  });

  it('needs at least two documents with the field', () => {
    expect(compareAcrossDocuments([docs[0]])).toEqual([]);
  });
});

describe('compareWithSubmitter', () => {
  it('compares extracted name and DOB with the case details', () => {
    const results = compareWithSubmitter({
      documentId: 'a', documentName: 'id.png', typeDef: type('identity_document'),
      fields: { full_name: 'R. Kumar', date_of_birth: '2004-03-12' },
      caseRow: { applicant_name: 'Ravi Kumar', applicant_dob: '2004-03-12' },
    });
    expect(results.find((r) => r.field === 'full_name').details.match).toBe('possible_match');
    expect(results.find((r) => r.field === 'date_of_birth').passed).toBe(true);
  });
});
