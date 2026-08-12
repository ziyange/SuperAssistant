CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','LOCKED','ARCHIVED')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, row_version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  name TEXT NOT NULL, agent_version TEXT NOT NULL, connection TEXT NOT NULL CHECK(connection IN ('CONNECTED','AUTH_REQUIRED','UNAVAILABLE','DISABLED')),
  availability TEXT NOT NULL CHECK(availability IN ('AVAILABLE','SATURATED','PAUSED','ERROR')),
  credential_ref TEXT, row_version INTEGER NOT NULL DEFAULT 1,
  CHECK(connection = 'CONNECTED' OR availability <> 'AVAILABLE')
);
CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  name TEXT NOT NULL, canonical_path TEXT NOT NULL, canonical_key TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('INITIALIZING','ACTIVE','PAUSED','ARCHIVED','ERROR')),
  default_agent_id TEXT REFERENCES agents(agent_id), snapshot_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, row_version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(workspace_id, canonical_key)
);
CREATE TABLE IF NOT EXISTS functions (
  function_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(agent_id), name TEXT NOT NULL,
  function_version TEXT NOT NULL, lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','DEPRECATED','DISABLED','INCOMPATIBLE')),
  UNIQUE(agent_id, name, function_version)
);
CREATE TABLE IF NOT EXISTS version_references (
  reference_id TEXT PRIMARY KEY, owner_kind TEXT NOT NULL CHECK(owner_kind IN ('AGENT','FUNCTION','TEMPLATE','PROTOCOL','SNAPSHOT')),
  owner_id TEXT NOT NULL, version TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(owner_kind, owner_id, version)
);
