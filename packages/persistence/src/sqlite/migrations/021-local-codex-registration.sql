CREATE TABLE IF NOT EXISTS local_codex_registrations (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(workspace_id),
  agent_id TEXT NOT NULL UNIQUE REFERENCES agents(agent_id),
  executable_path TEXT NOT NULL,
  observed_version TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
