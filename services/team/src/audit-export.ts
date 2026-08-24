import { createHash } from 'node:crypto';
interface AuditRecord { id: string; payload: string }
interface AuditManifest { workspaceId: string; actor: string; from: number; to: number; recordCount: number; merkleRoot: `sha256:${string}` }
function root(records: readonly AuditRecord[]): `sha256:${string}` {
  const value = [...records].sort((a, b) => a.id.localeCompare(b.id)).map(record => `${record.id}:${createHash('sha256').update(record.payload).digest('hex')}`).join('|');
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
export interface TeamAuditExport { manifest: AuditManifest; records: readonly AuditRecord[] }
export class TeamAuditExporter {
  export(input: Readonly<{ workspaceId: string; actor: string; from: number; to: number; records: readonly AuditRecord[] }>): Readonly<TeamAuditExport> {
    if (input.workspaceId.length === 0 || input.actor.length === 0 || input.from > input.to || input.records.some(record => /(?:secret|password|token|authorization)/i.test(record.payload))) throw new Error('AUDIT_SCOPE_INVALID');
    return Object.freeze({ manifest: Object.freeze({ workspaceId: input.workspaceId, actor: input.actor, from: input.from, to: input.to, recordCount: input.records.length, merkleRoot: root(input.records) }), records: Object.freeze(input.records.map(record => Object.freeze({ ...record }))) });
  }
  verify(exported: Readonly<TeamAuditExport>): boolean { return exported.manifest.recordCount === exported.records.length && exported.manifest.merkleRoot === root(exported.records); }
}
