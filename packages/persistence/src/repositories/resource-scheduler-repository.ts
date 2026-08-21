/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
export class SqliteResourceSchedulerRepository {
  constructor(private readonly database: Database.Database) {}
  grant(input: { resourceKey: string; attemptId: string; fencingToken: number }): void { this.database.prepare("INSERT INTO resource_scheduler_leases VALUES (?, ?, ?, 'ACTIVE')").run(input.resourceKey, input.attemptId, input.fencingToken); }
  canWrite(resourceKey: string, attemptId: string, fencingToken: number): boolean { return Boolean(this.database.prepare("SELECT 1 FROM resource_scheduler_leases WHERE resource_key = ? AND attempt_id = ? AND fencing_token = ? AND state = 'ACTIVE'").get(resourceKey, attemptId, fencingToken)); }
}
