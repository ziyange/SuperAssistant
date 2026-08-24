import { createHash } from 'node:crypto';
export type GovernedRecordClass = 'ATTEMPT' | 'GRANT' | 'LEGAL_HOLD' | 'ROLLBACK' | 'EVIDENCE' | 'AUDIT' | 'RETENTION';
export interface GovernedRecord { id: string; class: GovernedRecordClass; payload: string }
export class GovernedRecordInventory {
  build(input: Readonly<{ workspaceId: string; records: readonly GovernedRecord[] }>) {
    if (input.workspaceId.length === 0 || input.records.some(record => record.id.length === 0)) throw new Error('GOVERNED_INVENTORY_INVALID');
    const records = [...input.records].sort((a, b) => a.class.localeCompare(b.class) || a.id.localeCompare(b.id));
    const digest = `sha256:${createHash('sha256').update(records.map(record => `${record.class}:${record.id}:${record.payload}`).join('|')).digest('hex')}` as const;
    return Object.freeze({ workspaceId: input.workspaceId, classes: Object.freeze([...new Set(records.map(record => record.class))]), digest, records: Object.freeze(records.map(record => Object.freeze({ ...record }))) });
  }
}
