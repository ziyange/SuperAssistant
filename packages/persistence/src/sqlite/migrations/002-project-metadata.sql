CREATE TABLE IF NOT EXISTS project_metadata (
  project_id TEXT PRIMARY KEY REFERENCES projects(project_id), repository TEXT,
  default_branch TEXT, technology TEXT, provenance TEXT NOT NULL CHECK(provenance IN ('DISCOVERED','USER'))
);
CREATE TABLE IF NOT EXISTS managed_worktrees (
  task_id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(project_id), path TEXT NOT NULL UNIQUE,
  branch TEXT NOT NULL UNIQUE, baseline_commit TEXT NOT NULL, resource_key TEXT NOT NULL UNIQUE,
  disposition TEXT NOT NULL CHECK(disposition IN ('ACTIVE','QUARANTINED')), created_at TEXT NOT NULL
);
