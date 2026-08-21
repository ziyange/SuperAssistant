/* eslint-disable no-unused-vars -- projection is a type-only interface parameter. */
export const IPC_CHANNELS = ['onboarding:get', 'onboarding:set', 'proposal:classify', 'proposal:preflight', 'task:get', 'task:list', 'artifact:get'] as const;

export type IpcChannel = (typeof IPC_CHANNELS)[number];

export type OnboardingProjection = Readonly<{ completed: boolean }>;
export type TaskRendererProjection = Readonly<{ taskId: string; goal: string; projectName: string; agentName: string; updatedAt: string; state: string; activity: readonly string[] }>;
export type ArtifactRendererProjection = Readonly<{ logicalName: string; mimeType: string; checksum: string; state: 'AVAILABLE' | 'QUARANTINED' | 'DOWNLOAD_ONLY' }>;

export type IpcRequest =
  | Readonly<{ channel: 'onboarding:get'; payload: Record<string, never> }>
  | Readonly<{ channel: 'onboarding:set'; payload: OnboardingProjection }>
  | Readonly<{ channel: 'proposal:classify'; payload: Readonly<{ actions: readonly string[] }> }>
  | Readonly<{ channel: 'proposal:preflight'; payload: Readonly<{ approved: Record<string, unknown>; current: Record<string, unknown> }> }>
  | Readonly<{ channel: 'task:get'; payload: Readonly<{ taskId: string }> }>
  | Readonly<{ channel: 'task:list'; payload: Record<string, never> }>
  | Readonly<{ channel: 'artifact:get'; payload: Readonly<{ artifactVersionId: string; authorizationGrantId: string; checksum: string }> }>;

export type IpcResponse =
  | Readonly<{ onboarding: OnboardingProjection; classification?: 'READ_ONLY' | 'SIDE_EFFECTING'; preflight?: 'READY' | 'STALE' }>
  | Readonly<{ task: TaskRendererProjection }>
  | Readonly<{ tasks: readonly TaskRendererProjection[] }>
  | Readonly<{ artifact: ArtifactRendererProjection }>;

export interface SuperAssistantDesktopApi {
  getOnboarding(): Promise<IpcResponse>;
  setOnboarding(projection: OnboardingProjection): Promise<IpcResponse>;
  getTask(taskId: string): Promise<IpcResponse>;
  listTasks(): Promise<IpcResponse>;
  getArtifact(input: Readonly<{ artifactVersionId: string; authorizationGrantId: string; checksum: string }>): Promise<IpcResponse>;
}

declare global {
  interface Window {
    superAssistant?: Readonly<SuperAssistantDesktopApi>;
  }
}
