/* eslint-disable no-unused-vars -- projection is a type-only interface parameter. */
export const IPC_CHANNELS = ['onboarding:get', 'onboarding:set'] as const;

export type IpcChannel = (typeof IPC_CHANNELS)[number];

export type OnboardingProjection = Readonly<{ completed: boolean }>;

export type IpcRequest =
  | Readonly<{ channel: 'onboarding:get'; payload: Record<string, never> }>
  | Readonly<{ channel: 'onboarding:set'; payload: OnboardingProjection }>;

export type IpcResponse = Readonly<{ onboarding: OnboardingProjection }>;

export interface SuperAssistantDesktopApi {
  getOnboarding(): Promise<IpcResponse>;
  setOnboarding(projection: OnboardingProjection): Promise<IpcResponse>;
}

declare global {
  interface Window {
    superAssistant?: Readonly<SuperAssistantDesktopApi>;
  }
}
