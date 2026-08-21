CREATE TABLE IF NOT EXISTS agent_template_versions (
  template_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  function_versions_json TEXT NOT NULL,
  PRIMARY KEY (template_id, version)
);
CREATE TRIGGER IF NOT EXISTS agent_template_versions_append_only BEFORE UPDATE ON agent_template_versions BEGIN SELECT RAISE(ABORT, 'agent template versions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS agent_template_versions_no_delete BEFORE DELETE ON agent_template_versions BEGIN SELECT RAISE(ABORT, 'agent template versions are immutable'); END;
