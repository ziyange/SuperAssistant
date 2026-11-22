/* eslint-disable no-unused-vars -- constructor property documents the SQLite boundary. */
import { Buffer } from 'node:buffer';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type Database from 'better-sqlite3';

export interface ReservationScope { workspaceId: string; projectId: string; recordId: string; }
interface ReservationRow {
  record_id: string; workspace_id: string; project_id: string; key_ref: string;
  owner_hash: string; state: 'RESERVED' | 'STORED' | 'UNCERTAIN' | 'LINKED';
}
export type ReservationObservation = 'ABSENT' | 'RESERVED' | 'STORED' | 'UNCERTAIN' | 'LINKED'
  | 'PAYLOAD_PRESENT_UNCONFIRMED' | 'CONFLICT';
const identifier = /^[A-Za-z0-9_-]{1,128}$/;
function validate(scope: ReservationScope): void {
  if (typeof scope.workspaceId !== 'string' || typeof scope.projectId !== 'string' || typeof scope.recordId !== 'string'
    || !identifier.test(scope.workspaceId) || !identifier.test(scope.projectId) || !identifier.test(scope.recordId)) {
    throw new Error('Invalid protected key scope');
  }
}
function digest(token: string): Buffer {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) throw new Error('Invalid reservation owner');
  return createHash('sha256').update(token, 'ascii').digest();
}

/** Journal only: no vault writes, key generation, deletion, retries or automatic recovery. */
export class ProtectedKeyReservations {
  constructor(private readonly db: Database.Database) {}

  private authorize(scope: ReservationScope): void {
    validate(scope);
    const ok = this.db.prepare(`SELECT 1 FROM projects p JOIN workspaces w ON p.workspace_id=w.workspace_id
      WHERE w.workspace_id=? AND p.project_id=? AND w.owner_id='local-owner' AND w.status='ACTIVE' AND p.status='ACTIVE'`)
      .get(scope.workspaceId, scope.projectId);
    if (!ok) throw new Error('Protected key scope unavailable');
  }
  private lookup(scope: ReservationScope): ReservationRow | undefined {
    return this.db.prepare('SELECT * FROM protected_key_reservations WHERE record_id=? AND workspace_id=? AND project_id=?')
      .get(scope.recordId, scope.workspaceId, scope.projectId) as ReservationRow | undefined;
  }
  private payloadState(row: ReservationRow): 'NONE' | 'MATCH' | 'CONFLICT' {
    const payload = this.db.prepare('SELECT workspace_id,project_id,key_ref FROM protected_payloads WHERE record_id=?')
      .get(row.record_id) as { workspace_id: string; project_id: string; key_ref: string } | undefined;
    if (!payload) return 'NONE';
    return payload.workspace_id === row.workspace_id && payload.project_id === row.project_id && payload.key_ref === row.key_ref
      ? 'MATCH' : 'CONFLICT';
  }
  reserve(input: ReservationScope): { keyRef: string; ownerToken: string } {
    const scope = { ...input };
    return this.db.transaction(() => {
      this.authorize(scope);
      if (this.db.prepare('SELECT 1 FROM protected_payloads WHERE record_id=?').get(scope.recordId)) {
        throw new Error('Protected payload already exists');
      }
      const keyRef = 'pkey-' + randomBytes(32).toString('hex');
      const ownerToken = randomBytes(32).toString('hex');
      const hash = digest(ownerToken).toString('hex');
      const now = new Date().toISOString();
      this.db.prepare(`INSERT INTO protected_key_reservations
        (record_id,workspace_id,project_id,key_ref,owner_hash,state,created_at,updated_at)
        VALUES (?,?,?,?,?,'RESERVED',?,?)`).run(scope.recordId, scope.workspaceId, scope.projectId, keyRef, hash, now, now);
      return { keyRef, ownerToken };
    }).immediate();
  }
  private transition(input: ReservationScope, token: string, next: 'STORED' | 'UNCERTAIN' | 'LINKED'): void {
    const scope = { ...input };
    const owner = digest(token);
    try {
      this.db.transaction(() => {
        this.authorize(scope);
        const row = this.lookup(scope);
        if (!row || !/^[0-9a-f]{64}$/.test(row.owner_hash)
          || !timingSafeEqual(owner, Buffer.from(row.owner_hash, 'hex'))) throw new Error('Reservation owner rejected');
        const valid = next === 'STORED' ? row.state === 'RESERVED'
          : next === 'UNCERTAIN' ? row.state === 'RESERVED' || row.state === 'STORED'
            : row.state === 'STORED' && this.payloadState(row) === 'MATCH';
        if (!valid) throw new Error('Reservation transition rejected');
        const updated = this.db.prepare('UPDATE protected_key_reservations SET state=?,updated_at=? WHERE record_id=? AND state=?')
          .run(next, new Date().toISOString(), row.record_id, row.state);
        if (updated.changes !== 1) throw new Error('Reservation transition lost');
      }).immediate();
    } finally { owner.fill(0); }
  }
  confirmStored(scope: ReservationScope, ownerToken: string): void { this.transition(scope, ownerToken, 'STORED'); }
  markUncertain(scope: ReservationScope, ownerToken: string): void { this.transition(scope, ownerToken, 'UNCERTAIN'); }
  markLinked(scope: ReservationScope, ownerToken: string): void { this.transition(scope, ownerToken, 'LINKED'); }
  inspect(input: ReservationScope): ReservationObservation {
    const scope = { ...input };
    return this.db.transaction(() => {
      this.authorize(scope);
      const row = this.lookup(scope);
      if (!row) return 'ABSENT';
      const payload = this.payloadState(row);
      if (payload === 'CONFLICT' || (row.state === 'LINKED' && payload !== 'MATCH')) return 'CONFLICT';
      if (payload === 'MATCH' && row.state !== 'LINKED') return 'PAYLOAD_PRESENT_UNCONFIRMED';
      return row.state;
    })();
  }
}
