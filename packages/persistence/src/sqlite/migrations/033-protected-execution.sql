-- Protected approval metadata contains only identifiers and an envelope fingerprint.
-- It is not itself a credential, native approval or executable authority.
CREATE TABLE protected_execution_bindings (
  proposal_version_id TEXT NOT NULL PRIMARY KEY REFERENCES protected_proposal_bindings(proposal_version_id),
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  function_id TEXT NOT NULL,
  envelope_digest TEXT NOT NULL CHECK(length(envelope_digest)=71 AND substr(envelope_digest,1,7)='sha256:'),
  grant_id TEXT NOT NULL UNIQUE,
  task_id TEXT NOT NULL UNIQUE,
  work_item_id TEXT NOT NULL UNIQUE,
  attempt_id TEXT NOT NULL UNIQUE,
  lease_id TEXT NOT NULL UNIQUE,
  request_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TRIGGER protected_execution_binding_validate BEFORE INSERT ON protected_execution_bindings
WHEN EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.proposal_version_id=NEW.proposal_version_id
  OR b.grant_id=NEW.grant_id OR b.task_id=NEW.task_id OR b.work_item_id=NEW.work_item_id
  OR b.attempt_id=NEW.attempt_id OR b.lease_id=NEW.lease_id OR b.request_id=NEW.request_id)
 OR NOT EXISTS (SELECT 1 FROM protected_proposal_bindings b WHERE b.proposal_version_id=NEW.proposal_version_id
  AND b.workspace_id=NEW.workspace_id AND b.project_id=NEW.project_id)
BEGIN SELECT RAISE(ABORT, 'Protected execution binding rejected'); END;

CREATE TRIGGER protected_execution_binding_no_update BEFORE UPDATE ON protected_execution_bindings
BEGIN SELECT RAISE(ABORT, 'Protected execution binding is immutable'); END;
CREATE TRIGGER protected_execution_binding_no_delete BEFORE DELETE ON protected_execution_bindings
BEGIN SELECT RAISE(ABORT, 'Protected execution binding is immutable'); END;

-- Hashes only executable and Project identity, never Proposal/user content.
CREATE TABLE protected_execution_context (
  proposal_version_id TEXT NOT NULL PRIMARY KEY REFERENCES protected_execution_bindings(proposal_version_id),
  context_digest TEXT NOT NULL CHECK(length(context_digest)=71 AND substr(context_digest,1,7)='sha256:'),
  approval_tag TEXT NOT NULL CHECK(length(approval_tag)=76 AND substr(approval_tag,1,12)='hmac-sha256:')
);
CREATE TRIGGER protected_execution_context_no_replace BEFORE INSERT ON protected_execution_context
WHEN EXISTS (SELECT 1 FROM protected_execution_context c WHERE c.proposal_version_id=NEW.proposal_version_id)
BEGIN SELECT RAISE(ABORT, 'Protected execution context cannot be replaced'); END;
CREATE TRIGGER protected_execution_context_no_update BEFORE UPDATE ON protected_execution_context
BEGIN SELECT RAISE(ABORT, 'Protected execution context is immutable'); END;
CREATE TRIGGER protected_execution_context_no_delete BEFORE DELETE ON protected_execution_context
BEGIN SELECT RAISE(ABORT, 'Protected execution context is immutable'); END;

DROP TRIGGER grants_legacy_authority_insert;
DROP TRIGGER grants_legacy_authority_update;
DROP TRIGGER tasks_legacy_authority_insert;
DROP TRIGGER tasks_legacy_authority_update;

CREATE TRIGGER grants_authority_insert BEFORE INSERT ON authorization_grants
WHEN NOT EXISTS (
  SELECT 1 FROM proposal_authority_refs r JOIN proposal_versions p ON p.proposal_version_id=r.proposal_version_id
  WHERE r.proposal_version_id=NEW.proposal_version_id AND r.source_kind='LEGACY'
    AND p.workspace_id=r.workspace_id AND p.project_id=r.project_id AND p.digest=NEW.proposal_digest
) AND NOT EXISTS (
  SELECT 1 FROM protected_execution_bindings b JOIN proposal_authority_refs r ON r.proposal_version_id=b.proposal_version_id
  JOIN workspaces w ON w.workspace_id=b.workspace_id
  WHERE r.source_kind='PROTECTED' AND b.proposal_version_id=NEW.proposal_version_id AND b.grant_id=NEW.grant_id
    AND b.envelope_digest=NEW.proposal_digest AND NEW.actor_id=w.owner_id AND w.status='ACTIVE'
)
BEGIN SELECT RAISE(ABORT, 'Grant authority rejected'); END;

