import { createHash } from 'node:crypto';
import type { DshCapability } from './dsh-tool-broker.js';

export interface DshCapabilityBindingInput {
  toolNames: readonly string[];
  targets: readonly string[];
  plugins?: Readonly<Record<string, string>>;
}

export interface DshAttemptPolicyInput {
  attemptId: string;
  functionRef: { id: string; version: string };
  proposalDigest: string;
  grantRef: string;
  projectSnapshotVersion: number;
  baselineCommit: string;
  leaseFence: number;
  capabilityBindings: Readonly<Record<DshCapability, DshCapabilityBindingInput>>;
  budget: number;
  runtimeProfileDigest: string;
}

export interface DshAttemptPolicy extends Readonly<Omit<DshAttemptPolicyInput, 'capabilityBindings'>> {
  readonly capabilityBindings: Readonly<Record<DshCapability, Readonly<DshCapabilityBindingInput>>>;
  readonly policyDigest: `sha256:${string}`;
}

const capabilities: readonly DshCapability[] = ['shell', 'filesystem', 'network', 'plugin'];

function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  throw new TypeError('POLICY_NOT_JSON');
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function safeString(value: string): string {
  if (value.length === 0 || /(?:secret|password|bearer|access[_-]?token)/i.test(value)) throw new TypeError('SECRET_POLICY_VALUE');
  return value;
}

function sortedStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.map(safeString))].sort();
}

function binding(input: DshCapabilityBindingInput): Readonly<DshCapabilityBindingInput> {
  const pluginEntries: readonly (readonly [string, string])[] = input.plugins === undefined ? [] : Object.entries(input.plugins).map(([name, digest]) => [safeString(name), safeString(digest)] as const);
  const plugins = input.plugins === undefined ? undefined : Object.fromEntries([...pluginEntries].sort(([left], [right]) => left.localeCompare(right)));
  const result = { toolNames: sortedStrings(input.toolNames), targets: sortedStrings(input.targets), ...(plugins === undefined ? {} : { plugins }) };
  if (result.toolNames.length === 0 || result.targets.length === 0) throw new TypeError('POLICY_BINDING_REQUIRED');
  return freeze(result);
}

export function createDshAttemptPolicy(input: DshAttemptPolicyInput): DshAttemptPolicy {
  if (!Number.isInteger(input.projectSnapshotVersion) || input.projectSnapshotVersion < 1 || !Number.isInteger(input.leaseFence) || input.leaseFence < 1 || !Number.isInteger(input.budget) || input.budget < 0) throw new TypeError('POLICY_NUMERIC_BINDING_INVALID');
  const capabilityBindings = Object.fromEntries(capabilities.map(capability => [capability, binding(input.capabilityBindings[capability])])) as Record<DshCapability, Readonly<DshCapabilityBindingInput>>;
  const policy = {
    attemptId: safeString(input.attemptId),
    functionRef: freeze({ id: safeString(input.functionRef.id), version: safeString(input.functionRef.version) }),
    proposalDigest: safeString(input.proposalDigest),
    grantRef: safeString(input.grantRef),
    projectSnapshotVersion: input.projectSnapshotVersion,
    baselineCommit: safeString(input.baselineCommit),
    leaseFence: input.leaseFence,
    capabilityBindings: freeze(capabilityBindings),
    budget: input.budget,
    runtimeProfileDigest: safeString(input.runtimeProfileDigest)
  };
  const policyDigest = `sha256:${createHash('sha256').update(canonical(policy), 'utf8').digest('hex')}` as const;
  return freeze({ ...policy, policyDigest });
}
