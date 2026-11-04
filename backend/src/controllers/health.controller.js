import env from '../config/env.js';
import { getLlmClient } from '../services/llm/index.js';
import { jobRepository } from '../repositories/job.repository.js';

export const healthController = {
  check(_req, res) {
    const llm = getLlmClient();
    res.json({
      success: true,
      data: {
        status: 'ok',
        time: new Date().toISOString(),
        llm: { provider: llm.name, model: llm.modelId },
        jobs: Object.fromEntries(jobRepository.counts().map((r) => [r.status, r.n])),
        limits: { maxFileSizeMb: env.maxFileSizeBytes / 1024 / 1024, maxFilesPerUpload: env.maxFilesPerUpload },
      },
    });
  },
};
