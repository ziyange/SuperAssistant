CREATE TABLE protected_payloads (
  record_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  content_kind TEXT NOT NULL CHECK(content_kind IN ('GOAL','PROPOSAL')),
  format_version INTEGER NOT NULL CHECK(format_version = 1),
  key_ref TEXT NOT NULL UNIQUE,
  nonce BLOB NOT NULL CHECK(typeof(nonce) = 'blob' AND length(nonce) = 12),
  ciphertext BLOB NOT NULL CHECK(typeof(ciphertext) = 'blob' AND length(ciphertext) BETWEEN 1 AND 65536),
  auth_tag BLOB NOT NULL CHECK(typeof(auth_tag) = 'blob' AND length(auth_tag) = 16),
  created_at TEXT NOT NULL
);
CREATE TRIGGER protected_payloads_no_replace BEFORE INSERT ON protected_payloads
WHEN EXISTS (SELECT 1 FROM protected_payloads WHERE record_id = NEW.record_id OR key_ref = NEW.key_ref)
BEGIN SELECT RAISE(ABORT, 'protected payload already exists'); END;
CREATE TRIGGER protected_payloads_no_update BEFORE UPDATE ON protected_payloads
BEGIN SELECT RAISE(ABORT, 'protected payload is immutable'); END;
CREATE TRIGGER protected_payloads_no_delete BEFORE DELETE ON protected_payloads
BEGIN SELECT RAISE(ABORT, 'protected payload is immutable'); END;
