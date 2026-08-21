CREATE TABLE IF NOT EXISTS work_item_graphs (
  task_id TEXT PRIMARY KEY,
  nodes_json TEXT NOT NULL,
  edges_json TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS work_item_graphs_immutable BEFORE UPDATE ON work_item_graphs BEGIN SELECT RAISE(ABORT, 'work item graph is immutable'); END;
CREATE TRIGGER IF NOT EXISTS work_item_graphs_no_delete BEFORE DELETE ON work_item_graphs BEGIN SELECT RAISE(ABORT, 'work item graph is immutable'); END;
