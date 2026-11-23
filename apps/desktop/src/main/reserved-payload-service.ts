/* eslint-disable no-unused-vars -- port arguments and constructor properties define the main-process boundary. */
import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import type Database from 'better-sqlite3';
import { ProtectedKeyReservations } from './protected-key-reservations.js';
import { authenticatePayloadForRecovery, ProtectedPayloadStore, type ProtectedKeyProvider, type ProtectedPayloadScope } from './protected-payload-store.js';

const vaultDeadlineMs = 10_000;
const maxOutstandingVaultCalls = 4;
let outstandingVaultCalls = 0;
function boundedVaultCall<T>(operation: () => Promise<T>, onLate?: (value: T) => void): Promise<T> {
  if (outstandingVaultCalls >= maxOutstandingVaultCalls) return Promise.reject(new Error('Vault capacity exhausted'));
  outstandingVaultCalls++;
  const actual = Promise.resolve().then(operation).then(
    value => { outstandingVaultCalls--; return value; },
    error => { outstandingVaultCalls--; throw error; }
  );
  return new Promise<T>((resolve, reject) => {
    let expired = false;
    const timeout = globalThis.setTimeout(() => { expired = true; reject(new Error('Vault operation timed out')); }, vaultDeadlineMs);
    actual.then(value => {
      globalThis.clearTimeout(timeout);
      if (expired) { try { onLate?.(value); } catch { /* No caller remains; preserve fail-closed state. */ } return; }
      resolve(value);
    }, error => { globalThis.clearTimeout(timeout); reject(error); });
  });
}

/** The vault must reject overwrites. Returned buffers may be borrowed and are never modified. */
export interface ReservedVault {
  create(keyRef: string): Promise<Buffer>;
  read(keyRef: string): Promise<Buffer | null>;
  release?(value: Buffer): void;
}

type ReceiptEnvelope = { nonce: Buffer; ciphertext: Buffer; authTag: Buffer };
type BoundEnvelope = {
  record_id: string; workspace_id: string; project_id: string; content_kind: string; format_version: number;
  key_ref: string; nonce: Buffer; ciphertext: Buffer; auth_tag: Buffer; created_at: string;
  owner_hash: string; reservation_state: string; reservation_created: string; reservation_updated: string;
};

/** Isolated orchestration only: never selected by the renderer or production desktop. */
export class ReservedPayloadService {
  constructor(private readonly db: Database.Database, private readonly journal: ProtectedKeyReservations,
    private readonly vault: ReservedVault) {}

  private release(value: Buffer | null | undefined): void {
    if (Buffer.isBuffer(value)) this.vault.release?.(value);
  }

  private async readCopy(ref: string): Promise<Buffer | null> {
    const value = await boundedVaultCall(() => this.vault.read(ref), late => this.release(late));
    let copy: Buffer | null = null;
    let failed = false;
    try {
      if (value !== null) {
        if (!Buffer.isBuffer(value) || value.length !== 32) throw new Error('Invalid vault key');
        copy = Buffer.from(value);
      }
    } catch { failed = true; }
    try { this.release(value); }
    catch { copy?.fill(0); throw new Error('Vault key release failed'); }
    if (failed) throw new Error('Invalid vault key');
    return copy;
  }

  async create(input: ProtectedPayloadScope, plaintext: string): Promise<void> {
    const scope = { ...input };
    if ((scope.kind !== 'GOAL' && scope.kind !== 'PROPOSAL') || typeof plaintext !== 'string'
      || Buffer.byteLength(plaintext, 'utf8') < 1 || Buffer.byteLength(plaintext, 'utf8') > 65536
      || Buffer.from(plaintext, 'utf8').toString('utf8') !== plaintext) {
      throw new Error('Protected content rejected');
    }
    const { keyRef, ownerToken } = this.journal.reserve(scope);
    let attempted = false;
    const provider: ProtectedKeyProvider = {
      create: async () => {
        attempted = true;
        let key: Buffer | undefined;
        let owned: Buffer | undefined;
        let readback: Buffer | null = null;
        try {
          key = await boundedVaultCall(() => this.vault.create(keyRef), late => this.release(late));
          if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Invalid key');
          owned = Buffer.from(key);
          readback = await this.readCopy(keyRef);
          if (!Buffer.isBuffer(readback) || readback.length !== 32 || !timingSafeEqual(owned, readback)) {
            throw new Error('Key readback failed');
          }
          this.journal.confirmStored(scope, ownerToken);
          const originalKey = key;
          key = undefined;
          this.release(originalKey);
          const result = owned;
          owned = undefined;
          return { keyRef, key: result };
        } catch {
          throw new Error('Vault key operation failed');
        } finally {
          owned?.fill(0);
          if (Buffer.isBuffer(readback)) readback.fill(0);
          this.release(key);
        }
      },
      read: async ref => this.readCopy(ref)
    };
    try {
      await new ProtectedPayloadStore(this.db, provider).create(scope, plaintext);
      this.journal.markLinked(scope, ownerToken);
    } catch {
      if (attempted) {
        try { this.journal.markUncertain(scope, ownerToken); } catch { /* Preserve the last durable state. */ }
      }
      throw new Error('Protected content operation uncertain');
    }
  }

