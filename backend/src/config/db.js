import fs from 'node:fs';
import Database from 'better-sqlite3';
import env from './env.js';
import { runMigrations } from '../database/migrations.js';

let db;

/**
 * Returns the single SQLite connection used by the whole app.
 * The database file lives in STORAGE_DIR, so no external database server is needed.
 */
export function getDb() {
  if (db) return db;

  if (env.dbFile !== ':memory:') {
    fs.mkdirSync(env.storageDir, { recursive: true });
  }

  db = new Database(env.dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  runMigrations(db);
  return db;
}

/** Runs fn inside a transaction and returns its result. */
export function transaction(fn) {
  return getDb().transaction(fn)();
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}
