CREATE TABLE IF NOT EXISTS acceptance_evidence (
  evidence_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  artifact_version_id TEXT NOT NULL,
  evaluator_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('ACCEPTED', 'REJECTED')),
  created_at TEXT NOT NULL,
  UNIQUE(artifact_version_id)
);
CREATE TRIGGER IF NOT EXISTS acceptance_evidence_append_only BEFORE UPDATE ON acceptance_evidence BEGIN SELECT RAISE(ABORT, 'acceptance evidence is immutable'); END;
CREATE TRIGGER IF NOT EXISTS acceptance_evidence_no_delete BEFORE DELETE ON acceptance_evidence BEGIN SELECT RAISE(ABORT, 'acceptance evidence is immutable'); END;
