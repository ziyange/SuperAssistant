/* eslint-disable no-unused-vars -- public transport and constructor parameter names are contract vocabulary. */
/* global process, performance, setTimeout, clearTimeout */
import { terminateProcessTree } from './worker.js';
export interface AppServerTransport { request(operation: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>; }
export interface StartCommand { attemptId: string; requestId: string; idempotencyKey: string; proposalDigest: string; authorizationGrantId: string; projectSnapshotVersion: string; resourceFences: readonly { key: string; token: number }[]; }
type CancellationInput = { attemptId: string; processId?: number; terminateTree?: (pid: number) => Promise<void>; releaseLease?: () => Promise<boolean> };
type CancellationOutcome = { attemptId: string; complete: boolean; code?: 'CANCELLATION_INCOMPLETE' };

async function withinDeadline<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('CANCELLATION_TIMEOUT')), timeoutMs); })
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export class CodexExecutionAdapter {
  private readonly starts = new Map<string, { attemptId: string; accepted: true }>();
  private readonly uncertainStarts = new Set<string>();
  private readonly pendingStarts = new Map<string, Promise<{ attemptId: string; accepted: true }>>();
  private readonly resumeInputs = new Map<string, string>();
  private readonly cancellations = new Map<string, { processId: number; outcome: Promise<CancellationOutcome> }>();
  constructor(private readonly transport: AppServerTransport) {}
  async start(command: StartCommand): Promise<{ attemptId: string; accepted: true }> {
    const existing = this.starts.get(command.idempotencyKey); if (existing) return existing;
    if (this.uncertainStarts.has(command.idempotencyKey)) throw new Error('START_OUTCOME_UNKNOWN');
    const pending = this.pendingStarts.get(command.idempotencyKey); if (pending) return pending;
    const start = this.sendStart(command);
    this.pendingStarts.set(command.idempotencyKey, start);
    try { return await start; } finally { this.pendingStarts.delete(command.idempotencyKey); }
  }
  private async sendStart(command: StartCommand): Promise<{ attemptId: string; accepted: true }> {
    try {
      await this.transport.request('turn/start', { attempt_id: command.attemptId, request_id: command.requestId, idempotency_key: command.idempotencyKey, proposal_digest: command.proposalDigest, authorization_grant_id: command.authorizationGrantId, project_snapshot_version: command.projectSnapshotVersion, resource_fences: command.resourceFences });
    } catch {
      this.uncertainStarts.add(command.idempotencyKey);
      throw new Error('START_OUTCOME_UNKNOWN');
    }
    const receipt = { attemptId: command.attemptId, accepted: true } as const;
    this.starts.set(command.idempotencyKey, receipt);
    return receipt;
  }
  async describe(): Promise<{ adapter: 'codex'; operations: readonly string[] }> { return { adapter: 'codex', operations: ['describe', 'health', 'start', 'resume', 'cancel', 'status', 'events', 'result'] }; }
  async health(): Promise<{ connection: 'CONNECTED'; availability: 'AVAILABLE' }> { return { connection: 'CONNECTED', availability: 'AVAILABLE' }; }
  async cancel(input: CancellationInput): Promise<CancellationOutcome> {
    const incomplete = { attemptId: input.attemptId, complete: false, code: 'CANCELLATION_INCOMPLETE' } as const;
    const existing = this.cancellations.get(input.attemptId);
    if (existing) {
      if (existing.processId !== input.processId) throw new Error('CANCELLATION_IDEMPOTENCY_CONFLICT');
      return existing.outcome;
    }
    if (!input.attemptId || input.attemptId.length > 128 || typeof input.processId !== 'number' || !Number.isSafeInteger(input.processId) || input.processId <= 0 || (!input.terminateTree && process.platform !== 'win32')) return incomplete;
    const outcome = this.cancelOnce({ ...input, processId: input.processId });
    this.cancellations.set(input.attemptId, { processId: input.processId, outcome });
    return outcome;
  }
  private async cancelOnce(input: CancellationInput & { processId: number }): Promise<CancellationOutcome> {
    const incomplete = { attemptId: input.attemptId, complete: false, code: 'CANCELLATION_INCOMPLETE' } as const;
    const deadline = performance.now() + 15_000;
    const remaining = () => Math.max(0, deadline - performance.now());
    let interrupted = false;
    try { await withinDeadline(() => this.transport.request('turn/interrupt', { attempt_id: input.attemptId }), Math.min(5_000, remaining())); interrupted = true; } catch { /* retain lease until reconciled */ }
    if (remaining() <= 0) return incomplete;
    const processId = input.processId;
    try { await withinDeadline(() => (input.terminateTree ?? terminateProcessTree)(processId), remaining()); } catch { return incomplete; }
    if (!interrupted || !input.releaseLease || remaining() <= 0) return incomplete;
    const releaseLease = input.releaseLease;
    try { return await withinDeadline(releaseLease, remaining()) ? { attemptId: input.attemptId, complete: true } : incomplete; } catch { return incomplete; }
  }
  async resume(input: { attemptId: string; inputId: string; payloadDigest: string }): Promise<void> { const key = `${input.attemptId}:${input.inputId}`; const existing = this.resumeInputs.get(key); if (existing && existing !== input.payloadDigest) throw new Error('IDEMPOTENCY_CONFLICT'); if (existing) return; await this.transport.request('turn/resume', { attempt_id: input.attemptId, input_id: input.inputId }); this.resumeInputs.set(key, input.payloadDigest); }
  async status(attemptId: string): Promise<{ attemptId: string; state: string }> { const response = await this.transport.request('turn/status', { attempt_id: attemptId }); return { attemptId, state: String(response.state) }; }
  async events(attemptId: string, afterSequence: number): Promise<Array<{ sequence: number; type: string }>> {
    const response = await this.transport.request('turn/events', { attempt_id: attemptId, after_sequence: afterSequence });
    const events = Array.isArray(response.events) ? response.events : [];
    const normalized = events.map((event) => { const value = event as Record<string, unknown>; return { sequence: Number(value.sequence), type: String(value.type) }; }).filter((event) => Number.isSafeInteger(event.sequence) && event.sequence > afterSequence).sort((left, right) => left.sequence - right.sequence);
    return normalized.filter((event, index) => index === 0 || event.sequence !== normalized[index - 1]?.sequence);
  }
  async result(attemptId: string): Promise<{ attemptId: string; state: string }> { const response = await this.transport.request('turn/result', { attempt_id: attemptId }); return { attemptId, state: String(response.state) }; }
}
