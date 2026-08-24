/* eslint-disable no-unused-vars -- Credential store port parameters are public contract vocabulary. */
export interface CredentialReferenceRecord {
  ref: `cred:${string}`;
  owner: string;
  workspaceId: string;
  rotationDueAt: number;
}

export interface CredentialReferenceView {
  ref: `cred:${string}`;
  rotationDueAt: number;
}

/** Stores metadata only; a credential value is never accepted by this API. */
export class CredentialReferenceService {
  private readonly records = new Map<string, CredentialReferenceRecord>();

  register(record: CredentialReferenceRecord): void {
    if (!/^cred:[a-z0-9-]+$/.test(record.ref) || record.owner.length === 0 || record.workspaceId.length === 0 || !Number.isFinite(record.rotationDueAt)) {
      throw new Error('CREDENTIAL_REFERENCE_INVALID');
    }
    if (this.records.has(record.ref)) throw new Error('CREDENTIAL_REFERENCE_EXISTS');
    this.records.set(record.ref, Object.freeze({ ...record }));
  }

  resolve(ref: string, context: Readonly<{ actor: string; workspaceId: string }>): CredentialReferenceView | undefined {
    const record = this.records.get(ref);
    if (record === undefined || record.owner !== context.actor || record.workspaceId !== context.workspaceId) return undefined;
    return { ref: record.ref, rotationDueAt: record.rotationDueAt };
  }
}

export interface CredentialReferenceStore {
  registerCredential(record: CredentialReferenceRecord): Promise<void>;
  findCredential(ref: string): Promise<CredentialReferenceRecord | undefined>;
}

export class PersistentCredentialReferenceService {
  constructor(private readonly store: CredentialReferenceStore) {}

  async register(record: CredentialReferenceRecord): Promise<void> {
    if (!/^cred:[a-z0-9-]+$/.test(record.ref) || record.owner.length === 0 || record.workspaceId.length === 0 || !Number.isFinite(record.rotationDueAt)) {
      throw new Error('CREDENTIAL_REFERENCE_INVALID');
    }
    await this.store.registerCredential(record);
  }

  async resolve(ref: string, context: Readonly<{ actor: string; workspaceId: string }>): Promise<CredentialReferenceView | undefined> {
    const record = await this.store.findCredential(ref);
    if (record === undefined || record.owner !== context.actor || record.workspaceId !== context.workspaceId) return undefined;
    return { ref: record.ref, rotationDueAt: record.rotationDueAt };
  }
}