  async read(scope: ProtectedPayloadScope): Promise<string> {
    if (this.journal.inspect(scope) !== 'LINKED') throw new Error('Protected content not linked');
    const provider: ProtectedKeyProvider = {
      create: async () => { throw new Error('Key creation is not available'); },
      read: async ref => this.readCopy(ref)
    };
    return new ProtectedPayloadStore(this.db, provider).read(scope);
  }

  /** Read only the exact captured Proposal envelope, including across vault awaits. */
  async readBound(input: ProtectedPayloadScope, expected: string): Promise<string> {
    const scope = { ...input };
    if (scope.kind !== 'PROPOSAL' || typeof expected !== 'string' || expected.length < 1 || expected.length > 100000
      || this.db.inTransaction) throw new Error('Protected content unavailable');
    const load = (): { row: BoundEnvelope; encoded: string } | null => {
      const row = this.db.prepare(`SELECT p.record_id,p.workspace_id,p.project_id,p.content_kind,p.format_version,p.key_ref,p.nonce,p.ciphertext,p.auth_tag,p.created_at,
        r.owner_hash,r.state AS reservation_state,r.created_at AS reservation_created,r.updated_at AS reservation_updated
        FROM protected_payloads p JOIN protected_key_reservations r ON r.record_id=p.record_id AND r.workspace_id=p.workspace_id
          AND r.project_id=p.project_id AND r.key_ref=p.key_ref
        WHERE p.record_id=? AND p.workspace_id=? AND p.project_id=? AND p.content_kind='PROPOSAL' AND r.state='LINKED'`)
        .get(scope.recordId, scope.workspaceId, scope.projectId) as BoundEnvelope | undefined;
      if (!row || row.format_version !== 1 || !Buffer.isBuffer(row.nonce) || row.nonce.length !== 12
        || !Buffer.isBuffer(row.auth_tag) || row.auth_tag.length !== 16 || !Buffer.isBuffer(row.ciphertext)
        || row.ciphertext.length < 1 || row.ciphertext.length > 65536 || !/^[a-f0-9]{64}$/.test(row.owner_hash)
        || !/^pkey-[a-f0-9]{64}$/.test(row.key_ref)) return null;
      return { row, encoded: JSON.stringify([row.record_id, row.workspace_id, row.project_id, row.content_kind, row.format_version, row.key_ref,
        row.nonce.toString('base64'), row.ciphertext.toString('base64'), row.auth_tag.toString('base64'), row.created_at,
        row.owner_hash, row.reservation_state, row.reservation_created, row.reservation_updated]) };
    };
    let key: Buffer | null = null, first: Buffer | undefined, last: Buffer | undefined, plain: Buffer | undefined;
    try {
      const captured = load();
      if (!captured || captured.encoded !== expected || this.journal.inspect(scope) !== 'LINKED'
        || this.journal.recoveryReference(scope) !== captured.row.key_ref) throw new Error('unavailable');
      key = await this.readCopy(captured.row.key_ref);
      if (!key || this.db.inTransaction) throw new Error('unavailable');
      return this.db.transaction(() => {
        if (load()?.encoded !== expected || this.journal.inspect(scope) !== 'LINKED'
          || this.journal.recoveryReference(scope) !== captured.row.key_ref) throw new Error('unavailable');
        authenticatePayloadForRecovery(this.db, scope, captured.row.key_ref, key!);
        const row = captured.row;
        const cipher = createDecipheriv('aes-256-gcm', key!, row.nonce, { authTagLength: 16 });
        cipher.setAAD(Buffer.from(JSON.stringify([row.format_version, row.workspace_id, row.project_id,
          row.record_id, row.content_kind, row.key_ref, row.created_at]), 'utf8'));
        cipher.setAuthTag(row.auth_tag);
        first = cipher.update(row.ciphertext); last = cipher.final(); plain = Buffer.concat([first, last]);
        return plain.toString('utf8');
      }).immediate();
    } catch { throw new Error('Protected content unavailable'); }
    finally { key?.fill(0); first?.fill(0); last?.fill(0); plain?.fill(0); }
  }

