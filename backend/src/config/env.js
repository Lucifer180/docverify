import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const nodeEnv = process.env.NODE_ENV || 'development';
const storageDir = path.resolve(process.env.STORAGE_DIR || './storage');

const grokApiKey = process.env.GROK_API_KEY || '';
let llmProvider = (process.env.LLM_PROVIDER || 'grok').toLowerCase();
if (llmProvider === 'grok' && !grokApiKey) {
  // Fall back to the offline extractor so the app still works without a key.
  llmProvider = 'mock';
}

const env = Object.freeze({
  nodeEnv,
  isTest: nodeEnv === 'test',
  isProduction: nodeEnv === 'production',
  port: num(process.env.PORT, 5000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  jwtSecret: process.env.JWT_SECRET || (nodeEnv === 'production' ? '' : 'dev-only-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  fileLinkExpiresIn: process.env.FILE_LINK_EXPIRES_IN || '5m',
  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 10),

  storageDir,
  uploadDir: path.join(storageDir, 'uploads'),
  dbFile: nodeEnv === 'test' ? ':memory:' : path.join(storageDir, 'docverify.sqlite'),
  ocrCacheDir: path.join(storageDir, 'ocr-cache'),
  maxFileSizeBytes: num(process.env.MAX_FILE_SIZE_MB, 10) * 1024 * 1024,
  maxFilesPerUpload: num(process.env.MAX_FILES_PER_UPLOAD, 10),
  documentRetentionDays: num(process.env.DOCUMENT_RETENTION_DAYS, 365),

  llmProvider,
  grokApiKey,
  grokBaseUrl: (process.env.GROK_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, ''),
  grokModel: process.env.GROK_MODEL || 'grok-4-1-fast-non-reasoning',
  llmTimeoutMs: num(process.env.LLM_TIMEOUT_MS, 60000),
  llmMaxInputChars: num(process.env.LLM_MAX_INPUT_CHARS, 12000),

  ocrLanguage: process.env.OCR_LANGUAGE || 'eng',
  ocrLowConfidence: num(process.env.OCR_LOW_CONFIDENCE, 60),
  pdfMinTextCharsPerPage: num(process.env.PDF_MIN_TEXT_CHARS_PER_PAGE, 30),
  pdfMaxPages: num(process.env.PDF_MAX_PAGES, 10),

  jobConcurrency: num(process.env.JOB_CONCURRENCY, 2),
  jobMaxAttempts: num(process.env.JOB_MAX_ATTEMPTS, 4),
  jobPollIntervalMs: num(process.env.JOB_POLL_INTERVAL_MS, 1000),
});

if (!env.jwtSecret) {
  throw new Error('JWT_SECRET must be set in production');
}

export default env;
