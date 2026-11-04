import { z } from 'zod';
import { pagination, pastDate, booleanish } from './common.validator.js';
import { CASE_STATUS, PRELIMINARY_STATUS } from '../models/case.model.js';
import { DECISIONS } from '../models/reviewDecision.model.js';

const details = z.record(z.string().max(50), z.string().max(500)).refine((o) => Object.keys(o).length <= 20, 'Too many details');

export const createCaseSchema = z.object({
  title: z.string().trim().min(3, 'Title is too short').max(150),
  applicantName: z.string().trim().min(2, 'Enter the applicant name').max(150),
  applicantDob: pastDate.optional().nullable(),
  applicantDetails: details.optional().default({}),
});

export const updateCaseSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  applicantName: z.string().trim().min(2).max(150).optional(),
  applicantDob: pastDate.optional().nullable(),
  applicantDetails: details.optional(),
}).refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const listCasesQuery = z.object({
  status: z.enum(Object.values(CASE_STATUS)).optional(),
  preliminaryStatus: z.enum(Object.values(PRELIMINARY_STATUS)).optional(),
  search: z.string().trim().max(100).optional(),
  mine: booleanish.optional(),
  ...pagination,
});

export const caseDetailQuery = z.object({ reveal: booleanish.optional().default(false) });

export const assignSchema = z.object({ reviewerId: z.string().uuid().nullable().optional() });

export const decisionSchema = z.object({
  decision: z.enum(Object.values(DECISIONS)),
  comment: z.string().trim().max(2000).optional(),
});

export const reportQuery = z.object({ format: z.enum(['html', 'json']).default('html') });
