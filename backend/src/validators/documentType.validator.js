import { z } from 'zod';
import { FIELD_TYPES, COMPARE_KEYS, SUBMITTER_FIELDS } from '../models/documentType.model.js';
import { RULE_TYPES } from '../services/validation.service.js';

const key = z.string().trim().regex(/^[a-z][a-z0-9_]{1,59}$/, 'Use lowercase letters, numbers and underscores');

const regex = z.string().max(300).refine((p) => {
  try { new RegExp(p); return true; } catch { return false; }
}, 'Invalid regular expression');

const itemField = z.object({
  key, label: z.string().trim().min(1).max(80), type: z.enum(FIELD_TYPES.filter((t) => t !== 'array')),
});

const field = z.object({
  key,
  label: z.string().trim().min(1).max(80),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional().default(false),
  sensitive: z.boolean().optional().default(false),
  pattern: regex.optional(),
  patternMessage: z.string().max(200).optional(),
  compareAs: z.enum(COMPARE_KEYS).optional(),
  submitterField: z.enum(SUBMITTER_FIELDS).optional(),
  hint: z.string().max(300).optional(),
  itemFields: z.array(itemField).max(20).optional(),
}).strip();

const rule = z.object({
  id: z.string().trim().min(1).max(60),
  type: z.enum(RULE_TYPES),
  severity: z.enum(['error', 'warning', 'info']).default('error'),
  message: z.string().max(300).optional(),
  pattern: regex.optional(),
}).passthrough();

const fields = z.array(field).max(60).refine((arr) => new Set(arr.map((f) => f.key)).size === arr.length, 'Field keys must be unique');
const rules = z.array(rule).max(60).refine((arr) => new Set(arr.map((r) => r.id)).size === arr.length, 'Rule ids must be unique');

export const createDocumentTypeSchema = z.object({
  key,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  fields,
  rules: rules.default([]),
  isActive: z.boolean().optional().default(true),
});

export const updateDocumentTypeSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  fields: fields.optional(),
  rules: rules.optional(),
  isActive: z.boolean().optional(),
});

export const keyParam = z.object({ key });
