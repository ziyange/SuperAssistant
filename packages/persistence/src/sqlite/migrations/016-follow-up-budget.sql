CREATE TABLE follow_up_budget_decisions (
  decision_id TEXT PRIMARY KEY,
  correlation_key TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('COOLDOWN', 'CONCURRENCY', 'BUDGET')),
  created_at TEXT NOT NULL
);

CREATE INDEX follow_up_budget_decisions_by_correlation
  ON follow_up_budget_decisions(correlation_key, created_at);

CREATE TRIGGER follow_up_budget_decisions_immutable
BEFORE UPDATE ON follow_up_budget_decisions
BEGIN
  SELECT RAISE(ABORT, 'follow-up budget decisions are immutable');
END;

CREATE TRIGGER follow_up_budget_decisions_no_delete
BEFORE DELETE ON follow_up_budget_decisions
BEGIN
  SELECT RAISE(ABORT, 'follow-up budget decisions are immutable');
END;
