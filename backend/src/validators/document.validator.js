import { z } from 'zod';
import { booleanish } from './common.validator.js';

const fieldValue = z.union([
  z.string().max(5000), z.number(), z.null(),
  z.array(z.record(z.string(), z.union([z.string().max(1000), z.number(), z.null()]))).max(200),
]);

export const correctFieldsSchema = z.object({
  documentType: z.string().trim().min(1).max(60).optional(),
  fields: z.record(z.string().max(60), fieldValue),
  note: z.string().trim().max(1000).optional(),
});

export const reprocessSchema = z.object({ fromScratch: z.boolean().optional().default(false) });
export const revealQuery = z.object({ reveal: booleanish.optional().default(false) });
export const fileTokenParam = z.object({ token: z.string().min(20).max(2000) });
