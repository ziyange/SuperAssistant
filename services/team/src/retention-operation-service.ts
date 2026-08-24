export interface RetentionRecord { recordId: string; workspaceId: string; expiresAt: number; legalHold: boolean; stateKnown: boolean }
export interface RetentionOperationStore { inspect(recordId: string): Promise<RetentionRecord | undefined>; recordDryRun(input: Readonly<{ actor: string; workspaceId: string; recordId: string; policyVersion: string; now: number }>): Promise<void>; executeAuthorizedDelete(input: Readonly<{ actor: string; workspaceId: string; recordId: string; policyVersion: string; authorizationRef: string; now: number }>): Promise<{ deleted: true }> }
export class RetentionOperationService {
  constructor(private readonly store: RetentionOperationStore) {}
  async dryRun(input: Readonly<{ actor: string; workspaceId: string; recordId: string; policyVersion: string; now: number }>) {
    const record = await this.store.inspect(input.recordId);
    if (record === undefined || record.workspaceId !== input.workspaceId || record.legalHold) return { action: 'PRESERVE' as const, reason: 'LEGAL_HOLD' as const };
    if (!record.stateKnown) return { action: 'PRESERVE' as const, reason: 'STATE_UNKNOWN' as const };
    if (input.now < record.expiresAt) return { action: 'PRESERVE' as const, reason: 'NOT_EXPIRED' as const };
    await this.store.recordDryRun(input); return { action: 'ELIGIBLE' as const };
  }
  async execute(input: Readonly<{ actor: string; workspaceId: string; recordId: string; policyVersion: string; authorizationRef: string; now: number }>) {
    if (!/^grant:/.test(input.authorizationRef)) throw new Error('RETENTION_AUTHORIZATION_REQUIRED');
    const record = await this.store.inspect(input.recordId);
    if (record === undefined || record.workspaceId !== input.workspaceId || record.legalHold || !record.stateKnown || input.now < record.expiresAt) throw new Error('RETENTION_EXECUTION_DENIED');
    return this.store.executeAuthorizedDelete(input);
  }
}