  /** A tag is an integrity check, not proof that a user approved an operation. */
  async approvalTag(input: ProtectedPayloadScope, message: Buffer): Promise<string> {
    const scope = { ...input };
    if (scope.kind !== 'PROPOSAL' || !Buffer.isBuffer(message) || message.length < 1 || message.length > 8192 || this.db.inTransaction) {
      throw new Error('Protected approval unavailable');
    }
    const capturedMessage = Buffer.from(message);
    let key: Buffer | null = null;
    let derived: Buffer | undefined;
    try {
      if (this.journal.inspect(scope) !== 'LINKED') throw new Error('unavailable');
      const reference = this.journal.recoveryReference(scope);
      if (!reference) throw new Error('unavailable');
      key = await this.readCopy(reference);
      if (!key || this.db.inTransaction) throw new Error('unavailable');
      this.db.transaction(() => {
        if (this.journal.inspect(scope) !== 'LINKED' || this.journal.recoveryReference(scope) !== reference) throw new Error('unavailable');
        authenticatePayloadForRecovery(this.db, scope, reference, key!);
      }).immediate();
      derived = Buffer.from(hkdfSync('sha256', key, Buffer.from('super-assistant-approval-v1', 'utf8'), Buffer.from('protected-approval-mac', 'utf8'), 32));
      return 'hmac-sha256:' + createHmac('sha256', derived).update(capturedMessage).digest('hex');
    } catch { throw new Error('Protected approval unavailable'); }
    finally { key?.fill(0); derived?.fill(0); capturedMessage.fill(0); }
  }

  /** Internal prototype only: the caller owns and must dispose the derived key. */
  async receiptCodec(input: ProtectedPayloadScope): Promise<{
    seal: (plain: Buffer, aad: Buffer) => ReceiptEnvelope;
    open: (envelope: ReceiptEnvelope, aad: Buffer) => Buffer;
    dispose: () => void;
  }> {
    const scope = { ...input };
    if (scope.kind !== 'PROPOSAL' || this.db.inTransaction) throw new Error('Protected receipt unavailable');
    let key: Buffer | null = null;
    let derived: Buffer | undefined;
    try {
      if (this.journal.inspect(scope) !== 'LINKED') throw new Error('unavailable');
      const reference = this.journal.recoveryReference(scope);
      if (!reference) throw new Error('unavailable');
      key = await this.readCopy(reference);
      if (!key || this.db.inTransaction) throw new Error('unavailable');
      this.db.transaction(() => {
        if (this.journal.inspect(scope) !== 'LINKED' || this.journal.recoveryReference(scope) !== reference) throw new Error('unavailable');
        authenticatePayloadForRecovery(this.db, scope, reference, key!);
      }).immediate();
      derived = Buffer.from(hkdfSync('sha256', key, Buffer.from('super-assistant-receipt-v1'), Buffer.from('protected-receipt-aes-gcm'), 32));
      const receiptKey = derived;
      derived = undefined;
      let disposed = false;
      const check = (aad: Buffer) => {
        if (disposed || !Buffer.isBuffer(aad) || aad.length < 1 || aad.length > 8192) throw new Error('unavailable');
      };
      return {
        seal: (plain, aad) => {
          check(aad);
          if (!Buffer.isBuffer(plain) || plain.length < 1 || plain.length > 8192) throw new Error('unavailable');
          const nonce = randomBytes(12);
          const cipher = createCipheriv('aes-256-gcm', receiptKey, nonce, { authTagLength: 16 });
          cipher.setAAD(aad);
          const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
          return { nonce, ciphertext, authTag: cipher.getAuthTag() };
        },
        open: (envelope, aad) => {
          check(aad);
          if (!envelope || !Buffer.isBuffer(envelope.nonce) || envelope.nonce.length !== 12
            || !Buffer.isBuffer(envelope.authTag) || envelope.authTag.length !== 16
            || !Buffer.isBuffer(envelope.ciphertext) || envelope.ciphertext.length < 1 || envelope.ciphertext.length > 8192) throw new Error('unavailable');
          const cipher = createDecipheriv('aes-256-gcm', receiptKey, envelope.nonce, { authTagLength: 16 });
          cipher.setAAD(aad); cipher.setAuthTag(envelope.authTag);
          const first = cipher.update(envelope.ciphertext);
          try { return Buffer.concat([first, cipher.final()]); } finally { first.fill(0); }
        },
        dispose: () => { disposed = true; receiptKey.fill(0); }
      };
    } catch { throw new Error('Protected receipt unavailable'); }
    finally { key?.fill(0); derived?.fill(0); }
  }

  /** Authenticate the existing envelope and link it without any vault write or key creation. */
  async reconcile(input: ProtectedPayloadScope): Promise<'LINKED' | 'UNRESOLVED'> {
    const scope = { ...input };
    let key: Buffer | null = null;
    try {
      const reference = this.journal.recoveryReference(scope);
      if (!reference) return 'UNRESOLVED';
      key = await this.readCopy(reference);
      if (!key) return 'UNRESOLVED';
      this.journal.linkRecovered(scope, reference, key);
      return 'LINKED';
    } catch {
      return 'UNRESOLVED';
    } finally { key?.fill(0); }
  }
}
