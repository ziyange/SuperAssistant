-- Original receipts stay immutable. Missing historical proof must never be filled from a later login.
ALTER TABLE codex_start_receipts ADD COLUMN principal_hash TEXT
  CHECK (principal_hash IS NULL OR (length(principal_hash)=64 AND principal_hash NOT GLOB '*[^0-9a-f]*'));
