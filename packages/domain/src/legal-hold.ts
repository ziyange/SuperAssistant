import { createHash } from 'node:crypto';
export interface RetentionInput { recordId: string; expiresAt: number; now: number; legalHold: boolean; stateKnown: boolean; dryRunApproved: boolean }
export function evaluateRetention(input: Readonly<RetentionInput>): Readonly<{ action: 'PRESERVE'; reason: 'LEGAL_HOLD' | 'STATE_UNKNOWN' | 'NOT_EXPIRED' | 'DRY_RUN_REQUIRED' } | { action: 'DELETE'; auditDigest: `sha256:${string}` }> {
  if (input.legalHold) return { action: 'PRESERVE', reason: 'LEGAL_HOLD' };
  if (!input.stateKnown) return { action: 'PRESERVE', reason: 'STATE_UNKNOWN' };
  if (input.now < input.expiresAt) return { action: 'PRESERVE', reason: 'NOT_EXPIRED' };
  if (!input.dryRunApproved) return { action: 'PRESERVE', reason: 'DRY_RUN_REQUIRED' };
  return { action: 'DELETE', auditDigest: `sha256:${createHash('sha256').update(`${input.recordId}:${input.expiresAt}:${input.now}`).digest('hex')}` };
}
