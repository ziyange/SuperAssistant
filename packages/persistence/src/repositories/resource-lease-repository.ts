/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';

type LeaseIdentity = { leaseId: string; attemptId: string; fencingToken: number };
type LeaseWindow = { renewed_at: string | null; expires_at: string | null; last_observed_at: string | null };
const TTL_MS = 30_000;
function instant(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

export class SqliteResourceLeaseRepository {
  constructor(private readonly database: Database.Database, private readonly clock: () => string = () => new Date().toISOString()) {}

  acquire(input: { leaseId: string; resourceKey: string; attemptId: string; fencingToken: number; createdAt: string }): void {
    const acquire = this.database.transaction(() => {
      if (!input.resourceKey || !Number.isSafeInteger(input.fencingToken) || input.fencingToken <= 0) throw new Error('INVALID_RESOURCE_LEASE');
      const acquiredAt = instant(input.createdAt);
      if (acquiredAt === null || !Number.isFinite(new Date(acquiredAt + TTL_MS).getTime())) throw new Error('INVALID_RESOURCE_LEASE_TIME');
      const expiresAt = new Date(acquiredAt + TTL_MS).toISOString();
      const legacy = input.resourceKey.startsWith('project:')
        ? `worktree:${input.resourceKey.slice('project:'.length)}`
        : input.resourceKey.startsWith('worktree:')
          ? `project:${input.resourceKey.slice('worktree:'.length)}`
          : input.resourceKey;
      const prior = this.database.prepare("SELECT MAX(fencing_token) AS token, COALESCE(SUM(CASE WHEN state <> 'RELEASED' THEN 1 ELSE 0 END), 0) AS blocking FROM resource_leases WHERE resource_key IN (?, ?)").get(input.resourceKey, legacy) as { token: number | null; blocking: number };
      if (prior.blocking > 0) throw new Error('RESOURCE_LEASE_BUSY');
      if (prior.token !== null && input.fencingToken <= prior.token) throw new Error('STALE_FENCING_TOKEN');
      this.database.prepare('INSERT INTO resource_leases (lease_id, resource_key, attempt_id, fencing_token, state, created_at, released_at, renewed_at, expires_at, last_observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(input.leaseId, input.resourceKey, input.attemptId, input.fencingToken, 'ACTIVE', input.createdAt, null, input.createdAt, expiresAt, input.createdAt);
    });
    acquire();
  }

  private window(identity: LeaseIdentity): { now: number; renewed: string; expires: string } | null {
    let now: number | null;
    try { now = instant(this.clock()); } catch { return null; }
    if (now === null || !Number.isSafeInteger(identity.fencingToken) || identity.fencingToken <= 0) return null;
    const row = this.database.prepare("SELECT renewed_at, expires_at, last_observed_at FROM resource_leases WHERE lease_id = ? AND attempt_id = ? AND fencing_token = ? AND state = 'ACTIVE'").get(identity.leaseId, identity.attemptId, identity.fencingToken) as LeaseWindow | undefined;
    const renewed = instant(row?.renewed_at);
    const expires = instant(row?.expires_at);
    const observed = instant(row?.last_observed_at);
    if (!row || !row.renewed_at || !row.expires_at || !row.last_observed_at || renewed === null || expires === null || observed === null || expires - renewed !== TTL_MS || observed < renewed || now < observed) return null;
    const observedAt = new Date(now).toISOString();
    const advanced = this.database.prepare("UPDATE resource_leases SET last_observed_at = ? WHERE lease_id = ? AND attempt_id = ? AND fencing_token = ? AND state = 'ACTIVE' AND renewed_at = ? AND expires_at = ? AND last_observed_at = ?").run(observedAt, identity.leaseId, identity.attemptId, identity.fencingToken, row.renewed_at, row.expires_at, row.last_observed_at);
    if (advanced.changes !== 1 || now >= expires) return null;
    return { now, renewed: row.renewed_at, expires: row.expires_at };
  }

  canWrite(identity: LeaseIdentity): boolean { return this.window(identity) !== null; }

  renew(identity: LeaseIdentity): boolean {
    const window = this.window(identity);
    if (!window || !Number.isFinite(new Date(window.now + TTL_MS).getTime())) return false;
    const renewedAt = new Date(window.now).toISOString();
    const expiresAt = new Date(window.now + TTL_MS).toISOString();
    return this.database.prepare("UPDATE resource_leases SET renewed_at = ?, expires_at = ? WHERE lease_id = ? AND attempt_id = ? AND fencing_token = ? AND state = 'ACTIVE' AND renewed_at = ? AND expires_at = ? AND last_observed_at = ?").run(renewedAt, expiresAt, identity.leaseId, identity.attemptId, identity.fencingToken, window.renewed, window.expires, renewedAt).changes === 1;
  }

  release(leaseId: string, fencingToken: number, releasedAt: string): boolean {
    const result = this.database.prepare("UPDATE resource_leases SET state = 'RELEASED', released_at = ? WHERE lease_id = ? AND fencing_token = ? AND state IN ('ACTIVE', 'RELEASING')").run(releasedAt, leaseId, fencingToken);
    return result.changes === 1;
  }
}
