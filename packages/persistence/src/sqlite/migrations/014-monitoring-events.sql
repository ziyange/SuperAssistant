CREATE TABLE IF NOT EXISTS raw_monitoring_events (
  event_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(source_id, source_key)
);
CREATE TABLE IF NOT EXISTS normalized_monitoring_events (
  normalized_event_id TEXT PRIMARY KEY,
  raw_event_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK(schema_version >= 1),
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(raw_event_id, schema_version),
  FOREIGN KEY(raw_event_id) REFERENCES raw_monitoring_events(event_id)
);
CREATE TRIGGER IF NOT EXISTS raw_monitoring_events_immutable BEFORE UPDATE ON raw_monitoring_events BEGIN SELECT RAISE(ABORT, 'raw monitoring event is immutable'); END;
CREATE TRIGGER IF NOT EXISTS raw_monitoring_events_no_delete BEFORE DELETE ON raw_monitoring_events BEGIN SELECT RAISE(ABORT, 'raw monitoring event is immutable'); END;
CREATE TRIGGER IF NOT EXISTS normalized_monitoring_events_immutable BEFORE UPDATE ON normalized_monitoring_events BEGIN SELECT RAISE(ABORT, 'normalized monitoring event is immutable'); END;
CREATE TRIGGER IF NOT EXISTS normalized_monitoring_events_no_delete BEFORE DELETE ON normalized_monitoring_events BEGIN SELECT RAISE(ABORT, 'normalized monitoring event is immutable'); END;
