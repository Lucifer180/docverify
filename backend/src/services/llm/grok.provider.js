import env from '../../config/env.js';
import { PermanentError, TransientError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';

/**
 * Minimal client for the xAI Grok chat completions API (OpenAI-compatible).
 * Uses structured outputs (JSON schema) and falls back to JSON mode if the
 * selected model does not support schemas.
 */
export class GrokProvider {
  constructor({ apiKey = env.grokApiKey, baseUrl = env.grokBaseUrl, model = env.grokModel,
    timeoutMs = env.llmTimeoutMs, fetchImpl = globalThis.fetch } = {}) {
    this.name = 'grok';
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
    this.schemaModeSupported = true;
  }

  get modelId() {
    return `xai/${this.model}`;
  }

  async #post(body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res;
    try {
      res = await this.fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const reason = err.name === 'AbortError' ? `timed out after ${this.timeoutMs} ms` : err.message;
      throw new TransientError(`Grok API request failed: ${reason}`, { cause: err });
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    if (res.ok) {
      try { return JSON.parse(text); } catch { throw new TransientError('Grok API returned invalid JSON'); }
    }

    const short = text.slice(0, 300);
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after'));
      throw new TransientError(`Grok API ${res.status}: ${short}`, {
        retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
      });
    }
    if (res.status === 401 || res.status === 403) {
      throw new PermanentError('Grok API rejected the API key (check GROK_API_KEY)');
    }
    const err = new PermanentError(`Grok API ${res.status}: ${short}`);
    err.status = res.status;
    throw err;
  }

  /**
   * Sends a prompt and returns the parsed JSON object from the reply.
   * Returns the raw content too so callers can report what went wrong.
   */
  async chatJson({ system, user, schema, schemaName = 'result', temperature = 0 }) {
    const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
    const base = { model: this.model, messages, temperature };

    let data;
    if (this.schemaModeSupported && schema) {
      try {
        data = await this.#post({
          ...base,
          response_format: { type: 'json_schema', json_schema: { name: schemaName, schema, strict: true } },
        });
      } catch (err) {
        if (err instanceof PermanentError && err.status === 400 && /response_format|json_schema|schema/i.test(err.message)) {
          logger.warn('Grok model does not accept JSON schema mode; falling back to JSON mode', { model: this.model });
          this.schemaModeSupported = false;
        } else {
          throw err;
        }
      }
    }
    if (!data) {
      const schemaHint = schema ? `\n\nReturn JSON matching this JSON Schema:\n${JSON.stringify(schema)}` : '';
      data = await this.#post({
        ...base,
        messages: [{ role: 'system', content: system + schemaHint }, { role: 'user', content: user }],
        response_format: { type: 'json_object' },
      });
    }

    const content = data?.choices?.[0]?.message?.content ?? '';
    let parsed = null;
    try {
      parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch {
      parsed = null;
    }
    return { parsed, content, model: data?.model || this.model, usage: data?.usage };
  }
}
