export type GoalAction = 'READ' | 'FILE_WRITE' | 'COMMAND' | 'NETWORK' | 'EXTERNAL_WRITE' | 'CREDENTIAL';

export interface GoalClassification {
  kind: 'READ_ONLY' | 'SIDE_EFFECTING';
  actions: readonly GoalAction[];
}

export interface RoutingCandidate { projectId: string; agentId: string; functionId: string; }
export type RoutingResult = { status: 'ROUTED'; candidate: RoutingCandidate } | { status: 'AMBIGUOUS'; candidates: readonly RoutingCandidate[] } | { status: 'UNROUTABLE'; candidates: [] };

const sideEffectingActions = new Set<GoalAction>(['FILE_WRITE', 'COMMAND', 'NETWORK', 'EXTERNAL_WRITE', 'CREDENTIAL']);

export function classifyGoalActions(actions: readonly GoalAction[]): GoalClassification {
  return {
    kind: actions.some((action) => sideEffectingActions.has(action)) ? 'SIDE_EFFECTING' : 'READ_ONLY',
    actions: [...actions]
  };
}

export function routeSingleCandidate(candidates: readonly RoutingCandidate[], selectedFunctionId?: string): RoutingResult {
  const selectable = selectedFunctionId ? candidates.filter((candidate) => candidate.functionId === selectedFunctionId) : candidates;
  if (selectable.length === 0) return { status: 'UNROUTABLE', candidates: [] };
  if (selectable.length !== 1) return { status: 'AMBIGUOUS', candidates: selectable };
  const candidate = selectable[0];
  if (!candidate) return { status: 'UNROUTABLE', candidates: [] };
  return { status: 'ROUTED', candidate };
}
