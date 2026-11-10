import type { AuthorizationGrantStatus } from './authorization.js';

export interface ApprovedExecutionSnapshot {
  projectSnapshotVersion: string;
  agentVersion: string;
  functionVersion: string;
  capabilityVersion: string;
  baselineCommit: string;
  policyVersion: string;
  grantStatus: AuthorizationGrantStatus;
  grantExpiresAt: string;
}

export interface CurrentExecutionSnapshot extends ApprovedExecutionSnapshot {
  checkedAt: string;
}

export type PreflightReason = 'PROJECT_SNAPSHOT_CHANGED' | 'AGENT_VERSION_CHANGED' | 'FUNCTION_VERSION_CHANGED' | 'CAPABILITY_VERSION_CHANGED' | 'BASELINE_COMMIT_CHANGED' | 'POLICY_CHANGED' | 'GRANT_NOT_ISSUED' | 'GRANT_EXPIRED' | 'INVALID_TIME' | 'GRANT_CHANGED';
export type PreflightResult = { status: 'READY'; reasons: [] } | { status: 'STALE'; reasons: PreflightReason[] };

export function evaluatePreflight(approved: ApprovedExecutionSnapshot, current: CurrentExecutionSnapshot): PreflightResult {
  const reasons: PreflightReason[] = [];
  if (approved.projectSnapshotVersion !== current.projectSnapshotVersion) reasons.push('PROJECT_SNAPSHOT_CHANGED');
  if (approved.agentVersion !== current.agentVersion) reasons.push('AGENT_VERSION_CHANGED');
  if (approved.functionVersion !== current.functionVersion) reasons.push('FUNCTION_VERSION_CHANGED');
  if (approved.capabilityVersion !== current.capabilityVersion) reasons.push('CAPABILITY_VERSION_CHANGED');
  if (approved.baselineCommit !== current.baselineCommit) reasons.push('BASELINE_COMMIT_CHANGED');
  if (approved.policyVersion !== current.policyVersion) reasons.push('POLICY_CHANGED');
  if (approved.grantStatus !== 'ISSUED' || current.grantStatus !== 'ISSUED') reasons.push('GRANT_NOT_ISSUED');
  const timestamp = (value: unknown): number => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return Number.NaN;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : Number.NaN;
  };
  const approvedExpiry = timestamp(approved.grantExpiresAt);
  const currentExpiry = timestamp(current.grantExpiresAt);
  const checkedAt = timestamp(current.checkedAt);
  if (![approvedExpiry, currentExpiry, checkedAt].every(Number.isFinite)) reasons.push('INVALID_TIME');
  else {
    if (approvedExpiry !== currentExpiry) reasons.push('GRANT_CHANGED');
    if (currentExpiry <= checkedAt) reasons.push('GRANT_EXPIRED');
  }
  return reasons.length === 0 ? { status: 'READY', reasons: [] } : { status: 'STALE', reasons };
}
