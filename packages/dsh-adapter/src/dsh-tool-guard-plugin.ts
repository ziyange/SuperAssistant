/* eslint-disable no-unused-vars -- public ToolRuntime callback parameter names are contract vocabulary. */
import { createDshToolGuard, type DshGuardBroker, type DshGuardExecution } from './dsh-tool-guard.js';
import { createDshAttemptPolicy, type DshAttemptPolicy, type DshAttemptPolicyInput } from './dsh-attempt-policy.js';
import { DshToolBroker } from './dsh-tool-broker.js';
import type { DshCapability } from './dsh-tool-broker.js';
import type { Context } from '@deepseek-ai/cordis';
import type { ToolExecution } from '@deepseek-ai/dsh-tools';

export const name = 'super-assistant-dsh-tool-guard';
export const inject = ['tools'] as const;

export interface PublicDshToolRuntime<TExecution> { guard(guard: (execution: Readonly<TExecution>) => string | undefined): () => void }

export function mountDshToolGuard<TExecution>(runtime: PublicDshToolRuntime<TExecution>, broker: DshGuardBroker, project: (execution: Readonly<TExecution>) => DshGuardExecution): () => void {
  const guard = createDshToolGuard(broker);
  return runtime.guard(execution => guard(project(execution)));
}

export interface DshGuardProjection { toolName: string; target: string; pluginDigest?: string }
export interface DshGuardToolBinding { target?: string; targetArgument?: string; pluginDigestArgument?: string }
export interface DshGuardPluginConfig { policy: DshAttemptPolicyInput; bindings: Readonly<Record<string, DshGuardToolBinding>> }

function capabilityFor(toolName: string): DshCapability | undefined {
  if (toolName === 'bash' || toolName === 'shell') return 'shell';
  if (toolName.startsWith('fs')) return 'filesystem';
  if (toolName.startsWith('web') || toolName === 'network') return 'network';
  if (toolName === 'plugin') return 'plugin';
  return undefined;
}

export function mountImmutableDshToolGuard<TExecution>(runtime: PublicDshToolRuntime<TExecution>, policyInput: DshAttemptPolicyInput | DshAttemptPolicy, project: (execution: Readonly<TExecution>) => DshGuardProjection): () => void {
  const policy = createDshAttemptPolicy(policyInput);
  const broker = new DshToolBroker({
    grant: policy.grantRef,
    snapshot: String(policy.projectSnapshotVersion),
    fence: policy.leaseFence,
    budget: policy.budget,
    targets: {
      shell: policy.capabilityBindings.shell.targets,
      filesystem: policy.capabilityBindings.filesystem.targets,
      network: policy.capabilityBindings.network.targets,
      plugin: policy.capabilityBindings.plugin.targets
    },
    plugins: policy.capabilityBindings.plugin.plugins ?? {}
  });
  return mountDshToolGuard(runtime, broker, execution => {
    const projected = project(execution);
    const capability = capabilityFor(projected.toolName);
    const bound = capability !== undefined && policy.capabilityBindings[capability].toolNames.includes(projected.toolName);
    return { ...projected, toolName: bound ? projected.toolName : '__undeclared__', grant: policy.grantRef, snapshot: String(policy.projectSnapshotVersion), fence: policy.leaseFence };
  });
}

function stringArgument(argumentsValue: unknown, key: string | undefined): string | undefined {
  if (key === undefined || typeof argumentsValue !== 'object' || argumentsValue === null) return undefined;
  const value = (argumentsValue as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

export function apply(ctx: Context, config: DshGuardPluginConfig): () => void {
  if (!config || typeof config !== 'object' || !config.policy || !config.bindings) throw new TypeError('INVALID_DSH_GUARD_CONFIG');
  return mountImmutableDshToolGuard(ctx.tools, config.policy, (execution: Readonly<ToolExecution>) => {
    const binding = config.bindings[execution.name];
    if (!binding) return { toolName: '__undeclared__', target: '' };
    const target = binding.target ?? stringArgument(execution.arguments, binding.targetArgument);
    if (!target) return { toolName: '__undeclared__', target: '' };
    const pluginDigest = stringArgument(execution.arguments, binding.pluginDigestArgument);
    return pluginDigest === undefined ? { toolName: execution.name, target } : { toolName: execution.name, target, pluginDigest };
  });
}
