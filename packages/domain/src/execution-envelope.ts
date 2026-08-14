export interface ExecutionEnvelope<TPayload = unknown> {
  saiVersion: string;
  requestId: string;
  idempotencyKey: string;
  taskId: string;
  workItemId: string;
  attemptId: string;
  traceId: string;
  agentVersion: string;
  functionVersion: string;
  authorizationGrantId: string;
  proposalDigest: string;
  projectSnapshotVersion: string;
  resourceFences: readonly { key: string; token: number }[];
  payload: TPayload;
}
