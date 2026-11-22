CREATE TABLE draft_agent_generations (
  draft_id TEXT PRIMARY KEY REFERENCES proposal_candidate_drafts(draft_id),
  agent_id TEXT NOT NULL REFERENCES agents(agent_id),
  agent_row_version INTEGER NOT NULL CHECK(agent_row_version > 0)
);
CREATE TRIGGER draft_agent_generations_immutable_replace BEFORE INSERT ON draft_agent_generations WHEN EXISTS (SELECT 1 FROM draft_agent_generations WHERE draft_id = NEW.draft_id) BEGIN SELECT RAISE(ABORT, 'Draft Agent generation is immutable'); END;
CREATE TRIGGER draft_agent_generations_immutable_update BEFORE UPDATE ON draft_agent_generations BEGIN SELECT RAISE(ABORT, 'Draft Agent generation is immutable'); END;
CREATE TRIGGER draft_agent_generations_immutable_delete BEFORE DELETE ON draft_agent_generations BEGIN SELECT RAISE(ABORT, 'Draft Agent generation is immutable'); END;