CREATE TRIGGER protected_grant_immutable BEFORE UPDATE OF grant_id,proposal_version_id,proposal_digest,actor_id,idempotency_key,actions_json,issued_at,expires_at ON authorization_grants
WHEN EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.grant_id=OLD.grant_id)
 AND (NEW.grant_id IS NOT OLD.grant_id OR NEW.proposal_version_id IS NOT OLD.proposal_version_id
  OR NEW.proposal_digest IS NOT OLD.proposal_digest OR NEW.actor_id IS NOT OLD.actor_id
  OR NEW.idempotency_key IS NOT OLD.idempotency_key OR NEW.actions_json IS NOT OLD.actions_json
  OR NEW.issued_at IS NOT OLD.issued_at OR NEW.expires_at IS NOT OLD.expires_at)
BEGIN SELECT RAISE(ABORT, 'Protected Grant scope is immutable'); END;

CREATE TRIGGER protected_grant_no_replace BEFORE INSERT ON authorization_grants
WHEN EXISTS (SELECT 1 FROM authorization_grants g JOIN protected_execution_bindings b ON b.grant_id=g.grant_id
  WHERE g.grant_id=NEW.grant_id OR (g.actor_id=NEW.actor_id AND g.idempotency_key=NEW.idempotency_key))
BEGIN SELECT RAISE(ABORT, 'Protected Grant cannot be replaced'); END;

CREATE TRIGGER protected_grant_no_resurrection BEFORE UPDATE OF status ON authorization_grants
WHEN EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.grant_id=OLD.grant_id)
 AND OLD.status IN ('CONSUMED','REVOKED','EXPIRED') AND NEW.status IN ('ISSUED','CONSUMED') AND NEW.status<>OLD.status
BEGIN SELECT RAISE(ABORT, 'Protected Grant cannot be resurrected'); END;

CREATE TRIGGER grants_authority_update BEFORE UPDATE OF proposal_version_id,proposal_digest ON authorization_grants
WHEN NOT EXISTS (
  SELECT 1 FROM proposal_authority_refs r JOIN proposal_versions p ON p.proposal_version_id=r.proposal_version_id
  WHERE r.proposal_version_id=NEW.proposal_version_id AND r.source_kind='LEGACY'
    AND p.workspace_id=r.workspace_id AND p.project_id=r.project_id AND p.digest=NEW.proposal_digest
) AND NOT EXISTS (
  SELECT 1 FROM protected_execution_bindings b WHERE b.proposal_version_id=NEW.proposal_version_id
    AND b.grant_id=NEW.grant_id AND b.envelope_digest=NEW.proposal_digest
)
BEGIN SELECT RAISE(ABORT, 'Grant authority rejected'); END;

CREATE TRIGGER tasks_authority_insert BEFORE INSERT ON tasks
WHEN NOT EXISTS (
  SELECT 1 FROM proposal_authority_refs r JOIN proposal_versions p ON p.proposal_version_id=r.proposal_version_id
  JOIN authorization_grants g ON g.grant_id=NEW.authorization_grant_id AND g.proposal_version_id=r.proposal_version_id
  WHERE r.proposal_version_id=NEW.proposal_version_id AND r.source_kind='LEGACY'
    AND r.workspace_id=NEW.workspace_id AND r.project_id=NEW.project_id
    AND p.workspace_id=r.workspace_id AND p.project_id=r.project_id
) AND NOT EXISTS (
  SELECT 1 FROM protected_execution_bindings b JOIN authorization_grants g
    ON g.grant_id=b.grant_id AND g.proposal_version_id=b.proposal_version_id AND g.proposal_digest=b.envelope_digest
  WHERE b.proposal_version_id=NEW.proposal_version_id AND b.task_id=NEW.task_id
    AND b.grant_id=NEW.authorization_grant_id AND b.workspace_id=NEW.workspace_id AND b.project_id=NEW.project_id
)
BEGIN SELECT RAISE(ABORT, 'Task authority rejected'); END;

