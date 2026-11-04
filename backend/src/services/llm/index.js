import env from '../../config/env.js';
import { GrokClient } from './grok.client.js';
import { MockClient } from './mock.client.js';
import logger from '../../utils/logger.js';

let client;

/** Returns the configured LLM client (Grok, or the offline mock). */
export function getLlmClient() {
  if (client) return client;
  if (env.llmProvider === 'grok') {
    client = new GrokClient();
  } else {
    client = new MockClient();
    if (!env.isTest) logger.warn('Using the offline mock extractor. Set LLM_PROVIDER=grok and GROK_API_KEY to use Grok.');
  }
  return client;
}

/** Lets tests swap in a fake client. */
export function setLlmClient(c) {
  client = c;
}
