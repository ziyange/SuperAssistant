/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';

export interface FollowUpBudgetDecision {
  readonly decisionId: string;
  readonly correlationKey: string;
  readonly reason: 'COOLDOWN' | 'CONCURRENCY' | 'BUDGET';
  readonly createdAt: string;
}

export class SqliteFollowUpBudgetRepository {
  public constructor(private readonly database: Database.Database) {}

  public record(decision: FollowUpBudgetDecision): void {
    this.database.prepare(`
      INSERT INTO follow_up_budget_decisions (decision_id, correlation_key, reason, created_at)
      VALUES (@decisionId, @correlationKey, @reason, @createdAt)
    `).run(decision);
  }

  public list(correlationKey: string): readonly FollowUpBudgetDecision[] {
    return this.database.prepare(`
      SELECT decision_id AS decisionId, correlation_key AS correlationKey, reason, created_at AS createdAt
      FROM follow_up_budget_decisions
      WHERE correlation_key = ?
      ORDER BY created_at ASC, decision_id ASC
    `).all(correlationKey) as readonly FollowUpBudgetDecision[];
  }
}
