/* eslint-disable no-unused-vars -- type-only port parameter names are part of the public contract. */
import type { IpcRequest, IpcResponse, OnboardingProjection } from '../shared/ipc-contract.js';
import { validateRequest } from './ipc-schemas.js';
import { projectArtifactForRenderer, type ArtifactReadPort } from './artifact-ipc.js';
import { listDecisionsForRenderer, projectDecisionForRenderer, type DecisionReadPort } from './decision-ipc.js';
import { projectChangesForRenderer, projectHistoryForRenderer, type HistoryReadPort, type ProjectChangeReadPort } from './history-ipc.js';
import { projectAcceptanceForRenderer, type AcceptanceReadPort } from './acceptance-ipc.js';
import type { ProposalIpcPort } from './proposal-ipc.js';
import { listTasksForRenderer, projectTaskForRenderer, type TaskReadPort } from './task-ipc.js';

export interface OnboardingPort {
  get(): Promise<OnboardingProjection>;
  set(projection: OnboardingProjection): Promise<OnboardingProjection>;
}

export async function routeIpc(request: unknown, onboarding: OnboardingPort, proposal?: ProposalIpcPort, task?: TaskReadPort, artifact?: ArtifactReadPort, decision?: DecisionReadPort, history?: HistoryReadPort, changes?: ProjectChangeReadPort, acceptance?: AcceptanceReadPort): Promise<IpcResponse> {
  const valid: IpcRequest = validateRequest(request);
  if (valid.channel === 'onboarding:get') return { onboarding: await onboarding.get() };
  if (valid.channel === 'onboarding:set') return { onboarding: await onboarding.set(valid.payload) };
  if (valid.channel === 'task:get') {
    if (!task) throw new Error('Task IPC port is unavailable.');
    return { task: projectTaskForRenderer(task, valid.payload) };
  }
  if (valid.channel === 'task:list') {
    if (!task) throw new Error('Task IPC port is unavailable.');
    return { tasks: listTasksForRenderer(task) };
  }
  if (valid.channel === 'artifact:get') {
    if (!artifact) throw new Error('Artifact IPC port is unavailable.');
    return { artifact: projectArtifactForRenderer(artifact, valid.payload) };
  }
  if (valid.channel === 'decision:get') {
    if (!decision) throw new Error('Decision IPC port is unavailable.');
    return { decision: projectDecisionForRenderer(decision, valid.payload) };
  }
  if (valid.channel === 'decision:list') {
    if (!decision) throw new Error('Decision IPC port is unavailable.');
    return { decisions: listDecisionsForRenderer(decision, valid.payload) };
  }
  if (valid.channel === 'history:list') {
    if (!history) throw new Error('History IPC port is unavailable.');
    return { history: projectHistoryForRenderer(history, valid.payload) };
  }
  if (valid.channel === 'project-change:list') {
    if (!changes) throw new Error('Project Change IPC port is unavailable.');
    return { changes: projectChangesForRenderer(changes, valid.payload) };
  }
  if (valid.channel === 'acceptance:list') {
    if (!acceptance) throw new Error('Acceptance IPC port is unavailable.');
    return { acceptance: projectAcceptanceForRenderer(acceptance, valid.payload) };
  }
  if (!proposal) throw new Error('Proposal IPC port is unavailable.');
  const onboardingProjection = await onboarding.get();
  if (valid.channel === 'proposal:classify') return { onboarding: onboardingProjection, classification: proposal.classify(valid.payload.actions as Parameters<ProposalIpcPort['classify']>[0]).kind };
  return { onboarding: onboardingProjection, preflight: proposal.preflight(valid.payload.approved as unknown as Parameters<ProposalIpcPort['preflight']>[0], valid.payload.current as unknown as Parameters<ProposalIpcPort['preflight']>[1]).status };
}
