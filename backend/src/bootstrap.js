import { getDb } from './config/db.js';
import { documentTypeService } from './services/documentType.service.js';
import { userService } from './services/user.service.js';
import { storageService } from './services/storage.service.js';
import { registerDocumentJobs } from './jobs/document.jobs.js';

/** Prepares the database, storage folder, default data and job handlers. */
export async function bootstrap({ seedUsers = true } = {}) {
  getDb();
  await storageService.init();
  documentTypeService.seedDefaults();
  if (seedUsers) await userService.seedDemoUsers();
  registerDocumentJobs();
}
