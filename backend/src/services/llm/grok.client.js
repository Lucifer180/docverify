import { GrokProvider } from './grok.provider.js';
import {
  classificationPrompt, classificationSchema, extractionPrompt, explanationPrompt, explanationSchema,
} from './prompts.js';
import { buildJsonSchema } from '../../utils/schemaBuilder.js';

/** LLM tasks implemented with Grok. */
export class GrokClient {
  constructor(options) {
    this.provider = new GrokProvider(options);
    this.name = 'grok';
  }

  get modelId() {
    return this.provider.modelId;
  }

  async classify({ text, types }) {
    const { system, user } = classificationPrompt({ text, types });
    const { parsed } = await this.provider.chatJson({
      system, user, schema: classificationSchema(types.map((t) => t.key)), schemaName: 'classification',
    });
    return parsed;
  }

  async extract({ text, type, previousErrors }) {
    const { system, user } = extractionPrompt({ text, type, previousErrors });
    const { parsed, content } = await this.provider.chatJson({
      system, user, schema: buildJsonSchema(type.fields), schemaName: `${type.key}_fields`,
    });
    return { data: parsed, raw: content };
  }

  async explain({ issues }) {
    const { system, user } = explanationPrompt({ issues });
    const { parsed } = await this.provider.chatJson({ system, user, schema: explanationSchema, schemaName: 'explanation' });
    return parsed?.summary || null;
  }
}
