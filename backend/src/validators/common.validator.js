import { z } from 'zod';
import { normalizeDate, todayIso } from '../utils/dates.js';

export const idParam = z.object({ id: z.string().uuid('Invalid id') });

export const pagination = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
};

/** Accepts common date formats and stores them as YYYY-MM-DD. */
export const dateString = z.string().trim().transform((v, ctx) => {
  const d = normalizeDate(v);
  if (!d) { ctx.addIssue({ code: 'custom', message: 'Enter a valid date' }); return z.NEVER; }
  return d;
});

export const pastDate = dateString.refine((d) => d <= todayIso(), 'Date cannot be in the future');

export const booleanish = z.union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');
