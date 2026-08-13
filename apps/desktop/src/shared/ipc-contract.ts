/* eslint-disable no-unused-vars -- projection is a type-only interface parameter. */
export const IPC_CHANNELS = ['onboarding:get', 'onboarding:set', 'proposal:classify', 'proposal:preflight'] as const;

export type IpcChannel = (typeof IPC_CHANNELS)[number];

export type OnboardingProjection = Readonly<{ completed: boolean }>;

export type IpcRequest =
  | Readonly<{ channel: 'onboarding:get'; payload: Record<string, never> }>
  | Readonly<{ channel: 'onboarding:set'; payload: OnboardingProjection }>
  | Readonly<{ channel: 'proposal:classify'; payload: Readonly<{ actions: readonly string[] }> }>
  | Readonly<{ channel: 'proposal:preflight'; payload: Readonly<{ approved: Record<string, unknown>; current: Record<string, unknown> }> }>;

export type IpcResponse = Readonly<{ onboarding: OnboardingProjection; classification?: 'READ_ONLY' | 'SIDE_EFFECTING'; preflight?: 'READY' | 'STALE' }>;

export interface SuperAssistantDesktopApi {
  getOnboarding(): Promise<IpcResponse>;
  setOnboarding(projection: OnboardingProjection): Promise<IpcResponse>;
}

declare global {
  interface Window {
    superAssistant?: Readonly<SuperAssistantDesktopApi>;
  }
}
