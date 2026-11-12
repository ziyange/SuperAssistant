CREATE UNIQUE INDEX authorization_grants_one_issued_per_proposal
ON authorization_grants(actor_id, proposal_version_id)
WHERE status = 'ISSUED';

CREATE TABLE authorization_confirmation_keys (
  actor_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  grant_id TEXT NOT NULL REFERENCES authorization_grants(grant_id),
  PRIMARY KEY(actor_id, idempotency_key)
);
INSERT INTO authorization_confirmation_keys(actor_id, idempotency_key, grant_id)
SELECT actor_id, idempotency_key, grant_id FROM authorization_grants;
