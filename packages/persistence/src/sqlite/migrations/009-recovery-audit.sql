CREATE TABLE IF NOT EXISTS audit_exports (
  export_id TEXT PRIMARY KEY,
  scope_workspace_id TEXT NOT NULL,
  scope_project_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  checksum TEXT NOT NULL UNIQUE,
  record_count INTEGER NOT NULL,
  records_json TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS audit_exports_append_only BEFORE UPDATE ON audit_exports BEGIN SELECT RAISE(ABORT, 'audit exports are immutable'); END;
CREATE TRIGGER IF NOT EXISTS audit_exports_no_delete BEFORE DELETE ON audit_exports BEGIN SELECT RAISE(ABORT, 'audit exports are immutable'); END;
