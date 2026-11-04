import { z } from 'zod';
import { pagination } from './common.validator.js';

export const listAuditQuery = z.object({
  action: z.string().trim().max(60).optional(),
  entityType: z.string().trim().max(30).optional(),
  entityId: z.string().trim().max(60).optional(),
  userId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
  to: z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
  ...pagination,
});
