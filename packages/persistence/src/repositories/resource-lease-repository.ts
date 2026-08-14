/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';

export class SqliteResourceLeaseRepository {
  constructor(private readonly database: Database.Database) {}

  acquire(input: { leaseId: string; resourceKey: string; attemptId: string; fencingToken: number; createdAt: string }): void {
    const latest = this.database.prepare('SELECT MAX(fencing_token) AS token FROM resource_leases WHERE resource_key = ?').get(input.resourceKey) as { token: number | null };
    if (latest.token !== null && input.fencingToken <= latest.token) throw new Error('STALE_FENCING_TOKEN');
    this.database.prepare('INSERT INTO resource_leases VALUES (?, ?, ?, ?, ?, ?, ?)').run(input.leaseId, input.resourceKey, input.attemptId, input.fencingToken, 'ACTIVE', input.createdAt, null);
  }

  release(leaseId: string, fencingToken: number, releasedAt: string): boolean {
    const result = this.database.prepare("UPDATE resource_leases SET state = 'RELEASED', released_at = ? WHERE lease_id = ? AND fencing_token = ? AND state IN ('ACTIVE', 'RELEASING')").run(releasedAt, leaseId, fencingToken);
    return result.changes === 1;
  }
}