CREATE TRIGGER protected_work_item_insert BEFORE INSERT ON work_items
WHEN EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.task_id=NEW.task_id
  AND (b.work_item_id<>NEW.work_item_id OR b.agent_id<>NEW.agent_id OR b.function_id<>NEW.function_id))
 OR EXISTS (SELECT 1 FROM work_items w JOIN protected_execution_bindings b ON b.work_item_id=w.work_item_id
  WHERE w.work_item_id=NEW.work_item_id)
BEGIN SELECT RAISE(ABORT, 'Protected work item binding mismatch'); END;

CREATE TRIGGER protected_work_item_update BEFORE UPDATE OF work_item_id,task_id,agent_id,function_id ON work_items
WHEN EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.task_id IN (OLD.task_id, NEW.task_id))
  AND (NEW.work_item_id<>OLD.work_item_id OR NEW.task_id<>OLD.task_id
    OR NEW.agent_id<>OLD.agent_id OR NEW.function_id<>OLD.function_id)
BEGIN SELECT RAISE(ABORT, 'Protected work item identity is immutable'); END;

CREATE TRIGGER protected_attempt_insert BEFORE INSERT ON execution_attempts
WHEN EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.work_item_id=NEW.work_item_id
  AND (b.attempt_id<>NEW.attempt_id OR b.request_id<>NEW.request_id OR b.proposal_version_id<>NEW.idempotency_key))
 OR EXISTS (SELECT 1 FROM execution_attempts a JOIN protected_execution_bindings b ON b.attempt_id=a.attempt_id
  WHERE a.attempt_id=NEW.attempt_id OR a.idempotency_key=NEW.idempotency_key)
BEGIN SELECT RAISE(ABORT, 'Protected Attempt binding mismatch'); END;

CREATE TRIGGER protected_attempt_update BEFORE UPDATE OF attempt_id,work_item_id,request_id,idempotency_key ON execution_attempts
WHEN EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.work_item_id IN (OLD.work_item_id, NEW.work_item_id))
 AND (NEW.attempt_id IS NOT OLD.attempt_id OR NEW.work_item_id IS NOT OLD.work_item_id
   OR NEW.request_id IS NOT OLD.request_id OR NEW.idempotency_key IS NOT OLD.idempotency_key)
BEGIN SELECT RAISE(ABORT, 'Protected Attempt identity is immutable'); END;

CREATE TRIGGER protected_attempt_no_redispatch BEFORE UPDATE OF state ON execution_attempts
WHEN EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.attempt_id=OLD.attempt_id)
 AND OLD.state<>'DISPATCH_PENDING' AND NEW.state='DISPATCH_PENDING'
BEGIN SELECT RAISE(ABORT, 'Protected Attempt cannot be redispatched'); END;

-- Ambiguous Attempts stay quarantined until a separately verified recovery
-- transaction and its evidence model are introduced in a later migration.
CREATE TRIGGER protected_attempt_state_guard BEFORE UPDATE OF state ON execution_attempts
WHEN EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.attempt_id=OLD.attempt_id)
 AND (NEW.state NOT IN ('CREATED','DISPATCH_PENDING','DISPATCHED','RUNNING','WAITING_USER','WAITING_INPUT',
      'CANCELLING','CANCELLED','SUCCEEDED','FAILED','UNKNOWN','RECONCILING','NOT_STARTED')
   OR (OLD.state IN ('UNKNOWN','RECONCILING') AND NEW.state NOT IN ('UNKNOWN','RECONCILING'))
   OR (OLD.state IN ('CANCELLED','SUCCEEDED','FAILED','NOT_STARTED') AND NEW.state<>OLD.state))
BEGIN SELECT RAISE(ABORT, 'Protected Attempt needs reconciliation evidence'); END;

