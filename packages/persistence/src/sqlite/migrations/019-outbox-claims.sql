ALTER TABLE outbox ADD COLUMN claim_token TEXT;
CREATE UNIQUE INDEX outbox_claim_token_unique ON outbox(claim_token) WHERE claim_token IS NOT NULL;
