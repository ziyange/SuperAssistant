/* eslint-disable no-unused-vars -- public guard request parameter names are contract vocabulary. */
import type { DshCapability } from './dsh-tool-broker.js';

export interface DshGuardExecution { toolName: string; target: string; grant: string; snapshot: string; fence: number; pluginDigest?: string }
export interface DshGuardBroker { authorize(request: { capability: DshCapability; target: string; grant: string; snapshot: string; fence: number; pluginDigest?: string }): { allowed: boolean; reason?: string } }

function capabilityFor(toolName: string): DshCapability | undefined {
  if (toolName === 'bash' || toolName === 'shell') return 'shell';
  if (toolName.startsWith('fs')) return 'filesystem';
  if (toolName.startsWith('web') || toolName === 'network') return 'network';
  if (toolName === 'plugin') return 'plugin';
  return undefined;
}

export function createDshToolGuard(broker: DshGuardBroker): (execution: DshGuardExecution) => string | undefined {
  return execution => {
    const capability = capabilityFor(execution.toolName);
    if (!capability) return 'UNDECLARED_DSH_TOOL';
    const decision = broker.authorize({ capability, target: execution.target, grant: execution.grant, snapshot: execution.snapshot, fence: execution.fence, ...(execution.pluginDigest === undefined ? {} : { pluginDigest: execution.pluginDigest }) });
    return decision.allowed ? undefined : decision.reason ?? 'BROKER_DENIED';
  };
}