CREATE TRIGGER protected_lease_insert BEFORE INSERT ON resource_leases
WHEN EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.attempt_id=NEW.attempt_id
  AND (b.lease_id<>NEW.lease_id OR NEW.resource_key<>'project:' || b.project_id))
 OR EXISTS (SELECT 1 FROM resource_leases l JOIN protected_execution_bindings b ON b.lease_id=l.lease_id
  WHERE l.lease_id=NEW.lease_id OR (l.resource_key=NEW.resource_key AND l.fencing_token=NEW.fencing_token))
BEGIN SELECT RAISE(ABORT, 'Protected lease binding mismatch'); END;

CREATE TRIGGER protected_lease_update BEFORE UPDATE OF lease_id,resource_key,attempt_id,fencing_token ON resource_leases
WHEN EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.attempt_id IN (OLD.attempt_id, NEW.attempt_id))
 AND (NEW.lease_id IS NOT OLD.lease_id OR NEW.resource_key IS NOT OLD.resource_key
   OR NEW.attempt_id IS NOT OLD.attempt_id OR NEW.fencing_token IS NOT OLD.fencing_token)
BEGIN SELECT RAISE(ABORT, 'Protected lease identity is immutable'); END;

CREATE TRIGGER protected_lease_no_resurrection BEFORE UPDATE OF state ON resource_leases
WHEN EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.lease_id=OLD.lease_id)
 AND OLD.state<>'ACTIVE' AND NEW.state='ACTIVE'
BEGIN SELECT RAISE(ABORT, 'Protected Lease cannot be resurrected'); END;

-- The stored observation is monotonic. Once an observer has reached expiry,
-- the same Lease cannot be renewed into a new window.
CREATE TRIGGER protected_lease_time_guard BEFORE UPDATE OF renewed_at,expires_at,last_observed_at ON resource_leases
WHEN EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.lease_id=OLD.lease_id)
 AND (OLD.state<>'ACTIVE' OR OLD.renewed_at IS NULL OR OLD.expires_at IS NULL OR OLD.last_observed_at IS NULL
   OR NEW.renewed_at IS NULL OR NEW.expires_at IS NULL OR NEW.last_observed_at IS NULL
   OR strftime('%Y-%m-%dT%H:%M:%fZ',NEW.renewed_at) IS NOT NEW.renewed_at
   OR strftime('%Y-%m-%dT%H:%M:%fZ',NEW.expires_at) IS NOT NEW.expires_at
   OR strftime('%Y-%m-%dT%H:%M:%fZ',NEW.last_observed_at) IS NOT NEW.last_observed_at
   OR NEW.last_observed_at<OLD.last_observed_at
   OR ((NEW.renewed_at IS NOT OLD.renewed_at OR NEW.expires_at IS NOT OLD.expires_at)
     AND (OLD.last_observed_at>=OLD.expires_at OR NEW.renewed_at<OLD.last_observed_at OR NEW.renewed_at>=OLD.expires_at
       OR NEW.last_observed_at<>NEW.renewed_at OR NEW.expires_at<=OLD.expires_at
       OR CAST(strftime('%s',NEW.expires_at) AS INTEGER)-CAST(strftime('%s',NEW.renewed_at) AS INTEGER)<>30
       OR substr(NEW.expires_at,20,5)<>substr(NEW.renewed_at,20,5))))
BEGIN SELECT RAISE(ABORT, 'Protected Lease time cannot be rewound'); END;

CREATE TRIGGER protected_start_insert BEFORE INSERT ON outbox
WHEN NEW.message_type='start' AND (EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.attempt_id=NEW.attempt_id
  AND (NEW.message_id<>'outbox:' || b.attempt_id OR NEW.request_id<>b.request_id
    OR NEW.idempotency_key<>b.proposal_version_id OR NEW.payload_json<>json_object('attempt_id',b.attempt_id)))
 OR EXISTS (SELECT 1 FROM outbox o JOIN protected_execution_bindings b ON b.attempt_id=o.attempt_id
  WHERE o.message_id=NEW.message_id OR (o.idempotency_key=NEW.idempotency_key AND o.message_type=NEW.message_type)))
BEGIN SELECT RAISE(ABORT, 'Protected start binding mismatch'); END;

