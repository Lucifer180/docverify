import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
    pool: 'forks',
    env: {
      NODE_ENV: 'test',
      LLM_PROVIDER: 'mock',
      JWT_SECRET: 'test-secret',
      BCRYPT_ROUNDS: '4',
      JOB_MAX_ATTEMPTS: '2',
      STORAGE_DIR: path.join(os.tmpdir(), `docverify-test-${process.pid}`),
    },
  },
});
