CREATE TABLE IF NOT EXISTS resource_scheduler_leases (
  resource_key TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  fencing_token INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('ACTIVE','RELEASED'))
);
