/**
 * Prompts for the LLM. The model only ever receives extracted text (never the image),
 * and it never decides whether a document passes - it only classifies, extracts
 * and explains rule results that the validation engine already produced.
 */

export function classificationPrompt({ text, types }) {
  const typeList = types.map((t) => `- ${t.key}: ${t.name} — ${t.description || ''}`).join('\n');
  return {
    system: [
      'You classify documents for a document-verification system.',
      'You receive OCR text, which may contain recognition errors.',
      'Choose exactly one document type from the list. Use "other" if none fits.',
      'confidence is a number between 0 and 1 describing how sure you are.',
      'Respond with JSON only.',
    ].join(' '),
    user: `Document types:\n${typeList}\n\nDocument text:\n"""\n${text}\n"""`,
  };
}

export function classificationSchema(typeKeys) {
  return {
    type: 'object',
    properties: {
      document_type: { type: 'string', enum: typeKeys },
      confidence: { type: 'number' },
      reason: { type: 'string' },
    },
    required: ['document_type', 'confidence', 'reason'],
    additionalProperties: false,
  };
}

export function extractionPrompt({ text, type, previousErrors }) {
  const fieldList = type.fields.map((f) => {
    const parts = [`- ${f.key} (${f.type}${f.required ? ', required' : ''}): ${f.label}`];
    if (f.hint) parts.push(`  Hint: ${f.hint}`);
    if (f.type === 'array') parts.push(`  Each item has: ${(f.itemFields || []).map((i) => `${i.key} (${i.type})`).join(', ')}`);
    return parts.join('\n');
  }).join('\n');

  const rules = [
    `Extract fields from a "${type.name}" document.`,
    'The text comes from OCR and may contain recognition errors.',
    'Copy values exactly as they appear in the document; do not correct, complete or invent anything.',
    'If a field is not present or you are not sure, return null for it. Never guess.',
    'Return dates as YYYY-MM-DD. Numeric dates in this document use day/month/year order unless clearly otherwise.',
    'Return numbers as plain numbers without currency symbols, commas or percent signs.',
    'Respond with a single JSON object containing exactly the listed keys.',
  ].join(' ');

  let user = `Fields to extract:\n${fieldList}\n\nDocument text:\n"""\n${text}\n"""`;
  if (previousErrors?.length) {
    user += `\n\nYour previous answer did not match the required format. Fix these problems:\n- ${previousErrors.join('\n- ')}`;
  }
  return { system: rules, user };
}

export function explanationPrompt({ issues }) {
  const list = issues.map((i, n) => `${n + 1}. [${i.severity}] ${i.rule}${i.field ? ` (${i.field})` : ''}: ${i.message}`).join('\n');
  return {
    system: [
      'You write short, plain-language explanations of automated document checks for a human reviewer.',
      'The checks were already performed by deterministic rules; do not change, add or dispute any result.',
      'Do not state or imply that any document is genuine or fake.',
      'Write a 2-4 sentence summary of what the reviewer should look at first.',
      'Respond with JSON only.',
    ].join(' '),
    user: `Issues found by the rules:\n${list}`,
  };
}

export const explanationSchema = {
  type: 'object',
  properties: { summary: { type: 'string' } },
  required: ['summary'],
  additionalProperties: false,
};
