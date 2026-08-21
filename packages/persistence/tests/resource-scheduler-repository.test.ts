import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteResourceSchedulerRepository } from '../src/repositories/resource-scheduler-repository.js';

test('records fenced resource grants and rejects a stale token', () => {
  const database = createFoundationDatabase(':memory:');
  const repository = new SqliteResourceSchedulerRepository(database);
  repository.grant({ resourceKey: 'project:one', attemptId: 'attempt-1', fencingToken: 1 });
  expect(repository.canWrite('project:one', 'attempt-1', 1)).toBe(true);
  expect(repository.canWrite('project:one', 'attempt-1', 0)).toBe(false);
  database.close();
});
