import crypto from 'node:crypto';

export const newId = () => crypto.randomUUID();
export const randomToken = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');
export const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
export const nowIso = () => new Date().toISOString();
