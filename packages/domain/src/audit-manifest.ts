import { createHash } from 'node:crypto';
export interface AuditRecord { id: string; payload: string }
export interface AuditManifest { workspaceId: string; actor: string; from: number; to: number; recordCount: number; merkleRoot: `sha256:${string}` }
function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function root(records: readonly AuditRecord[]): `sha256:${string}` { return `sha256:${hash([...records].sort((a, b) => a.id.localeCompare(b.id)).map(record => `${record.id}:${hash(record.payload)}`).join('|'))}`; }
function assertInput(input: Readonly<{ workspaceId: string; actor: string; from: number; to: number; records: readonly AuditRecord[] }>): void {
  if (input.workspaceId.length === 0 || input.actor.length === 0 || !Number.isFinite(input.from) || !Number.isFinite(input.to) || input.from > input.to) throw new Error('AUDIT_SCOPE_INVALID');
  if (input.records.some(record => record.id.length === 0 || /(?:secret|password|token|authorization)/i.test(record.payload))) throw new Error('AUDIT_SECRET_REDACTION_REQUIRED');
}
export function createAuditManifest(input: Readonly<{ workspaceId: string; actor: string; from: number; to: number; records: readonly AuditRecord[] }>): Readonly<AuditManifest> {
  assertInput(input);
  return Object.freeze({ workspaceId: input.workspaceId, actor: input.actor, from: input.from, to: input.to, recordCount: input.records.length, merkleRoot: root(input.records) });
}
export function verifyAuditManifest(manifest: Readonly<AuditManifest>, records: readonly AuditRecord[]): boolean { return manifest.recordCount === records.length && manifest.merkleRoot === root(records); }
