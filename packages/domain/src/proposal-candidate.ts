import { z } from 'zod';
import { classifyGoalActions, isGoalAction, type GoalAction } from './routing.js';

const nonblank = z.string().refine(value => value.trim().length > 0, 'A nonblank value is required.');
const action = z.custom<GoalAction>(isGoalAction, 'Unknown action.');
const utcTimestamp = z.string().refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}, 'Expected a valid canonical UTC timestamp.');
const nonnegativeLimit = z.number().int().safe().nonnegative();
const workItem = z.strictObject({
  id: nonblank,
  projectId: nonblank,
  agentId: nonblank,
  functionId: nonblank,
  objective: nonblank,
  required: z.literal(true),
  dependencies: z.array(nonblank).length(0)
});
const candidateSchema = z.strictObject({
  objective: nonblank,
  workspaceId: nonblank,
  projectId: nonblank,
  agentId: nonblank,
  functionId: nonblank,
  projectSnapshotVersion: nonblank,
  agentVersion: nonblank,
  functionVersion: nonblank,
  capabilityVersion: nonblank,
  baselineCommit: nonblank,
  createdAt: utcTimestamp,
  expiresAt: utcTimestamp,
  deadlineAt: utcTimestamp,
  budget: z.strictObject({
    maxDurationMs: z.number().int().safe().positive(),
    maxTokens: nonnegativeLimit.nullable(),
    maxCost: z.strictObject({ minorUnits: nonnegativeLimit, currency: z.string().regex(/^[A-Z]{3}$/) }).nullable()
  }),
  capabilities: z.array(z.strictObject({ id: nonblank, version: nonblank })).min(1),
  workItems: z.array(workItem).length(1),
  resources: z.array(z.strictObject({ key: nonblank, intent: z.enum(['READ', 'WRITE']) })).min(1),
  allowedActions: z.array(action).min(1),
  forbiddenActions: z.array(action),
  reconfirmationTriggers: z.array(nonblank).min(1),
  risk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  acceptanceCriteria: z.array(z.strictObject({ criterion: nonblank, evidence: nonblank })).min(1)
}).superRefine((candidate, context) => {
  const createdAt = Date.parse(candidate.createdAt);
  const expiresAt = Date.parse(candidate.expiresAt);
  const deadlineAt = Date.parse(candidate.deadlineAt);
  if (Number.isFinite(createdAt) && Number.isFinite(expiresAt) && expiresAt <= createdAt) {
    context.addIssue({ code: 'custom', message: 'Expiry must follow creation.' });
  }
  if (Number.isFinite(createdAt) && Number.isFinite(deadlineAt) && deadlineAt <= createdAt) {
    context.addIssue({ code: 'custom', message: 'Deadline must follow creation.' });
  }
  const item = candidate.workItems[0];
  if (item && (item.projectId !== candidate.projectId || item.agentId !== candidate.agentId || item.functionId !== candidate.functionId)) {
    context.addIssue({ code: 'custom', message: 'WorkItem identities must match the candidate.' });
  }
  if (candidate.allowedActions.length > 0 && classifyGoalActions(candidate.allowedActions).kind !== 'SIDE_EFFECTING') {
    context.addIssue({ code: 'custom', message: 'An H1 execution candidate must include a side effect.' });
  }
  if (candidate.allowedActions.some(value => candidate.forbiddenActions.includes(value))) {
    context.addIssue({ code: 'custom', message: 'Allowed and forbidden actions must not overlap.' });
  }
});

export type H1ProposalCandidate = z.infer<typeof candidateSchema>;

/** Structural parsing only; it neither establishes authority nor validates live facts. */
export function parseH1ProposalCandidate(input: unknown): H1ProposalCandidate {
  return candidateSchema.parse(input);
}
