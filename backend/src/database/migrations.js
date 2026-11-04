/**
 * Database schema. Each migration runs once and is recorded in schema_migrations.
 */
const migrations = [
  {
    id: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE users (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('submitter', 'reviewer', 'admin')),
        is_active     INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE document_types (
        key         TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        fields      TEXT NOT NULL DEFAULT '[]',
        rules       TEXT NOT NULL DEFAULT '[]',
        is_active   INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE cases (
        id                   TEXT PRIMARY KEY,
        reference            TEXT NOT NULL UNIQUE,
        title                TEXT NOT NULL,
        applicant_name       TEXT NOT NULL,
        applicant_dob        TEXT,
        applicant_details    TEXT NOT NULL DEFAULT '{}',
        submitter_id         TEXT NOT NULL REFERENCES users(id),
        assigned_reviewer_id TEXT REFERENCES users(id),
        status               TEXT NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open', 'submitted', 'approved', 'rejected', 'correction_requested')),
        preliminary_status   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (preliminary_status IN ('pending', 'processing', 'passed', 'flagged')),
        issue_summary        TEXT,
        submitted_at         TEXT,
        decided_at           TEXT,
        created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX idx_cases_submitter ON cases(submitter_id);
      CREATE INDEX idx_cases_status ON cases(status);

      CREATE TABLE documents (
        id                        TEXT PRIMARY KEY,
        case_id                   TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        uploaded_by               TEXT NOT NULL REFERENCES users(id),
        original_name             TEXT NOT NULL,
        stored_name               TEXT NOT NULL UNIQUE,
        mime_type                 TEXT NOT NULL,
        size_bytes                INTEGER NOT NULL,
        sha256                    TEXT NOT NULL,
        page_count                INTEGER,
        status                    TEXT NOT NULL DEFAULT 'uploaded'
                                  CHECK (status IN ('uploaded', 'text_extracted', 'fields_extracted',
                                                    'passed', 'flagged', 'processing_failed')),
        document_type             TEXT REFERENCES document_types(key),
        classification_confidence REAL,
        extraction_method         TEXT CHECK (extraction_method IN ('text_layer', 'ocr')),
        ocr_confidence            REAL,
        raw_text                  TEXT,
        llm_model                 TEXT,
        needs_manual_entry        INTEGER NOT NULL DEFAULT 0,
        error_message             TEXT,
        timings                   TEXT NOT NULL DEFAULT '{}',
        created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX idx_documents_case ON documents(case_id);

      -- Every change to extracted data creates a new version; originals are never overwritten.
      CREATE TABLE extracted_fields (
        id          TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        version     INTEGER NOT NULL,
        data        TEXT NOT NULL,
        source      TEXT NOT NULL CHECK (source IN ('llm', 'reviewer', 'manual')),
        created_by  TEXT REFERENCES users(id),
        note        TEXT,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (document_id, version)
      );

      CREATE TABLE validation_results (
        id          TEXT PRIMARY KEY,
        case_id     TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
        scope       TEXT NOT NULL CHECK (scope IN ('document', 'case')),
        rule        TEXT NOT NULL,
        field       TEXT,
        severity    TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
        passed      INTEGER NOT NULL,
        message     TEXT NOT NULL,
        details     TEXT NOT NULL DEFAULT '{}',
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX idx_validation_case ON validation_results(case_id);

      CREATE TABLE review_decisions (
        id          TEXT PRIMARY KEY,
        case_id     TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        reviewer_id TEXT NOT NULL REFERENCES users(id),
        decision    TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'correction_requested')),
        comment     TEXT,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      -- Append-only audit log: triggers below block updates and deletes.
      CREATE TABLE audit_logs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     TEXT,
        user_email  TEXT,
        action      TEXT NOT NULL,
        entity_type TEXT,
        entity_id   TEXT,
        details     TEXT NOT NULL DEFAULT '{}',
        ip_address  TEXT,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX idx_audit_created ON audit_logs(created_at);

      CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs
      BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;
      CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs
      BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;

      -- Background job queue (replaces Redis / pg-boss for a single-machine setup).
      CREATE TABLE jobs (
        id           TEXT PRIMARY KEY,
        type         TEXT NOT NULL,
        payload      TEXT NOT NULL DEFAULT '{}',
        status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
        attempts     INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 4,
        run_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_error   TEXT,
        created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX idx_jobs_pick ON jobs(status, run_at);

      CREATE TABLE counters (
        name  TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      );
    `,
  },
];

export function runMigrations(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);

  const applied = new Set(db.prepare('SELECT id FROM schema_migrations').all().map((r) => r.id));
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (id, name) VALUES (?, ?)').run(m.id, m.name);
    })();
  }
}
