import multer from 'multer';
import env from '../config/env.js';

/**
 * Keeps uploads in memory (max size enforced) so the file content can be checked
 * before anything is written to disk. Real file type checks happen in document.service.
 */
export const uploadFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeBytes, files: env.maxFilesPerUpload, fields: 10, parts: env.maxFilesPerUpload + 10 },
}).array('files', env.maxFilesPerUpload);
