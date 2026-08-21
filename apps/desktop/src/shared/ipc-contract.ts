/* eslint-disable no-unused-vars -- projection is a type-only interface parameter. */
export const IPC_CHANNELS = ['onboarding:get', 'onboarding:set', 'proposal:classify', 'proposal:preflight', 'task:get', 'task:list', 'artifact:get', 'decision:get', 'decision:list', 'history:list', 'project-change:list'] as const;

export type IpcChannel = (typeof IPC_CHANNELS)[number];

export type OnboardingProjection = Readonly<{ completed: boolean }>;
export type TaskRendererProjection = Readonly<{ taskId: string; goal: string; projectName: string; agentName: string; updatedAt: string; state: string; activity: readonly string[] }>;
export type ArtifactRendererProjection = Readonly<{ logicalName: string; mimeType: string; checksum: string; state: 'AVAILABLE' | 'QUARANTINED' | 'DOWNLOAD_ONLY' }>;
export type DecisionRendererProjection = Readonly<{ decisionId: string; taskId: string; question: string; level: 'L3' | 'L4'; status: 'OPEN' | 'RESOLVED' }>;
export type HistoryRendererProjection = Readonly<{ activity: readonly Readonly<{ activityId: string; attemptId: string; sequence: number; eventType: string; occurredAt: string }>[]; human: readonly Readonly<{ historyId: string; decisionId?: string; actorId: string; action: string; occurredAt: string }>[] }>;
export type ProjectChangeRendererProjection = Readonly<{ changeId: string; taskId: string; resourceKey: string; baselineRevision: string; resultRevision: string; status: string; originalChangeId?: string; createdAt: string }>;

export type IpcRequest =
  | Readonly<{ channel: 'onboarding:get'; payload: Record<string, never> }>
  | Readonly<{ channel: 'onboarding:set'; payload: OnboardingProjection }>
  | Readonly<{ channel: 'proposal:classify'; payload: Readonly<{ actions: readonly string[] }> }>
  | Readonly<{ channel: 'proposal:preflight'; payload: Readonly<{ approved: Record<string, unknown>; current: Record<string, unknown> }> }>
  | Readonly<{ channel: 'task:get'; payload: Readonly<{ taskId: string }> }>
  | Readonly<{ channel: 'task:list'; payload: Record<string, never> }>
  | Readonly<{ channel: 'artifact:get'; payload: Readonly<{ artifactVersionId: string; authorizationGrantId: string; checksum: string }> }>
  | Readonly<{ channel: 'decision:get'; payload: Readonly<{ decisionId: string }> }>
  | Readonly<{ channel: 'decision:list'; payload: Readonly<{ taskId: string }> }>
  | Readonly<{ channel: 'history:list'; payload: Readonly<{ workspaceId: string; projectId: string; taskId: string }> }>
  | Readonly<{ channel: 'project-change:list'; payload: Readonly<{ workspaceId: string; projectId: string }> }>;

export type IpcResponse =
  | Readonly<{ onboarding: OnboardingProjection; classification?: 'READ_ONLY' | 'SIDE_EFFECTING'; preflight?: 'READY' | 'STALE' }>
  | Readonly<{ task: TaskRendererProjection }>
  | Readonly<{ tasks: readonly TaskRendererProjection[] }>
  | Readonly<{ artifact: ArtifactRendererProjection }>
  | Readonly<{ decision: DecisionRendererProjection }>
  | Readonly<{ decisions: readonly DecisionRendererProjection[] }>
  | Readonly<{ history: HistoryRendererProjection }>
  | Readonly<{ changes: readonly ProjectChangeRendererProjection[] }>;

export interface SuperAssistantDesktopApi {
  getOnboarding(): Promise<IpcResponse>;
  setOnboarding(projection: OnboardingProjection): Promise<IpcResponse>;
  getTask(taskId: string): Promise<IpcResponse>;
  listTasks(): Promise<IpcResponse>;
  getArtifact(input: Readonly<{ artifactVersionId: string; authorizationGrantId: string; checksum: string }>): Promise<IpcResponse>;
  getDecision(decisionId: string): Promise<IpcResponse>;
  listDecisions(taskId: string): Promise<IpcResponse>;
  listHistory?(input: Readonly<{ workspaceId: string; projectId: string; taskId: string }>): Promise<IpcResponse>;
  listProjectChanges?(input: Readonly<{ workspaceId: string; projectId: string }>): Promise<IpcResponse>;
}

declare global {
  interface Window {
    superAssistant?: Readonly<SuperAssistantDesktopApi>;
  }
}
