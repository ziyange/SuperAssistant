CREATE TABLE IF NOT EXISTS activity_history (
  activity_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK(sequence > 0),
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  UNIQUE(attempt_id, sequence)
);
CREATE TRIGGER IF NOT EXISTS activity_history_append_only BEFORE UPDATE ON activity_history BEGIN SELECT RAISE(ABORT, 'activity history is append-only'); END;
CREATE TRIGGER IF NOT EXISTS activity_history_no_delete BEFORE DELETE ON activity_history BEGIN SELECT RAISE(ABORT, 'activity history is append-only'); END;

CREATE TABLE IF NOT EXISTS human_history (
  history_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  decision_id TEXT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('PROPOSAL_CONFIRMED', 'DECISION_RESOLVED')),
  source_version TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS human_history_append_only BEFORE UPDATE ON human_history BEGIN SELECT RAISE(ABORT, 'human history is append-only'); END;
CREATE TRIGGER IF NOT EXISTS human_history_no_delete BEFORE DELETE ON human_history BEGIN SELECT RAISE(ABORT, 'human history is append-only'); END;

CREATE TABLE IF NOT EXISTS project_changes (
  change_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  authorization_grant_id TEXT NOT NULL,
  resource_key TEXT NOT NULL,
  baseline_revision TEXT NOT NULL,
  result_revision TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('APPLIED', 'FAILED', 'UNKNOWN')),
  original_change_id TEXT REFERENCES project_changes(change_id),
  created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS project_changes_append_only BEFORE UPDATE ON project_changes BEGIN SELECT RAISE(ABORT, 'project changes are append-only'); END;
CREATE TRIGGER IF NOT EXISTS project_changes_no_delete BEFORE DELETE ON project_changes BEGIN SELECT RAISE(ABORT, 'project changes are append-only'); END;
