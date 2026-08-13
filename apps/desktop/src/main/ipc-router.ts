/* eslint-disable no-unused-vars -- type-only port parameter names are part of the public contract. */
import type { IpcRequest, IpcResponse, OnboardingProjection } from '../shared/ipc-contract.js';
import { validateRequest } from './ipc-schemas.js';
import type { ProposalIpcPort } from './proposal-ipc.js';

export interface OnboardingPort {
  get(): Promise<OnboardingProjection>;
  set(projection: OnboardingProjection): Promise<OnboardingProjection>;
}

export async function routeIpc(request: unknown, onboarding: OnboardingPort, proposal?: ProposalIpcPort): Promise<IpcResponse> {
  const valid: IpcRequest = validateRequest(request);
  if (valid.channel === 'onboarding:get') return { onboarding: await onboarding.get() };
  if (valid.channel === 'onboarding:set') return { onboarding: await onboarding.set(valid.payload) };
  if (!proposal) throw new Error('Proposal IPC port is unavailable.');
  const onboardingProjection = await onboarding.get();
  if (valid.channel === 'proposal:classify') return { onboarding: onboardingProjection, classification: proposal.classify(valid.payload.actions as Parameters<ProposalIpcPort['classify']>[0]).kind };
  return { onboarding: onboardingProjection, preflight: proposal.preflight(valid.payload.approved as unknown as Parameters<ProposalIpcPort['preflight']>[0], valid.payload.current as unknown as Parameters<ProposalIpcPort['preflight']>[1]).status };
}
