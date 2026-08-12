/* eslint-disable no-unused-vars -- type-only port parameter names are part of the public contract. */
import type { IpcRequest, IpcResponse, OnboardingProjection } from '../shared/ipc-contract.js';
import { validateRequest } from './ipc-schemas.js';

export interface OnboardingPort {
  get(): Promise<OnboardingProjection>;
  set(projection: OnboardingProjection): Promise<OnboardingProjection>;
}

export async function routeIpc(request: unknown, onboarding: OnboardingPort): Promise<IpcResponse> {
  const valid: IpcRequest = validateRequest(request);
  if (valid.channel === 'onboarding:get') return { onboarding: await onboarding.get() };
  return { onboarding: await onboarding.set(valid.payload) };
}
