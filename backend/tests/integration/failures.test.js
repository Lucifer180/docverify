import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { setup, teardown, login, accounts, drainQueue, SAMPLES } from '../helpers.js';
import { setLlmClient } from '../../src/services/llm/index.js';
import { MockClient } from '../../src/services/llm/mock.client.js';
import { TransientError } from '../../src/utils/errors.js';

let app; let submitter;
const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  app = await setup();
  submitter = await login(app, ...accounts.submitter);
});
afterEach(() => setLlmClient(new MockClient()));
afterAll(teardown);

async function uploadOne(file) {
  const c = (await request(app).post('/api/cases').set(auth(submitter)).send({ title: 'Failure test', applicantName: 'Ravi Kumar Sharma' })).body.data;
  await request(app).post(`/api/cases/${c.id}/documents`).set(auth(submitter)).attach('files', path.join(SAMPLES, file));
  await drainQueue();
  return (await request(app).get(`/api/cases/${c.id}`).set(auth(submitter))).body.data;
}

describe('processing failures', () => {
  it('retries LLM outages and finally marks the document as failed', async () => {
    let calls = 0;
    setLlmClient({ name: 'down', modelId: 'down', classify: async () => { calls += 1; throw new TransientError('timeout'); },
      extract: async () => ({}), explain: async () => null });
    const detail = await uploadOne('c1_aadhaar.png');
    expect(calls).toBe(2); // JOB_MAX_ATTEMPTS=2 in tests
    expect(detail.documents[0].status).toBe('processing_failed');
    expect(detail.case.preliminaryStatus).toBe('flagged');
    expect(detail.results.some((r) => r.rule === 'processing_failed')).toBe(true);
  });

  it('retries once with schema errors, then leaves fields for manual entry', async () => {
    const mock = new MockClient();
    let extractCalls = 0;
    setLlmClient({ name: 'bad', modelId: 'bad', classify: (a) => mock.classify(a), explain: async () => null,
      extract: async ({ previousErrors }) => { extractCalls += 1; if (extractCalls === 2) expect(previousErrors.length).toBeGreaterThan(0);
        return { data: { full_name: { not: 'a string' } } }; } });
    const detail = await uploadOne('c1_aadhaar.png');
    expect(extractCalls).toBe(2);
    const doc = detail.documents[0];
    expect(doc.needsManualEntry).toBe(true);
    expect(doc.fields.data.full_name).toBeNull();
    expect(detail.results.some((r) => r.rule === 'manual_entry_required')).toBe(true);
  });

  it('recovers when the corrective retry succeeds', async () => {
    const mock = new MockClient();
    let n = 0;
    setLlmClient({ name: 'flaky', modelId: 'flaky', classify: (a) => mock.classify(a), explain: async () => null,
      extract: async (a) => { n += 1; return n === 1 ? { data: 'not json' } : mock.extract(a); } });
    const detail = await uploadOne('c1_aadhaar.png');
    expect(detail.documents[0].needsManualEntry).toBe(false);
    expect(detail.documents[0].fields.data.full_name).toBe('Ravi Kumar Sharma');
  });
});
