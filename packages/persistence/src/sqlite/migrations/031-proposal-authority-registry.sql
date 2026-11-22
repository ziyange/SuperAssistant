-- Identity-only registry. This migration never creates a Grant or Task.
CREATE TABLE proposal_authority_refs (
  proposal_version_id TEXT NOT NULL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  source_kind TEXT NOT NULL CHECK(source_kind IN ('LEGACY','PROTECTED')),
  binding_version INTEGER NOT NULL CHECK(binding_version = 1),
  created_at TEXT NOT NULL,
  UNIQUE(proposal_version_id, source_kind, workspace_id, project_id, binding_version)
);

CREATE TRIGGER proposal_authority_refs_validate BEFORE INSERT ON proposal_authority_refs
WHEN NOT EXISTS (
  SELECT 1 FROM projects p WHERE p.project_id=NEW.project_id AND p.workspace_id=NEW.workspace_id
) OR EXISTS (
  SELECT 1 FROM proposal_authority_refs r WHERE r.proposal_version_id=NEW.proposal_version_id
) OR (NEW.source_kind='LEGACY' AND NOT EXISTS (
  SELECT 1 FROM proposal_versions p WHERE p.proposal_version_id=NEW.proposal_version_id
    AND p.workspace_id=NEW.workspace_id AND p.project_id=NEW.project_id
)) OR (NEW.source_kind='PROTECTED' AND EXISTS (
  SELECT 1 FROM proposal_versions p WHERE p.proposal_version_id=NEW.proposal_version_id
))
BEGIN SELECT RAISE(ABORT, 'Proposal authority identity rejected'); END;

INSERT INTO proposal_authority_refs (proposal_version_id,workspace_id,project_id,source_kind,binding_version,created_at)
SELECT proposal_version_id,workspace_id,project_id,'LEGACY',1,created_at FROM proposal_versions;

CREATE TRIGGER proposal_authority_refs_immutable_update BEFORE UPDATE ON proposal_authority_refs
BEGIN SELECT RAISE(ABORT, 'Proposal authority identity is immutable'); END;
CREATE TRIGGER proposal_authority_refs_immutable_delete BEFORE DELETE ON proposal_authority_refs
BEGIN SELECT RAISE(ABORT, 'Proposal authority identity is immutable'); END;

CREATE TRIGGER proposal_authority_project_scope_immutable BEFORE UPDATE OF workspace_id ON projects
WHEN NEW.workspace_id<>OLD.workspace_id AND EXISTS (
  SELECT 1 FROM proposal_authority_refs r WHERE r.project_id=OLD.project_id
)
BEGIN SELECT RAISE(ABORT, 'Project with Proposal identities cannot change Workspace'); END;

-- REPLACE deletes conflicting rows without necessarily firing delete triggers.
-- Reject both primary-key and scoped canonical-key replacements of referenced Projects.
CREATE TRIGGER proposal_authority_project_no_replace BEFORE INSERT ON projects
WHEN EXISTS (
  SELECT 1 FROM projects p JOIN proposal_authority_refs r ON r.project_id=p.project_id
  WHERE p.project_id=NEW.project_id OR (p.workspace_id=NEW.workspace_id AND p.canonical_key=NEW.canonical_key)
)
BEGIN SELECT RAISE(ABORT, 'Referenced Project cannot be replaced'); END;

-- REPLACE by either primary ID or unique digest must never erase legacy history.
CREATE TRIGGER proposal_versions_no_conflict_replace BEFORE INSERT ON proposal_versions
WHEN EXISTS (
  SELECT 1 FROM proposal_versions p WHERE p.proposal_version_id=NEW.proposal_version_id OR p.digest=NEW.digest
)
BEGIN SELECT RAISE(ABORT, 'Existing Proposal cannot be replaced'); END;

CREATE TRIGGER proposal_versions_register_authority AFTER INSERT ON proposal_versions
BEGIN
  INSERT INTO proposal_authority_refs (proposal_version_id,workspace_id,project_id,source_kind,binding_version,created_at)
  VALUES (NEW.proposal_version_id,NEW.workspace_id,NEW.project_id,'LEGACY',1,NEW.created_at);
END;

CREATE TABLE protected_proposal_bindings (
  proposal_version_id TEXT NOT NULL PRIMARY KEY,
  source_kind TEXT NOT NULL CHECK(source_kind='PROTECTED'),
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  payload_record_id TEXT NOT NULL UNIQUE REFERENCES protected_payloads(record_id),
  key_ref TEXT NOT NULL,
  content_kind TEXT NOT NULL CHECK(content_kind='PROPOSAL'),
  binding_version INTEGER NOT NULL CHECK(binding_version=1),
  digest_profile TEXT NOT NULL CHECK(digest_profile='SAI_PROPOSAL_SHA256_V1'),
  CHECK(proposal_version_id=payload_record_id),
  FOREIGN KEY(proposal_version_id,source_kind,workspace_id,project_id,binding_version)
    REFERENCES proposal_authority_refs(proposal_version_id,source_kind,workspace_id,project_id,binding_version)
);

CREATE TRIGGER protected_proposal_bindings_validate BEFORE INSERT ON protected_proposal_bindings
WHEN EXISTS (SELECT 1 FROM protected_proposal_bindings b WHERE b.proposal_version_id=NEW.proposal_version_id OR b.payload_record_id=NEW.payload_record_id)
 OR NOT EXISTS (
  SELECT 1 FROM protected_payloads p JOIN protected_key_reservations r
    ON r.record_id=p.record_id AND r.workspace_id=p.workspace_id AND r.project_id=p.project_id AND r.key_ref=p.key_ref
  WHERE p.record_id=NEW.payload_record_id AND p.workspace_id=NEW.workspace_id AND p.project_id=NEW.project_id
    AND p.key_ref=NEW.key_ref AND p.content_kind=NEW.content_kind AND r.state='LINKED'
)
BEGIN SELECT RAISE(ABORT, 'Protected Proposal binding rejected'); END;

CREATE TRIGGER protected_proposal_bindings_immutable_update BEFORE UPDATE ON protected_proposal_bindings
BEGIN SELECT RAISE(ABORT, 'Protected Proposal binding is immutable'); END;
CREATE TRIGGER protected_proposal_bindings_immutable_delete BEFORE DELETE ON protected_proposal_bindings
BEGIN SELECT RAISE(ABORT, 'Protected Proposal binding is immutable'); END;

CREATE TRIGGER protected_binding_reservation_stays_linked BEFORE UPDATE OF state ON protected_key_reservations
WHEN OLD.state='LINKED' AND NEW.state<>'LINKED' AND EXISTS (
  SELECT 1 FROM protected_proposal_bindings b WHERE b.payload_record_id=OLD.record_id
)
BEGIN SELECT RAISE(ABORT, 'Bound reservation cannot regress'); END;
