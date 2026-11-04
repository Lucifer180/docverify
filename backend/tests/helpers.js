import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { bootstrap } from '../src/bootstrap.js';
import { createApp } from '../src/app.js';
import { drainQueue } from '../src/jobs/queue.js';
import { shutdownOcr } from '../src/services/ocr.service.js';
import { closeDb } from '../src/config/db.js';
import env from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SAMPLES = path.join(__dirname, 'fixtures/samples');

export async function setup() {
  await bootstrap();
  return createApp();
}

export async function teardown() {
  await shutdownOcr();
  closeDb();
  await fs.rm(env.storageDir, { recursive: true, force: true });
}

export async function login(app, email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.token;
}

export const accounts = {
  admin: ['admin@docverify.local', 'Admin@123'],
  reviewer: ['reviewer@docverify.local', 'Reviewer@123'],
  submitter: ['submitter@docverify.local', 'Submitter@123'],
};

export { drainQueue };
