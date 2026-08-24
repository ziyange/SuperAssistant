import { createHash } from 'node:crypto';
export class RetentionService {
  private readonly dryRuns = new Map<string, string>();
  recordDryRun(recordId: string, policyVersion: string): void { if (recordId.length === 0 || policyVersion.length === 0) throw new Error('RETENTION_DRY_RUN_INVALID'); this.dryRuns.set(recordId, policyVersion); }
  plan(input: Readonly<{ recordId: string; expiresAt: number; now: number; legalHold: boolean; stateKnown: boolean }>): Readonly<{ action: 'PRESERVE'; reason: 'LEGAL_HOLD' | 'STATE_UNKNOWN' | 'NOT_EXPIRED' | 'DRY_RUN_REQUIRED' } | { action: 'DELETE'; auditDigest: `sha256:${string}` }> {
    if (input.legalHold) return { action: 'PRESERVE', reason: 'LEGAL_HOLD' };
    if (!input.stateKnown) return { action: 'PRESERVE', reason: 'STATE_UNKNOWN' };
    if (input.now < input.expiresAt) return { action: 'PRESERVE', reason: 'NOT_EXPIRED' };
    const policy = this.dryRuns.get(input.recordId);
    if (policy === undefined) return { action: 'PRESERVE', reason: 'DRY_RUN_REQUIRED' };
    return { action: 'DELETE', auditDigest: `sha256:${createHash('sha256').update(`${input.recordId}:${policy}:${input.expiresAt}:${input.now}`).digest('hex')}` };
  }
}
