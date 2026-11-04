import env from './config/env.js';
import { createApp } from './app.js';
import { bootstrap } from './bootstrap.js';
import { startQueue, stopQueue } from './jobs/queue.js';
import { startRetentionSchedule, stopRetentionSchedule } from './jobs/retention.job.js';
import { shutdownOcr } from './services/ocr.service.js';
import { getLlmClient } from './services/llm/index.js';
import { closeDb } from './config/db.js';
import logger from './utils/logger.js';

await bootstrap();
startQueue();
startRetentionSchedule();

const app = createApp();
const server = app.listen(env.port, () => {
  const llm = getLlmClient();
  logger.info(`API running on http://localhost:${env.port}/api`, {
    storage: env.storageDir, llm: `${llm.name} (${llm.modelId})`,
  });
});

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close();
  stopRetentionSchedule();
  await stopQueue();
  await shutdownOcr();
  closeDb();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error('Unhandled promise rejection', { error: err?.message }));
