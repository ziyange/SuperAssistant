CREATE TABLE protected_key_reservations (
  record_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  key_ref TEXT NOT NULL UNIQUE,
  owner_hash TEXT NOT NULL CHECK(length(owner_hash) = 64),
  state TEXT NOT NULL CHECK(state IN ('RESERVED','STORED','UNCERTAIN','LINKED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TRIGGER protected_key_reservations_no_replace BEFORE INSERT ON protected_key_reservations
WHEN EXISTS (SELECT 1 FROM protected_key_reservations WHERE record_id = NEW.record_id OR key_ref = NEW.key_ref)
BEGIN SELECT RAISE(ABORT, 'protected key reservation already exists'); END;
CREATE TRIGGER protected_key_reservations_no_delete BEFORE DELETE ON protected_key_reservations
BEGIN SELECT RAISE(ABORT, 'protected key reservation is durable'); END;
CREATE TRIGGER protected_key_reservations_identity_immutable BEFORE UPDATE ON protected_key_reservations
WHEN OLD.record_id <> NEW.record_id OR OLD.workspace_id <> NEW.workspace_id OR OLD.project_id <> NEW.project_id
 OR OLD.key_ref <> NEW.key_ref OR OLD.owner_hash <> NEW.owner_hash OR OLD.created_at <> NEW.created_at
BEGIN SELECT RAISE(ABORT, 'protected key reservation identity is immutable'); END;
