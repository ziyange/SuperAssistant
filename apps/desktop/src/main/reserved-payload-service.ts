/* eslint-disable no-unused-vars -- port arguments and constructor properties define the main-process boundary. */
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import type Database from 'better-sqlite3';
import { ProtectedKeyReservations } from './protected-key-reservations.js';
import { ProtectedPayloadStore, type ProtectedKeyProvider, type ProtectedPayloadScope } from './protected-payload-store.js';

const vaultDeadlineMs = 10_000;
const maxOutstandingVaultCalls = 4;
let outstandingVaultCalls = 0;
function boundedVaultCall<T>(operation: () => Promise<T>): Promise<T> {
  if (outstandingVaultCalls >= maxOutstandingVaultCalls) return Promise.reject(new Error('Vault capacity exhausted'));
  outstandingVaultCalls++;
  const actual = Promise.resolve().then(operation).then(
    value => { outstandingVaultCalls--; return value; },
    error => { outstandingVaultCalls--; throw error; }
  );
  return new Promise<T>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => reject(new Error('Vault operation timed out')), vaultDeadlineMs);
    actual.then(value => { globalThis.clearTimeout(timeout); resolve(value); }, error => { globalThis.clearTimeout(timeout); reject(error); });
  });
}

/** The vault must reject overwrites. Returned buffers may be borrowed and are never modified. */
export interface ReservedVault {
  create(keyRef: string): Promise<Buffer>;
  read(keyRef: string): Promise<Buffer | null>;
}

/** Isolated orchestration only: never selected by the renderer or production desktop. */
export class ReservedPayloadService {
  constructor(private readonly db: Database.Database, private readonly journal: ProtectedKeyReservations,
    private readonly vault: ReservedVault) {}

  private async readCopy(ref: string): Promise<Buffer | null> {
    const value = await boundedVaultCall(() => this.vault.read(ref));
    if (value === null) return null;
    if (!Buffer.isBuffer(value) || value.length !== 32) throw new Error('Invalid vault key');
    return Buffer.from(value);
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
          key = await boundedVaultCall(() => this.vault.create(keyRef));
          if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Invalid key');
          owned = Buffer.from(key);
          readback = await this.readCopy(keyRef);
          if (!Buffer.isBuffer(readback) || readback.length !== 32 || !timingSafeEqual(owned, readback)) {
            throw new Error('Key readback failed');
          }
          this.journal.confirmStored(scope, ownerToken);
          const result = owned;
          owned = undefined;
          return { keyRef, key: result };
        } catch {
          throw new Error('Vault key operation failed');
        } finally {
          owned?.fill(0);
          if (Buffer.isBuffer(readback)) readback.fill(0);
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
}