CREATE TRIGGER protected_start_update BEFORE UPDATE OF message_id,attempt_id,request_id,idempotency_key,message_type,payload_json ON outbox
WHEN (OLD.message_type='start' OR NEW.message_type='start')
 AND EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.attempt_id IN (OLD.attempt_id, NEW.attempt_id))
 AND (NEW.message_id IS NOT OLD.message_id OR NEW.attempt_id IS NOT OLD.attempt_id OR NEW.request_id IS NOT OLD.request_id
   OR NEW.idempotency_key IS NOT OLD.idempotency_key OR NEW.message_type IS NOT OLD.message_type OR NEW.payload_json IS NOT OLD.payload_json)
BEGIN SELECT RAISE(ABORT, 'Protected start identity is immutable'); END;

CREATE TRIGGER protected_start_no_redispatch BEFORE UPDATE OF state ON outbox
WHEN OLD.message_type='start' AND EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.attempt_id=OLD.attempt_id)
 AND ((OLD.state<>'PENDING' AND NEW.state='PENDING')
   OR (OLD.state IN ('RECONCILING','ACKNOWLEDGED','CANCELLED') AND NEW.state='DISPATCHING'))
BEGIN SELECT RAISE(ABORT, 'Protected start cannot be redispatched'); END;

CREATE TRIGGER protected_start_state_guard BEFORE UPDATE OF state ON outbox
WHEN OLD.message_type='start' AND EXISTS (SELECT 1 FROM protected_execution_bindings b WHERE b.attempt_id=OLD.attempt_id)
 AND NOT (NEW.state=OLD.state
   OR (OLD.state='PENDING' AND NEW.state IN ('DISPATCHING','RECONCILING','CANCELLED'))
   OR (OLD.state='DISPATCHING' AND NEW.state IN ('ACKNOWLEDGED','RECONCILING')))
BEGIN SELECT RAISE(ABORT, 'Protected start state transition rejected'); END;

CREATE TRIGGER protected_task_no_replace BEFORE INSERT ON tasks
WHEN EXISTS (SELECT 1 FROM tasks t JOIN protected_execution_bindings b ON b.task_id=t.task_id WHERE t.task_id=NEW.task_id)
BEGIN SELECT RAISE(ABORT, 'Protected Task cannot be replaced'); END;

CREATE TRIGGER protected_outbox_no_replace BEFORE INSERT ON outbox
WHEN EXISTS (SELECT 1 FROM outbox o JOIN protected_execution_bindings b ON b.attempt_id=o.attempt_id AND o.message_type='start'
  WHERE o.message_id=NEW.message_id OR (o.idempotency_key=NEW.idempotency_key AND o.message_type=NEW.message_type))
BEGIN SELECT RAISE(ABORT, 'Protected start cannot be replaced'); END;

CREATE TRIGGER tasks_authority_update BEFORE UPDATE OF workspace_id,project_id,proposal_version_id,authorization_grant_id ON tasks
WHEN NOT EXISTS (
  SELECT 1 FROM proposal_authority_refs r JOIN proposal_versions p ON p.proposal_version_id=r.proposal_version_id
  JOIN authorization_grants g ON g.grant_id=NEW.authorization_grant_id AND g.proposal_version_id=r.proposal_version_id
  WHERE r.proposal_version_id=NEW.proposal_version_id AND r.source_kind='LEGACY'
    AND r.workspace_id=NEW.workspace_id AND r.project_id=NEW.project_id
    AND p.workspace_id=r.workspace_id AND p.project_id=r.project_id
) AND NOT EXISTS (
  SELECT 1 FROM protected_execution_bindings b JOIN authorization_grants g
    ON g.grant_id=b.grant_id AND g.proposal_version_id=b.proposal_version_id AND g.proposal_digest=b.envelope_digest
  WHERE b.proposal_version_id=NEW.proposal_version_id AND b.task_id=NEW.task_id
    AND b.grant_id=NEW.authorization_grant_id AND b.workspace_id=NEW.workspace_id AND b.project_id=NEW.project_id
)
BEGIN SELECT RAISE(ABORT, 'Task authority rejected'); END;
