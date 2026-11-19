CREATE TABLE proposal_full_reviews (
  proposal_version_id TEXT PRIMARY KEY REFERENCES proposal_versions(proposal_version_id),
  payload_json TEXT NOT NULL
);
CREATE TRIGGER proposal_full_reviews_immutable_update BEFORE UPDATE ON proposal_full_reviews BEGIN SELECT RAISE(ABORT, 'Full Proposal review is immutable'); END;
CREATE TRIGGER proposal_full_reviews_immutable_delete BEFORE DELETE ON proposal_full_reviews BEGIN SELECT RAISE(ABORT, 'Full Proposal review is immutable'); END;
CREATE TRIGGER proposal_full_reviews_immutable_insert BEFORE INSERT ON proposal_full_reviews
WHEN EXISTS (SELECT 1 FROM proposal_full_reviews WHERE proposal_version_id = NEW.proposal_version_id)
BEGIN SELECT RAISE(ABORT, 'Full Proposal review is immutable'); END;

CREATE TABLE fixture_attempt_correlations (
  attempt_id TEXT PRIMARY KEY REFERENCES execution_attempts(attempt_id),
  thread_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  UNIQUE (thread_id, turn_id)
);
CREATE TRIGGER fixture_attempt_correlations_immutable_update BEFORE UPDATE ON fixture_attempt_correlations BEGIN SELECT RAISE(ABORT, 'Attempt correlation is immutable'); END;
CREATE TRIGGER fixture_attempt_correlations_immutable_delete BEFORE DELETE ON fixture_attempt_correlations BEGIN SELECT RAISE(ABORT, 'Attempt correlation is immutable'); END;
CREATE TRIGGER fixture_attempt_correlations_immutable_insert BEFORE INSERT ON fixture_attempt_correlations
WHEN EXISTS (SELECT 1 FROM fixture_attempt_correlations WHERE attempt_id = NEW.attempt_id OR (thread_id = NEW.thread_id AND turn_id = NEW.turn_id))
BEGIN SELECT RAISE(ABORT, 'Attempt correlation is immutable'); END;
