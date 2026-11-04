import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, teardown, login, accounts, drainQueue, SAMPLES } from '../helpers.js';
import { getDb } from '../../src/config/db.js';

let app; let submitter; let reviewer; let admin; let otherSubmitter;
const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  app = await setup();
  submitter = await login(app, ...accounts.submitter);
  reviewer = await login(app, ...accounts.reviewer);
  admin = await login(app, ...accounts.admin);
  const reg = await request(app).post('/api/auth/register').send({ name: 'Other User', email: 'other@example.com', password: 'Passw0rd!' });
  otherSubmitter = reg.body.data.token;
});
afterAll(teardown);

async function createCase(body) {
  const res = await request(app).post('/api/cases').set(auth(submitter)).send(body);
  expect(res.status).toBe(201);
  return res.body.data;
}

describe('upload validation', () => {
  let caseId;
  beforeAll(async () => { caseId = (await createCase({ title: 'Upload tests', applicantName: 'Test Person' })).id; });

  it('rejects disguised and unsupported files and stores nothing', async () => {
    const res = await request(app).post(`/api/cases/${caseId}/documents`).set(auth(submitter))
      .attach('files', path.join(SAMPLES, 'invalid_disguised.pdf'))
      .attach('files', path.join(SAMPLES, 'c1_aadhaar.png'));
    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/not a real PDF/);
    const txt = await request(app).post(`/api/cases/${caseId}/documents`).set(auth(submitter))
      .attach('files', path.join(SAMPLES, 'invalid_notes.txt'));
    expect(txt.status).toBe(400);
    const detail = await request(app).get(`/api/cases/${caseId}`).set(auth(submitter));
    expect(detail.body.data.documents).toHaveLength(0);
  });

  it('rejects a PNG renamed to .pdf', async () => {
    const buffer = await fs.readFile(path.join(SAMPLES, 'c1_aadhaar.png'));
    const res = await request(app).post(`/api/cases/${caseId}/documents`).set(auth(submitter))
      .attach('files', buffer, 'renamed.pdf');
    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/extension does not match/);
  });

  it('rejects oversized files', async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 1);
    const res = await request(app).post(`/api/cases/${caseId}/documents`).set(auth(submitter)).attach('files', big, 'big.png');
    expect(res.status).toBe(413);
  });

  it('hides other users\' cases', async () => {
    const res = await request(app).get(`/api/cases/${caseId}`).set(auth(otherSubmitter));
    expect(res.status).toBe(404);
    const up = await request(app).post(`/api/cases/${caseId}/documents`).set(auth(otherSubmitter))
      .attach('files', path.join(SAMPLES, 'c1_aadhaar.png'));
    expect(up.status).toBe(404);
  });
});

