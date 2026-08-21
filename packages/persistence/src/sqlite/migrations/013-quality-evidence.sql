CREATE TABLE IF NOT EXISTS quality_evidence (
  evidence_id INTEGER PRIMARY KEY,
  task_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL,
  executor_agent_id TEXT NOT NULL,
  evaluator_agent_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('TESTER','INSPECTOR')),
  outcome TEXT NOT NULL CHECK(outcome IN ('ACCEPTED','REJECTED')),
  CHECK(executor_agent_id <> evaluator_agent_id)
);
CREATE TRIGGER IF NOT EXISTS quality_evidence_immutable BEFORE UPDATE ON quality_evidence BEGIN SELECT RAISE(ABORT, 'quality evidence is immutable'); END;
