import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteWorkItemGraphRepository } from '../src/repositories/work-item-graph-repository.js';

test('persists a Task-scoped DAG and restores its dependency meaning', () => {
  const database = createFoundationDatabase(':memory:');
  const repository = new SqliteWorkItemGraphRepository(database);
  repository.save({ taskId: 'task-1', nodes: ['a', 'b'], edges: [{ from: 'a', to: 'b' }] });
  expect(repository.get('task-1')).toEqual({ taskId: 'task-1', nodes: ['a', 'b'], edges: [{ from: 'a', to: 'b' }] });
  database.close();
});
