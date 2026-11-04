import { z } from 'zod';
import { ROLE_LIST } from '../models/user.model.js';
import { pagination } from './common.validator.js';

export const password = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const email = z.string().trim().toLowerCase().email('Enter a valid email').max(254);
export const name = z.string().trim().min(2, 'Name is too short').max(100);

export const registerSchema = z.object({ name, email, password });
export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required').max(128) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });

export const createUserSchema = z.object({ name, email, password, role: z.enum(ROLE_LIST) });
export const updateUserSchema = z.object({
  name: name.optional(),
  role: z.enum(ROLE_LIST).optional(),
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const listUsersQuery = z.object({
  role: z.enum(ROLE_LIST).optional(),
  search: z.string().trim().max(100).optional(),
  ...pagination,
});
