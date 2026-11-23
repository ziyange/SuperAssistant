/* eslint-disable no-unused-vars -- port parameter names are part of the public DSH service contract. */
export interface DshCancellationHost { cancel(attemptId: string, terminate: () => Promise<boolean>): Promise<{ cancelled: boolean }> }
export interface DshLeasePort { release(leaseId: string, fencingToken: number, releasedAt: string): boolean }
export interface DshBrokerPort { authorize(request: { capability: 'shell' | 'filesystem' | 'network' | 'plugin'; grant: string; snapshot: string; fence: number; target: string; pluginDigest?: string }): { allowed: boolean; reason?: string } }

export class DshAdapterService {
  constructor(private readonly host: DshCancellationHost, private readonly leases: DshLeasePort, private readonly broker?: DshBrokerPort) {}
  async cancel(_input: { attemptId: string; leaseId: string; fencingToken: number; now: string }, _terminate: () => Promise<boolean>): Promise<{ cancelled: boolean; leaseReleased: boolean }> {
    // No owned-tree termination proof or atomic fenced release exists here.
    // A caller-supplied boolean is not evidence and must not trigger effects.
    return { cancelled: false, leaseReleased: false };
  }
  async executeCapability(request: { capability: 'shell' | 'filesystem' | 'network' | 'plugin'; grant: string; snapshot: string; fence: number; target: string; pluginDigest?: string }, effect: () => Promise<void>): Promise<{ executed: boolean; reason?: string }> {
    if (!this.broker) return { executed: false, reason: 'BROKER_UNAVAILABLE' };
    const decision = this.broker.authorize(request);
    if (!decision.allowed) return { executed: false, reason: decision.reason ?? 'BROKER_DENIED' };
    await effect();
    return { executed: true };
  }
}
