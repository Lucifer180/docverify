import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import env from '../config/env.js';
import { randomToken } from '../utils/ids.js';
import ApiError from '../utils/ApiError.js';

/**
 * Stores uploaded files on this machine, outside any public web folder.
 * Files are renamed to random identifiers; the original name is only kept in the database.
 */
export const storageService = {
  async init() {
    await fs.mkdir(env.uploadDir, { recursive: true });
  },

  async save(buffer, extension) {
    await this.init();
    const storedName = `${randomToken(16)}${extension}`;
    await fs.writeFile(this.resolve(storedName), buffer, { flag: 'wx', mode: 0o600 });
    return storedName;
  },

  /** Resolves a stored name to a path, refusing anything that escapes the upload folder. */
  resolve(storedName) {
    if (!/^[a-f0-9]{32}\.(pdf|jpg|jpeg|png)$/.test(storedName)) throw ApiError.badRequest('Invalid file reference');
    const full = path.resolve(env.uploadDir, storedName);
    if (!full.startsWith(path.resolve(env.uploadDir) + path.sep)) throw ApiError.badRequest('Invalid file reference');
    return full;
  },

  exists(storedName) {
    try { return fsSync.existsSync(this.resolve(storedName)); } catch { return false; }
  },

  async remove(storedName) {
    try { await fs.unlink(this.resolve(storedName)); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  },
};
