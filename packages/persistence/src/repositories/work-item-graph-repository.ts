/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { createWorkItemGraph, type WorkItemGraph } from '@super-assistant/domain';

export class SqliteWorkItemGraphRepository {
  constructor(private readonly database: Database.Database) {}
  save(graph: WorkItemGraph): void { const value = createWorkItemGraph(graph); this.database.prepare('INSERT INTO work_item_graphs VALUES (?, ?, ?)').run(value.taskId, JSON.stringify(value.nodes), JSON.stringify(value.edges)); }
  get(taskId: string): Readonly<WorkItemGraph> | null { const row = this.database.prepare('SELECT * FROM work_item_graphs WHERE task_id = ?').get(taskId) as Record<string, unknown> | undefined; return row ? createWorkItemGraph({ taskId: String(row.task_id), nodes: JSON.parse(String(row.nodes_json)), edges: JSON.parse(String(row.edges_json)) }) : null; }
}
