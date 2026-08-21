import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteQualityEvidenceRepository } from '../src/repositories/quality-evidence-repository.js';

test('persists independent Inspector evidence immutably', () => {
  const database = createFoundationDatabase(':memory:');
  const repository = new SqliteQualityEvidenceRepository(database);
  repository.append({ taskId: 'task-1', workItemId: 'work-1', executorAgentId: 'agent-1', evaluatorAgentId: 'agent-2', role: 'INSPECTOR', outcome: 'REJECTED' });
  expect(repository.list('task-1')).toHaveLength(1);
  expect(() => database.prepare("UPDATE quality_evidence SET outcome = 'ACCEPTED'").run()).toThrow(/immutable/);
  database.close();
});