describe('end-to-end verification workflow', () => {
  let caseId;

  it('processes a consistent case to "passed" through OCR, PDF text layer and scanned PDF', async () => {
    caseId = (await createCase({ title: 'Admission - Ravi', applicantName: 'Ravi Kumar Sharma', applicantDob: '12/03/2004' })).id;
    const res = await request(app).post(`/api/cases/${caseId}/documents`).set(auth(submitter))
      .attach('files', path.join(SAMPLES, 'c1_aadhaar.png'))
      .attach('files', path.join(SAMPLES, 'c1_marksheet.pdf'))
      .attach('files', path.join(SAMPLES, 'c1_application_scanned.pdf'));
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(3);

    await drainQueue();
    const detail = (await request(app).get(`/api/cases/${caseId}`).set(auth(submitter))).body.data;
    const byName = Object.fromEntries(detail.documents.map((d) => [d.originalName, d]));
    expect(byName['c1_marksheet.pdf'].extractionMethod).toBe('text_layer');
    expect(byName['c1_application_scanned.pdf'].extractionMethod).toBe('ocr');
    expect(byName['c1_aadhaar.png'].documentType).toBe('identity_document');
    expect(detail.case.preliminaryStatus).toBe('passed');
    expect(detail.summary.errors).toBe(0);
    // Submitters only ever see masked identity numbers.
    expect(byName['c1_aadhaar.png'].fields.data.document_number).toBe('XXXX XXXX 0123');
  });

  it('lets reviewers see submitted cases only', async () => {
    const before = await request(app).get(`/api/cases/${caseId}`).set(auth(reviewer));
    expect(before.status).toBe(404);
    const submit = await request(app).post(`/api/cases/${caseId}/submit`).set(auth(submitter));
    expect(submit.body.data.status).toBe('submitted');
    const after = await request(app).get(`/api/cases/${caseId}`).set(auth(reviewer));
    expect(after.status).toBe(200);
  });

  it('reveals sensitive values to reviewers only on request, and audits it', async () => {
    const masked = (await request(app).get(`/api/cases/${caseId}`).set(auth(reviewer))).body.data;
    const id = masked.documents.find((d) => d.documentType === 'identity_document');
    expect(id.fields.data.document_number).toMatch(/^X/);
    const full = (await request(app).get(`/api/cases/${caseId}?reveal=true`).set(auth(reviewer))).body.data;
    expect(full.documents.find((d) => d.id === id.id).fields.data.document_number).toBe('2345 6789 0123');
    const subTry = (await request(app).get(`/api/cases/${caseId}?reveal=true`).set(auth(submitter))).body.data;
    expect(subTry.sensitiveRevealed).toBe(false);
  });

  it('serves the original file through a short-lived link', async () => {
    const detail = (await request(app).get(`/api/cases/${caseId}`).set(auth(reviewer))).body.data;
    const link = await request(app).get(`/api/documents/${detail.documents[0].id}/file-link`).set(auth(reviewer));
    expect(link.body.data.url).toMatch(/^\/api\/files\//);
    const file = await request(app).get(link.body.data.url);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect((await request(app).get('/api/files/invalid-token-xxxxxxxxxxxxxxxxxxx')).status).toBe(401);
  });

  it('records reviewer corrections as new versions and keeps the original', async () => {
    const detail = (await request(app).get(`/api/cases/${caseId}`).set(auth(reviewer))).body.data;
    const doc = detail.documents.find((d) => d.documentType === 'certificate');
    const res = await request(app).put(`/api/documents/${doc.id}/fields`).set(auth(reviewer))
      .send({ fields: { result: 'PASS WITH DISTINCTION' }, note: 'Read from original' });
    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.source).toBe('reviewer');
    const versions = (await request(app).get(`/api/documents/${doc.id}/versions`).set(auth(reviewer))).body.data;
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    expect(versions[1].data.result).toBe('PASS');
  });

  it('does not overwrite a sensitive value when the masked value is sent back', async () => {
    const detail = (await request(app).get(`/api/cases/${caseId}`).set(auth(reviewer))).body.data;
    const doc = detail.documents.find((d) => d.documentType === 'identity_document');
    await request(app).put(`/api/documents/${doc.id}/fields`).set(auth(reviewer))
      .send({ fields: { ...doc.fields.data, gender: 'M' } });
    const full = (await request(app).get(`/api/cases/${caseId}?reveal=true`).set(auth(reviewer))).body.data;
    expect(full.documents.find((d) => d.id === doc.id).fields.data.document_number).toBe('2345 6789 0123');
  });

  it('requires a comment for rejection and records the decision', async () => {
    const noComment = await request(app).post(`/api/cases/${caseId}/decision`).set(auth(reviewer)).send({ decision: 'rejected' });
    expect(noComment.status).toBe(400);
    const subDecide = await request(app).post(`/api/cases/${caseId}/decision`).set(auth(submitter)).send({ decision: 'approved' });
    expect(subDecide.status).toBe(403);
    const ok = await request(app).post(`/api/cases/${caseId}/decision`).set(auth(reviewer)).send({ decision: 'approved' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('approved');
    const again = await request(app).post(`/api/cases/${caseId}/decision`).set(auth(reviewer)).send({ decision: 'rejected', comment: 'x' });
    expect(again.status).toBe(409);
  });

  it('exports a report and keeps a complete, append-only audit trail', async () => {
    const report = await request(app).get(`/api/cases/${caseId}/report`).set(auth(reviewer));
    expect(report.status).toBe(200);
    expect(report.text).toContain('Preliminary verification only');
    expect(report.text).not.toContain('2345 6789 0123');

    const history = (await request(app).get(`/api/cases/${caseId}/history`).set(auth(reviewer))).body.data;
    const actions = history.map((h) => h.action);
    for (const a of ['case.created', 'document.uploaded', 'processing.text_extracted', 'processing.fields_extracted',
      'case.submitted', 'fields.corrected', 'case.decision', 'fields.sensitive_revealed']) {
      expect(actions).toContain(a);
    }
    expect(JSON.stringify(history)).not.toContain('2345 6789 0123');
    expect(() => getDb().prepare('DELETE FROM audit_logs').run()).toThrow(/append-only/);
    expect(() => getDb().prepare("UPDATE audit_logs SET action = 'x'").run()).toThrow(/append-only/);
  });
});

describe('discrepancy detection and correction requests', () => {
  let caseId;

  it('flags a mismatched DOB, name initials and marks above maximum', async () => {
    caseId = (await createCase({ title: 'Admission - Anita', applicantName: 'Anita Desai', applicantDob: '2003-07-25' })).id;
    await request(app).post(`/api/cases/${caseId}/documents`).set(auth(submitter))
      .attach('files', path.join(SAMPLES, 'c2_aadhaar_initial.jpg'))
      .attach('files', path.join(SAMPLES, 'c2_marksheet_modified.png'));
    await drainQueue();
    const detail = (await request(app).get(`/api/cases/${caseId}`).set(auth(submitter))).body.data;
    expect(detail.case.preliminaryStatus).toBe('flagged');
    const failed = detail.results.filter((r) => !r.passed).map((r) => r.rule);
    expect(failed).toEqual(expect.arrayContaining(['cross_document_date_of_birth', 'cross_document_person_name',
      'marks_within_max', 'percentage_consistent', 'matches_submitter']));
    expect(detail.case.issueSummary).toBeTruthy();
  });

  it('sends the case back to the submitter, who can fix and resubmit', async () => {
    await request(app).post(`/api/cases/${caseId}/submit`).set(auth(submitter));
    const res = await request(app).post(`/api/cases/${caseId}/decision`).set(auth(reviewer))
      .send({ decision: 'correction_requested', comment: 'Upload the correct mark sheet' });
    expect(res.body.data.status).toBe('correction_requested');

    const detail = (await request(app).get(`/api/cases/${caseId}`).set(auth(submitter))).body.data;
    const marksheet = detail.documents.find((d) => d.originalName === 'c2_marksheet_modified.png');
    expect((await request(app).delete(`/api/documents/${marksheet.id}`).set(auth(submitter))).status).toBe(200);
    const resubmit = await request(app).post(`/api/cases/${caseId}/submit`).set(auth(submitter));
    expect(resubmit.body.data.status).toBe('submitted');
  });
});

describe('admin configuration', () => {
  it('adds a document type with rules without code changes', async () => {
    const res = await request(app).post('/api/document-types').set(auth(admin)).send({
      key: 'bank_statement', name: 'Bank Statement', description: 'Monthly bank statement',
      fields: [
        { key: 'account_holder', label: 'Account Holder', type: 'string', required: true, compareAs: 'person_name' },
        { key: 'closing_balance', label: 'Closing Balance', type: 'number' },
      ],
      rules: [{ id: 'balance_positive', type: 'number_range', field: 'closing_balance', min: 0, severity: 'warning' }],
    });
    expect(res.status).toBe(201);
    const bad = await request(app).post('/api/document-types').set(auth(admin))
      .send({ key: 'x_bad', name: 'Bad', fields: [{ key: 'a', label: 'A', type: 'string', pattern: '([' }] });
    expect(bad.status).toBe(400);
    const list = (await request(app).get('/api/document-types').set(auth(submitter))).body.data;
    expect(list.map((t) => t.key)).toContain('bank_statement');
  });

  it('lists audit logs for admins', async () => {
    const res = await request(app).get('/api/audit-logs?action=case.&limit=5').set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.meta.total).toBeGreaterThan(0);
  });
});
