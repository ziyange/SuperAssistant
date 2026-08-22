import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteFollowUpBudgetRepository } from '../src/repositories/follow-up-budget-repository.js';

test('records an immutable blocked follow-up decision for audit', () => {
  const database = createFoundationDatabase(':memory:');
  const repository = new SqliteFollowUpBudgetRepository(database);
  repository.record({ decisionId: 'decision-1', correlationKey: 'project-1:BUILD_FAILED', reason: 'COOLDOWN', createdAt: '2026-08-22T00:00:00.000Z' });
  expect(repository.list('project-1:BUILD_FAILED')).toEqual([{ decisionId: 'decision-1', correlationKey: 'project-1:BUILD_FAILED', reason: 'COOLDOWN', createdAt: '2026-08-22T00:00:00.000Z' }]);
  expect(() => database.prepare("update follow_up_budget_decisions set reason = 'BUDGET' where decision_id = 'decision-1'").run()).toThrow(/immutable/);
  database.close();
});
