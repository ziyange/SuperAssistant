/* eslint-disable no-unused-vars -- interface parameters are public IPC port contract names. */
import type { GoalAction, GoalClassification } from '@super-assistant/domain';
import type { CurrentExecutionSnapshot, ApprovedExecutionSnapshot, PreflightResult } from '@super-assistant/domain';

export interface ProposalIpcPort {
  classify(actions: readonly GoalAction[]): GoalClassification;
  preflight(approved: ApprovedExecutionSnapshot, current: CurrentExecutionSnapshot): PreflightResult;
}
