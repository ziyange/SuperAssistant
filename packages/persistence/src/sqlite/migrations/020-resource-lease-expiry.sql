ALTER TABLE resource_leases ADD COLUMN renewed_at TEXT;
ALTER TABLE resource_leases ADD COLUMN expires_at TEXT;
ALTER TABLE resource_leases ADD COLUMN last_observed_at TEXT;
