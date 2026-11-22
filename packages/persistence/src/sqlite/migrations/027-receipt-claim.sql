-- Historic receipts remain immutable; an absent owner proof is never inferred.
ALTER TABLE codex_start_receipts ADD COLUMN claim_hash TEXT
  CHECK (claim_hash IS NULL OR (length(claim_hash)=64 AND claim_hash NOT GLOB '*[^0-9a-f]*'));
