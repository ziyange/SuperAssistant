import { classifyGoalActions, evaluatePreflight, type ApprovedExecutionSnapshot, type CurrentExecutionSnapshot, type GoalAction, type GoalClassification, type PreflightResult } from '@super-assistant/domain';
import type { ProposalIpcPort } from './proposal-ipc.js';

export class ProposalPreflightService implements ProposalIpcPort {
  classify(actions: readonly GoalAction[]): GoalClassification { return classifyGoalActions(actions); }
  preflight(approved: ApprovedExecutionSnapshot, current: CurrentExecutionSnapshot): PreflightResult { return evaluatePreflight(approved, current); }
}
