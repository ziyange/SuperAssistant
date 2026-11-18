CREATE TABLE proposal_candidate_drafts (
  draft_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  payload_json TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL
);
CREATE TRIGGER proposal_candidate_drafts_immutable_update BEFORE UPDATE ON proposal_candidate_drafts BEGIN SELECT RAISE(ABORT, 'Proposal draft is immutable'); END;
CREATE TRIGGER proposal_candidate_drafts_immutable_delete BEFORE DELETE ON proposal_candidate_drafts BEGIN SELECT RAISE(ABORT, 'Proposal draft is immutable'); END;
