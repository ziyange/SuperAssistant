CREATE TABLE IF NOT EXISTS artifact_versions (
  artifact_version_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(task_id),
  work_item_id TEXT NOT NULL REFERENCES work_items(work_item_id),
  attempt_id TEXT NOT NULL REFERENCES execution_attempts(attempt_id),
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  baseline_commit TEXT NOT NULL,
  authorization_grant_id TEXT NOT NULL REFERENCES authorization_grants(grant_id),
  logical_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK(byte_size >= 0),
  checksum TEXT NOT NULL CHECK(checksum GLOB 'sha256:[0-9a-f]*'),
  storage_ref TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS artifact_versions_task_created ON artifact_versions(task_id, created_at, artifact_version_id);
CREATE TRIGGER IF NOT EXISTS artifact_versions_immutable_update BEFORE UPDATE ON artifact_versions BEGIN SELECT RAISE(ABORT, 'ArtifactVersion is immutable'); END;
CREATE TRIGGER IF NOT EXISTS artifact_versions_immutable_delete BEFORE DELETE ON artifact_versions BEGIN SELECT RAISE(ABORT, 'ArtifactVersion is immutable'); END;
