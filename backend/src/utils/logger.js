import env from '../config/env.js';
import { redactText } from './mask.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = env.isTest ? LEVELS.error : env.isProduction ? LEVELS.info : LEVELS.debug;

const SECRET_KEYS = /pass(word)?|token|secret|authorization|api[_-]?key|raw_text|document_number/i;

function sanitize(value, depth = 0) {
  if (depth > 4) return '[…]';
  if (typeof value === 'string') return redactText(value);
  if (value instanceof Error) return { name: value.name, message: redactText(value.message) };
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.test(k) ? '[REDACTED]' : sanitize(v, depth + 1)]),
    );
  }
  return value;
}

function log(level, message, meta) {
  if (LEVELS[level] < minLevel) return;
  const line = { time: new Date().toISOString(), level, message: redactText(message) };
  if (meta !== undefined) line.meta = sanitize(meta);
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  out(JSON.stringify(line));
}

const logger = {
  debug: (m, meta) => log('debug', m, meta),
  info: (m, meta) => log('info', m, meta),
  warn: (m, meta) => log('warn', m, meta),
  error: (m, meta) => log('error', m, meta),
};

export default logger;
