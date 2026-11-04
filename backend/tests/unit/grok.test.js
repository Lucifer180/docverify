import { describe, it, expect, vi } from 'vitest';
import { GrokProvider } from '../../src/services/llm/grok.provider.js';
import { TransientError, PermanentError } from '../../src/utils/errors.js';

const reply = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (h) => headers[h.toLowerCase()] ?? null },
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const make = (fetchImpl) => new GrokProvider({ apiKey: 'k', baseUrl: 'https://api.x.ai/v1', model: 'grok-test', timeoutMs: 1000, fetchImpl });

describe('GrokProvider', () => {
  it('sends a JSON-schema request and parses the reply', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { model: 'grok-test', choices: [{ message: { content: '{"a":1}' } }] }));
    const out = await make(fetchImpl).chatJson({ system: 's', user: 'u', schema: { type: 'object' } });
    expect(out.parsed).toEqual({ a: 1 });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.response_format.type).toBe('json_schema');
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.x.ai/v1/chat/completions');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer k');
  });

  it('treats rate limits and server errors as retryable', async () => {
    await expect(make(vi.fn().mockResolvedValue(reply(429, 'slow down', { 'retry-after': '3' })))
      .chatJson({ system: 's', user: 'u' })).rejects.toMatchObject({ name: 'TransientError', retryAfterMs: 3000 });
    await expect(make(vi.fn().mockResolvedValue(reply(503, 'down'))).chatJson({ system: 's', user: 'u' }))
      .rejects.toBeInstanceOf(TransientError);
    await expect(make(vi.fn().mockRejectedValue(new Error('ECONNRESET'))).chatJson({ system: 's', user: 'u' }))
      .rejects.toBeInstanceOf(TransientError);
  });

  it('treats a bad API key as permanent', async () => {
    await expect(make(vi.fn().mockResolvedValue(reply(401, 'no'))).chatJson({ system: 's', user: 'u' }))
      .rejects.toBeInstanceOf(PermanentError);
  });

  it('falls back to JSON mode if the model rejects json_schema', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(reply(400, 'response_format json_schema is not supported'))
      .mockResolvedValueOnce(reply(200, { choices: [{ message: { content: '```json\n{"b":2}\n```' } }] }));
    const out = await make(fetchImpl).chatJson({ system: 's', user: 'u', schema: { type: 'object' } });
    expect(out.parsed).toEqual({ b: 2 });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).response_format.type).toBe('json_object');
  });
});
