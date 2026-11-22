/* eslint-disable no-unused-vars -- port arguments and constructor properties define the boundary. */
import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import type Database from 'better-sqlite3';

/** Implementations must create a new independent key and never overwrite an existing key reference. */
export interface ProtectedKeyProvider {
  create(): Promise<{ keyRef: string; key: Buffer }>;
  read(keyRef: string): Promise<Buffer | null>;
}
export interface ProtectedPayloadScope {
  workspaceId: string;
  projectId: string;
  recordId: string;
  kind: 'GOAL' | 'PROPOSAL';
}
interface Envelope {
  record_id: string; workspace_id: string; project_id: string; content_kind: string;
  format_version: number; key_ref: string; nonce: Buffer; ciphertext: Buffer;
  auth_tag: Buffer; created_at: string;
}
const identifier = /^[a-zA-Z0-9_-]{1,128}$/;
const keyReference = /^pkey-[0-9a-f]{64}$/;
function validateScope(scope: ProtectedPayloadScope): void {
  if (typeof scope.workspaceId !== 'string' || typeof scope.projectId !== 'string' || typeof scope.recordId !== 'string'
    || !identifier.test(scope.workspaceId) || !identifier.test(scope.projectId) || !identifier.test(scope.recordId)
    || !['GOAL', 'PROPOSAL'].includes(scope.kind)) throw new Error('Invalid protected payload scope');
}
function associatedData(row: Envelope): Buffer {
  return Buffer.from(JSON.stringify([row.format_version, row.workspace_id, row.project_id,
    row.record_id, row.content_kind, row.key_ref, row.created_at]), 'utf8');
}
function validateEnvelope(row: Envelope): void {
  validateScope({ workspaceId: row.workspace_id, projectId: row.project_id, recordId: row.record_id,
    kind: row.content_kind as ProtectedPayloadScope['kind'] });
  if (row.format_version !== 1 || typeof row.key_ref !== 'string' || !keyReference.test(row.key_ref)
    || !Buffer.isBuffer(row.nonce) || row.nonce.length !== 12
    || !Buffer.isBuffer(row.auth_tag) || row.auth_tag.length !== 16
    || !Buffer.isBuffer(row.ciphertext) || row.ciphertext.length < 1 || row.ciphertext.length > 65536
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.created_at)) {
    throw new Error('Invalid protected payload envelope');
  }
}

/** Isolated foundation. No production key provider or desktop entry point is configured here. */
export class ProtectedPayloadStore {
  constructor(private readonly db: Database.Database, private readonly keys: ProtectedKeyProvider) {}

  private assertScope(scope: ProtectedPayloadScope): void {
    validateScope(scope);
    const valid = this.db.prepare(`SELECT 1 FROM projects p JOIN workspaces w ON p.workspace_id = w.workspace_id
      WHERE w.workspace_id = ? AND p.project_id = ? AND w.owner_id = 'local-owner'
      AND w.status = 'ACTIVE' AND p.status = 'ACTIVE'`).get(scope.workspaceId, scope.projectId);
    if (!valid) throw new Error('Protected payload scope unavailable');
  }

  async create(scope: ProtectedPayloadScope, plaintext: string): Promise<void> {
    scope = { ...scope };
    this.assertScope(scope);
    if (typeof plaintext !== 'string' || Buffer.byteLength(plaintext, 'utf8') < 1
      || Buffer.byteLength(plaintext, 'utf8') > 65536
      || Buffer.from(plaintext, 'utf8').toString('utf8') !== plaintext) throw new Error('Invalid protected payload content');
    if (this.db.prepare('SELECT 1 FROM protected_payloads WHERE record_id = ?').get(scope.recordId)) {
      throw new Error('Protected payload already exists');
    }
    let created: { keyRef: string; key: Buffer };
    try { created = await this.keys.create(); }
    catch { throw new Error('Protected payload key provider unavailable'); }
    let keyMaterial: Buffer | undefined;
    try {
      if (typeof created.keyRef !== 'string' || !keyReference.test(created.keyRef) || !Buffer.isBuffer(created.key) || created.key.length !== 32) {
        throw new Error('Invalid protected payload key');
      }
      keyMaterial = Buffer.from(created.key);
      let verified: Buffer | null;
      try { verified = await this.keys.read(created.keyRef); }
      catch { throw new Error('Protected payload key provider unavailable'); }
      try {
        if (!Buffer.isBuffer(verified) || verified.length !== 32 || !timingSafeEqual(keyMaterial, verified)) {
          throw new Error('Protected payload key verification failed');
        }
      } finally {
        if (Buffer.isBuffer(verified) && verified !== created.key) verified.fill(0);
      }
      // Recheck local authority after awaiting the key provider.
      this.assertScope(scope);
      const row: Envelope = { record_id: scope.recordId, workspace_id: scope.workspaceId, project_id: scope.projectId,
        content_kind: scope.kind, format_version: 1, key_ref: created.keyRef, nonce: randomBytes(12),
        ciphertext: Buffer.alloc(0), auth_tag: Buffer.alloc(0), created_at: new Date().toISOString() };
      const cipher = createCipheriv('aes-256-gcm', keyMaterial, row.nonce, { authTagLength: 16 });
      cipher.setAAD(associatedData(row));
      row.ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      row.auth_tag = cipher.getAuthTag();
      this.db.transaction(() => {
        this.assertScope(scope);
        this.db.prepare(`INSERT INTO protected_payloads
          (record_id, workspace_id, project_id, content_kind, format_version, key_ref, nonce, ciphertext, auth_tag, created_at)
          VALUES (@record_id, @workspace_id, @project_id, @content_kind, @format_version, @key_ref, @nonce, @ciphertext, @auth_tag, @created_at)`).run(row);
      })();
    } finally {
      keyMaterial?.fill(0);
      if (Buffer.isBuffer(created.key)) created.key.fill(0);
    }
  }

  async read(scope: ProtectedPayloadScope): Promise<string> {
    scope = { ...scope };
    this.assertScope(scope);
    const row = this.db.prepare('SELECT * FROM protected_payloads WHERE record_id = ? AND workspace_id = ? AND project_id = ? AND content_kind = ?')
      .get(scope.recordId, scope.workspaceId, scope.projectId, scope.kind) as Envelope | undefined;
    if (!row) throw new Error('Protected payload unavailable');
    validateEnvelope(row);
    let key: Buffer | null;
    try { key = await this.keys.read(row.key_ref); }
    catch { throw new Error('Protected payload key provider unavailable'); }
    if (!key) throw new Error('Protected payload key unavailable');
    let first: Buffer | undefined;
    let last: Buffer | undefined;
    let combined: Buffer | undefined;
    try {
      if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Invalid protected payload key');
      return this.db.transaction(() => {
        this.assertScope(scope);
        const decipher = createDecipheriv('aes-256-gcm', key, row.nonce, { authTagLength: 16 });
        decipher.setAAD(associatedData(row));
        decipher.setAuthTag(row.auth_tag);
        first = decipher.update(row.ciphertext);
        last = decipher.final();
        combined = Buffer.concat([first, last]);
        return combined.toString('utf8');
      }).immediate();
    } catch {
      throw new Error('Protected payload authentication failed');
    } finally {
      if (Buffer.isBuffer(key)) key.fill(0);
      first?.fill(0); last?.fill(0); combined?.fill(0);
    }
  }
}
