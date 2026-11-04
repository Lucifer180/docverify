import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

const common = { standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Too many requests, please try again later.' } };

export const apiLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: env.isTest ? 10000 : 1000 });
export const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: env.isTest ? 10000 : 20 });
export const uploadLimiter = rateLimit({ ...common, windowMs: 60 * 60 * 1000, limit: env.isTest ? 10000 : 100 });
