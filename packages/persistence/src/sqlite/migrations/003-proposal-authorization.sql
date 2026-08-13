CREATE TABLE IF NOT EXISTS proposal_versions (
  proposal_version_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  agent_id TEXT NOT NULL REFERENCES agents(agent_id),
  function_id TEXT NOT NULL REFERENCES functions(function_id),
  objective TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  project_snapshot_version TEXT NOT NULL,
  agent_version TEXT NOT NULL,
  function_version TEXT NOT NULL,
  capability_version TEXT NOT NULL,
  baseline_commit TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  digest TEXT NOT NULL UNIQUE CHECK(digest GLOB 'sha256:[0-9a-f]*')
);
CREATE TRIGGER IF NOT EXISTS proposal_versions_immutable_update BEFORE UPDATE ON proposal_versions BEGIN SELECT RAISE(ABORT, 'ProposalVersion is immutable'); END;
CREATE TRIGGER IF NOT EXISTS proposal_versions_immutable_delete BEFORE DELETE ON proposal_versions BEGIN SELECT RAISE(ABORT, 'ProposalVersion is immutable'); END;

CREATE TABLE IF NOT EXISTS authorization_grants (
  grant_id TEXT PRIMARY KEY,
  proposal_version_id TEXT NOT NULL REFERENCES proposal_versions(proposal_version_id),
  proposal_digest TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ISSUED','CONSUMED','REVOKED','EXPIRED')),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE(actor_id, idempotency_key)
);
