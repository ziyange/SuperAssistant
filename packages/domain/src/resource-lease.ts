export type ResourceLeaseState = 'ACTIVE' | 'RELEASING' | 'RELEASED' | 'EXPIRED' | 'QUARANTINED';
export interface ResourceLease { leaseId: string; resourceKey: string; attemptId: string; fencingToken: number; expiresAt: string; state: ResourceLeaseState; }
export function acquireResourceLease(input: Omit<ResourceLease, 'state'>): ResourceLease { return { ...input, state: 'ACTIVE' }; }
export function canWriteWithFence(lease: ResourceLease, presentedToken: number): boolean { return lease.state === 'ACTIVE' && lease.fencingToken === presentedToken; }
export function releaseResourceLease(lease: ResourceLease): ResourceLease { return { ...lease, state: 'RELEASED' }; }
