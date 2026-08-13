import { createHash } from 'node:crypto';
import type { GoalAction } from './routing.js';

export interface ProposalVersionInput {
  proposalVersionId: string;
  workspaceId: string;
  projectId: string;
  agentId: string;
  functionId: string;
  objective: string;
  actions: readonly GoalAction[];
  projectSnapshotVersion: string;
  agentVersion: string;
  functionVersion: string;
  capabilityVersion: string;
  baselineCommit: string;
  expiresAt: string;
  createdAt: string;
}

export interface ProposalVersion extends ProposalVersionInput {
  digest: `sha256:${string}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
  }
  throw new TypeError('Proposal canonical JSON accepts JSON values only');
}

export function createProposalVersion(input: ProposalVersionInput): ProposalVersion {
  const immutable = { ...input, actions: [...input.actions] };
  const digest = `sha256:${createHash('sha256').update(canonicalJson(immutable), 'utf8').digest('hex')}` as const;
  return { ...immutable, digest };
}
