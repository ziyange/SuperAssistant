CREATE TABLE IF NOT EXISTS decisions (
  decision_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL,
  question TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('L3', 'L4')),
  fingerprint TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('OPEN', 'RESOLVED')),
  resolution_id TEXT,
  resolution_key TEXT,
  resolution_actor_id TEXT,
  resolution_option TEXT CHECK(resolution_option IN ('ALLOW', 'DENY')),
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  CHECK((status = 'OPEN' AND resolution_id IS NULL AND resolution_key IS NULL AND resolution_actor_id IS NULL AND resolution_option IS NULL AND resolved_at IS NULL) OR (status = 'RESOLVED' AND resolution_id IS NOT NULL AND resolution_key IS NOT NULL AND resolution_actor_id IS NOT NULL AND resolution_option IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE TRIGGER IF NOT EXISTS decisions_resolution_immutable BEFORE UPDATE ON decisions WHEN OLD.status = 'RESOLVED' BEGIN SELECT RAISE(ABORT, 'Decision is already resolved'); END;
