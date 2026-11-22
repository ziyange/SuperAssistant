-- Only the controlled runner may execute this migration with foreign keys disabled
-- inside its exclusive, backed-up transaction.
CREATE TEMP TABLE sa_rebuild_guard (ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO sa_rebuild_guard
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM authorization_grants g
  LEFT JOIN proposal_authority_refs r ON r.proposal_version_id=g.proposal_version_id
  LEFT JOIN proposal_versions p ON p.proposal_version_id=g.proposal_version_id
  WHERE g.grant_id IS NULL OR r.proposal_version_id IS NULL OR r.source_kind<>'LEGACY'
    OR p.proposal_version_id IS NULL OR p.workspace_id<>r.workspace_id OR p.project_id<>r.project_id
    OR g.proposal_digest<>p.digest
) OR EXISTS (
  SELECT 1 FROM tasks t
  LEFT JOIN proposal_authority_refs r ON r.proposal_version_id=t.proposal_version_id
  LEFT JOIN authorization_grants g ON g.grant_id=t.authorization_grant_id
  WHERE t.task_id IS NULL OR r.proposal_version_id IS NULL OR r.source_kind<>'LEGACY'
    OR t.workspace_id<>r.workspace_id OR t.project_id<>r.project_id
    OR g.grant_id IS NULL OR g.proposal_version_id<>t.proposal_version_id
) OR EXISTS (
  SELECT 1 FROM tasks GROUP BY authorization_grant_id HAVING COUNT(*)>1
) THEN 0 ELSE 1 END;
DROP TABLE sa_rebuild_guard;

CREATE TABLE authorization_grants_new (
  grant_id TEXT PRIMARY KEY,
  proposal_version_id TEXT NOT NULL REFERENCES proposal_authority_refs(proposal_version_id),
  proposal_digest TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ISSUED','CONSUMED','REVOKED','EXPIRED')),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE(actor_id, idempotency_key)
);
INSERT INTO authorization_grants_new
  (rowid,grant_id,proposal_version_id,proposal_digest,actor_id,idempotency_key,actions_json,status,issued_at,expires_at)
SELECT rowid,grant_id,proposal_version_id,proposal_digest,actor_id,idempotency_key,actions_json,status,issued_at,expires_at
FROM authorization_grants;
DROP TABLE authorization_grants;
ALTER TABLE authorization_grants_new RENAME TO authorization_grants;
CREATE UNIQUE INDEX authorization_grants_one_issued_per_proposal
ON authorization_grants(actor_id, proposal_version_id) WHERE status='ISSUED';

CREATE TABLE tasks_new (
  task_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  proposal_version_id TEXT NOT NULL REFERENCES proposal_authority_refs(proposal_version_id),
  authorization_grant_id TEXT NOT NULL REFERENCES authorization_grants(grant_id),
  state TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO tasks_new (rowid,task_id,workspace_id,project_id,proposal_version_id,authorization_grant_id,state,created_at)
SELECT rowid,task_id,workspace_id,project_id,proposal_version_id,authorization_grant_id,state,created_at FROM tasks;
DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;
CREATE UNIQUE INDEX tasks_one_per_authorization_grant ON tasks(authorization_grant_id);

CREATE TRIGGER grants_legacy_authority_insert BEFORE INSERT ON authorization_grants
WHEN NOT EXISTS (
  SELECT 1 FROM proposal_authority_refs r JOIN proposal_versions p ON p.proposal_version_id=r.proposal_version_id
  WHERE r.proposal_version_id=NEW.proposal_version_id AND r.source_kind='LEGACY'
    AND p.workspace_id=r.workspace_id AND p.project_id=r.project_id AND p.digest=NEW.proposal_digest
)
BEGIN SELECT RAISE(ABORT, 'Protected Proposal grant issuer is not available'); END;

CREATE TRIGGER grants_legacy_authority_update BEFORE UPDATE OF proposal_version_id,proposal_digest ON authorization_grants
WHEN NOT EXISTS (
  SELECT 1 FROM proposal_authority_refs r JOIN proposal_versions p ON p.proposal_version_id=r.proposal_version_id
  WHERE r.proposal_version_id=NEW.proposal_version_id AND r.source_kind='LEGACY'
    AND p.workspace_id=r.workspace_id AND p.project_id=r.project_id AND p.digest=NEW.proposal_digest
)
BEGIN SELECT RAISE(ABORT, 'Protected Proposal grant issuer is not available'); END;

CREATE TRIGGER tasks_legacy_authority_insert BEFORE INSERT ON tasks
WHEN NOT EXISTS (
  SELECT 1 FROM proposal_authority_refs r JOIN proposal_versions p ON p.proposal_version_id=r.proposal_version_id
  JOIN authorization_grants g ON g.grant_id=NEW.authorization_grant_id AND g.proposal_version_id=r.proposal_version_id
  WHERE r.proposal_version_id=NEW.proposal_version_id AND r.source_kind='LEGACY'
    AND r.workspace_id=NEW.workspace_id AND r.project_id=NEW.project_id
    AND p.workspace_id=r.workspace_id AND p.project_id=r.project_id
)
BEGIN SELECT RAISE(ABORT, 'Protected Proposal task issuer is not available'); END;

CREATE TRIGGER tasks_legacy_authority_update BEFORE UPDATE OF workspace_id,project_id,proposal_version_id,authorization_grant_id ON tasks
WHEN NOT EXISTS (
  SELECT 1 FROM proposal_authority_refs r JOIN proposal_versions p ON p.proposal_version_id=r.proposal_version_id
  JOIN authorization_grants g ON g.grant_id=NEW.authorization_grant_id AND g.proposal_version_id=r.proposal_version_id
  WHERE r.proposal_version_id=NEW.proposal_version_id AND r.source_kind='LEGACY'
    AND r.workspace_id=NEW.workspace_id AND r.project_id=NEW.project_id
    AND p.workspace_id=r.workspace_id AND p.project_id=r.project_id
)
BEGIN SELECT RAISE(ABORT, 'Protected Proposal task issuer is not available'); END;
