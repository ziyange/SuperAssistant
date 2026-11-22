/* eslint-disable no-unused-vars -- public transport and constructor parameter names are contract vocabulary. */
export interface AppServerTransport { request(operation: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>; }
export interface StartCommand { attemptId: string; requestId: string; idempotencyKey: string; proposalDigest: string; authorizationGrantId: string; projectSnapshotVersion: string; resourceFences: readonly { key: string; token: number }[]; }
type CancellationInput = { attemptId: string; processId?: number; terminateTree?: (pid: number) => Promise<void>; releaseLease?: () => Promise<boolean> };
type CancellationOutcome = { attemptId: string; complete: boolean; code?: 'CANCELLATION_INCOMPLETE' };

export class CodexExecutionAdapter {
  private readonly starts = new Map<string, { attemptId: string; accepted: true }>();
  private readonly startBindings = new Map<string, string>();
  private readonly uncertainStarts = new Set<string>();
  private readonly pendingStarts = new Map<string, Promise<{ attemptId: string; accepted: true }>>();
  private readonly resumeInputs = new Map<string, string>();
  private readonly pendingResumes = new Map<string, Promise<void>>();
  private readonly uncertainResumes = new Set<string>();
  constructor(private readonly transport: AppServerTransport) {}
  async start(command: StartCommand): Promise<{ attemptId: string; accepted: true }> {
    if (!command || [command.attemptId, command.requestId, command.idempotencyKey, command.proposalDigest,
      command.authorizationGrantId, command.projectSnapshotVersion].some(value => typeof value !== 'string' || !value)
      || !Array.isArray(command.resourceFences) || command.resourceFences.length === 0
      || command.resourceFences.some(fence => !fence || typeof fence.key !== 'string' || !fence.key
        || !Number.isSafeInteger(fence.token) || fence.token <= 0)) throw new Error('INVALID_REQUEST');
    const snapshot: StartCommand = { ...command, resourceFences: command.resourceFences.map(fence => ({ key: fence.key, token: fence.token })) };
    const key = snapshot.idempotencyKey;
    const binding = JSON.stringify([snapshot.attemptId, snapshot.proposalDigest, snapshot.authorizationGrantId, snapshot.projectSnapshotVersion, snapshot.resourceFences]);
    const previous = this.startBindings.get(key);
    if (previous !== undefined && previous !== binding) throw new Error('IDEMPOTENCY_CONFLICT');
    const existing = this.starts.get(key); if (existing) return existing;
    if (this.uncertainStarts.has(key)) throw new Error('START_OUTCOME_UNKNOWN');
    const pending = this.pendingStarts.get(key); if (pending) return pending;
    this.startBindings.set(key, binding);
    const start = this.sendStart(snapshot);
    this.pendingStarts.set(key, start);
    try { return await start; } finally { this.pendingStarts.delete(key); }
  }
  private async sendStart(command: StartCommand): Promise<{ attemptId: string; accepted: true }> {
    try {
      await this.transport.request('turn/start', { attempt_id: command.attemptId, request_id: command.requestId, idempotency_key: command.idempotencyKey, proposal_digest: command.proposalDigest, authorization_grant_id: command.authorizationGrantId, project_snapshot_version: command.projectSnapshotVersion, resource_fences: command.resourceFences });
    } catch {
      this.uncertainStarts.add(command.idempotencyKey);
      throw new Error('START_OUTCOME_UNKNOWN');
    }
    const receipt = Object.freeze({ attemptId: command.attemptId, accepted: true } as const);
    this.starts.set(command.idempotencyKey, receipt);
    return receipt;
  }
  async describe(): Promise<{ adapter: 'codex'; operations: readonly string[] }> { return { adapter: 'codex', operations: ['describe', 'health', 'start', 'resume', 'cancel', 'status', 'events', 'result'] }; }
  async health(): Promise<{ connection: 'CONNECTED'; availability: 'AVAILABLE' }> { return { connection: 'CONNECTED', availability: 'AVAILABLE' }; }
  // PID-only termination cannot establish ownership or prevent late lease release.
  // Keep this legacy port unavailable until an owned-process supervisor exists.
  async cancel(input: CancellationInput): Promise<CancellationOutcome> {
    return { attemptId: input.attemptId, complete: false, code: 'CANCELLATION_INCOMPLETE' };
  }
  async resume(input: { attemptId: string; inputId: string; payloadDigest: string }): Promise<void> {
    if (!input || [input.attemptId, input.inputId, input.payloadDigest].some(value => typeof value !== 'string' || !value)) throw new Error('INVALID_REQUEST');
    const { attemptId, inputId, payloadDigest } = input;
    const key = JSON.stringify([attemptId, inputId]);
    const existing = this.resumeInputs.get(key);
    if (existing !== undefined && existing !== payloadDigest) throw new Error('IDEMPOTENCY_CONFLICT');
    if (this.uncertainResumes.has(key)) throw new Error('RESUME_OUTCOME_UNKNOWN');
    const pending = this.pendingResumes.get(key);
    if (pending) return pending;
    if (existing !== undefined) return;
    this.resumeInputs.set(key, payloadDigest);
    const send = (async () => {
      try { await this.transport.request('turn/resume', { attempt_id: attemptId, input_id: inputId }); }
      catch { this.uncertainResumes.add(key); throw new Error('RESUME_OUTCOME_UNKNOWN'); }
    })();
    this.pendingResumes.set(key, send);
    try { await send; } finally { this.pendingResumes.delete(key); }
  }
  async status(attemptId: string): Promise<{ attemptId: string; state: string }> { const response = await this.transport.request('turn/status', { attempt_id: attemptId }); return { attemptId, state: String(response.state) }; }
  async events(attemptId: string, afterSequence: number): Promise<Array<{ sequence: number; type: string }>> {
    const response = await this.transport.request('turn/events', { attempt_id: attemptId, after_sequence: afterSequence });
    const events = Array.isArray(response.events) ? response.events : [];
    const normalized = events.map((event) => { const value = event as Record<string, unknown>; return { sequence: Number(value.sequence), type: String(value.type) }; }).filter((event) => Number.isSafeInteger(event.sequence) && event.sequence > afterSequence).sort((left, right) => left.sequence - right.sequence);
    return normalized.filter((event, index) => index === 0 || event.sequence !== normalized[index - 1]?.sequence);
  }
  async result(attemptId: string): Promise<{ attemptId: string; state: string }> { const response = await this.transport.request('turn/result', { attempt_id: attemptId }); return { attemptId, state: String(response.state) }; }
}
