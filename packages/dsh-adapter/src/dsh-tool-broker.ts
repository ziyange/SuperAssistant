export type DshCapability = 'shell' | 'filesystem' | 'network' | 'plugin';

export interface DshBrokerBinding { grant: string; snapshot: string; fence: number; budget: number; targets: Record<DshCapability, readonly string[]>; plugins: Record<string, string> }
export interface DshCapabilityRequest { capability: DshCapability; grant: string; snapshot: string; fence: number; target: string; pluginDigest?: string }
export interface DshBrokerRecord { request: DshCapabilityRequest; allowed: boolean; reason?: string }

export class DshToolBroker {
  private remaining: number;
  private readonly audit: DshBrokerRecord[] = [];
  constructor(private readonly binding: DshBrokerBinding) { this.remaining = binding.budget; }
  authorize(request: DshCapabilityRequest): { allowed: boolean; reason?: string } {
    const reason = request.grant !== this.binding.grant ? 'STALE_GRANT'
      : request.snapshot !== this.binding.snapshot ? 'STALE_SNAPSHOT'
      : request.fence !== this.binding.fence ? 'STALE_FENCE'
      : request.target.length === 0 ? 'INVALID_TARGET'
      : !this.binding.targets[request.capability].includes(request.target) ? 'TARGET_DENIED'
      : request.capability === 'plugin' && this.binding.plugins[request.target] !== request.pluginDigest ? 'PLUGIN_DENIED'
      : this.remaining < 1 ? 'BUDGET_EXHAUSTED' : undefined;
    const result = reason === undefined ? { allowed: true } : { allowed: false, reason };
    if (result.allowed) this.remaining -= 1;
    this.audit.push({ request, ...result });
    return result;
  }
  records(): readonly DshBrokerRecord[] { return this.audit; }
}
