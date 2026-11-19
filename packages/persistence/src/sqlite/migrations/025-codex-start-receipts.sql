CREATE TABLE codex_start_receipts (
  attempt_id TEXT NOT NULL PRIMARY KEY REFERENCES execution_attempts(attempt_id),
  proposal_digest TEXT NOT NULL,
  executable_path TEXT NOT NULL,
  binary_hash TEXT NOT NULL CHECK(length(binary_hash)=64 AND binary_hash NOT GLOB '*[^0-9a-f]*'),
  thread_id TEXT NOT NULL CHECK(length(thread_id) BETWEEN 1 AND 128 AND thread_id NOT GLOB '*[^A-Za-z0-9_-]*'),
  turn_id TEXT NOT NULL CHECK(length(turn_id) BETWEEN 1 AND 128 AND turn_id NOT GLOB '*[^A-Za-z0-9_-]*'),
  worktree_path TEXT NOT NULL,
  UNIQUE(thread_id,turn_id)
);
CREATE TRIGGER codex_receipts_no_update BEFORE UPDATE ON codex_start_receipts BEGIN SELECT RAISE(ABORT,'Immutable start receipt'); END;
CREATE TRIGGER codex_receipts_no_delete BEFORE DELETE ON codex_start_receipts BEGIN SELECT RAISE(ABORT,'Immutable start receipt'); END;
CREATE TRIGGER codex_receipts_no_replace BEFORE INSERT ON codex_start_receipts
WHEN EXISTS (SELECT 1 FROM codex_start_receipts WHERE attempt_id=NEW.attempt_id OR (thread_id=NEW.thread_id AND turn_id=NEW.turn_id))
BEGIN SELECT RAISE(ABORT,'Immutable start receipt'); END;
