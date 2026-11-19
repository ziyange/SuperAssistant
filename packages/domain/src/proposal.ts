import { createHash } from 'node:crypto';
import type { GoalAction } from './routing.js';
import { parseH1ProposalCandidate, type H1ProposalCandidate } from './proposal-candidate.js';

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
  fullReview?: H1ProposalCandidate;
}

export interface ProposalVersion extends ProposalVersionInput {
  digest: `sha256:${string}`;
}

function canonicalJson(value: unknown, strictUnicode: boolean): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'string') {
    if (strictUnicode && /[\uD800-\uDFFF]/u.test(value)) throw new TypeError('Invalid Unicode in full Proposal review');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item, strictUnicode)).join(',')}]`;
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${canonicalJson(key, strictUnicode)}:${canonicalJson(object[key], strictUnicode)}`).join(',')}}`;
  }
  throw new TypeError('Proposal canonical JSON accepts JSON values only');
}

export function createProposalVersion(input: ProposalVersionInput): ProposalVersion {
  const immutable = { ...input, actions: [...input.actions] };
  const digest = `sha256:${createHash('sha256').update(canonicalJson(immutable, input.fullReview !== undefined), 'utf8').digest('hex')}` as const;
  return { ...immutable, digest };
}

export function createH1ReviewedProposal(proposalVersionId: string, input: unknown): ProposalVersion {
  const fullReview = parseH1ProposalCandidate(input);
  return createProposalVersion({
    proposalVersionId, fullReview, workspaceId: fullReview.workspaceId, projectId: fullReview.projectId,
    agentId: fullReview.agentId, functionId: fullReview.functionId, objective: fullReview.objective, actions: fullReview.allowedActions,
    projectSnapshotVersion: fullReview.projectSnapshotVersion, agentVersion: fullReview.agentVersion, functionVersion: fullReview.functionVersion,
    capabilityVersion: fullReview.capabilityVersion, baselineCommit: fullReview.baselineCommit, createdAt: fullReview.createdAt, expiresAt: fullReview.expiresAt
  });
}
