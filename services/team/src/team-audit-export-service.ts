import { GovernedRecordInventory, type GovernedRecord } from './governed-record-inventory.js';
export interface GovernedRecordReader { listGovernedRecords(workspaceId: string, from?: number, to?: number): Promise<readonly GovernedRecord[]> }
export class TeamAuditExportService {
  private readonly inventory = new GovernedRecordInventory();
  constructor(private readonly reader: GovernedRecordReader) {}
  async export(input: Readonly<{ actor: string; workspaceId: string; from: number; to: number }>) {
    if (input.actor.length === 0 || input.workspaceId.length === 0 || input.from > input.to) throw new Error('AUDIT_SCOPE_INVALID');
    const inventory = this.inventory.build({ workspaceId: input.workspaceId, records: await this.reader.listGovernedRecords(input.workspaceId, input.from, input.to) });
    return Object.freeze({ manifest: Object.freeze({ actor: input.actor, workspaceId: input.workspaceId, from: input.from, to: input.to, recordCount: inventory.records.length, digest: inventory.digest }), records: inventory.records });
  }
  verify(exported: Readonly<{ manifest: { workspaceId: string; recordCount: number; digest: string }; records: readonly GovernedRecord[] }>): boolean {
    const inventory = this.inventory.build({ workspaceId: exported.manifest.workspaceId, records: exported.records });
    return exported.manifest.recordCount === exported.records.length && exported.manifest.digest === inventory.digest;
  }
}
