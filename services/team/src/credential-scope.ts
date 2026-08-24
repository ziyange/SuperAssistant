export interface CredentialMetadata { ref: `cred:${string}`; owner: string; workspaceId: string; rotationDueAt: number }

export class CredentialScopeStore {
  private readonly records = new Map<string, CredentialMetadata>();
  register(record: CredentialMetadata): void {
    if (!/^cred:[a-z0-9-]+$/.test(record.ref) || record.owner.length === 0 || record.workspaceId.length === 0 || !Number.isFinite(record.rotationDueAt)) throw new Error('CREDENTIAL_REFERENCE_INVALID');
    if (this.records.has(record.ref)) throw new Error('CREDENTIAL_REFERENCE_EXISTS');
    this.records.set(record.ref, Object.freeze({ ...record }));
  }
  lookup(ref: string, owner: string, workspaceId: string): CredentialMetadata | undefined {
    const record = this.records.get(ref);
    return record !== undefined && record.owner === owner && record.workspaceId === workspaceId ? record : undefined;
  }
}
