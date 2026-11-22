/* eslint-disable no-unused-vars -- port parameter names are contract vocabulary. */
export interface StartOutboxMessage {
  messageId: string;
  attemptId: string;
  claimToken: string;
  kind?: 'start';
  payload: { attemptId: string };
}

export interface ResumeOutboxMessage {
  messageId: string;
  attemptId: string;
  claimToken: string;
  kind: 'resume';
  payload: { attemptId: string; decisionId: string; resolutionId: string };
}

export interface ExecutionOutboxPort {
  claimNext(): StartOutboxMessage | ResumeOutboxMessage | null;
  authorizeResume?(message: ResumeOutboxMessage): { option: 'ALLOW' | 'DENY' } | null;
  acknowledge(messageId: string, claimToken: string): boolean;
  markUncertain(messageId: string, claimToken: string): boolean;
}

export interface ExecutionAdapterPort {
  start(command: { attemptId: string }): Promise<void>;
  resume?(command: { attemptId: string; decisionId: string; resolutionId: string; option: 'ALLOW' | 'DENY' }): Promise<void>;
}

export type DispatchGuard = (message: StartOutboxMessage | ResumeOutboxMessage) => boolean | Promise<boolean>;

export class OutboxDispatcher {
  constructor(private readonly outbox: ExecutionOutboxPort, private readonly adapter: ExecutionAdapterPort, private readonly guard?: DispatchGuard) {}

  async dispatchOne(): Promise<{ messageId?: string; dispatched: boolean }> {
    if (!this.guard) throw new Error('DISPATCH_GUARD_UNAVAILABLE');
    const message = this.outbox.claimNext();
    if (!message) return { dispatched: false };
    try {
      if (await this.guard(message) !== true) throw new Error('DISPATCH_GUARD_REJECTED');
      if (message.kind === 'resume') {
        if (!this.adapter.resume) throw new Error('RESUME_NOT_SUPPORTED');
        const authority = this.outbox.authorizeResume?.(message);
        if (!authority || (authority.option !== 'ALLOW' && authority.option !== 'DENY')) throw new Error('RESUME_AUTHORITY_DENIED');
        await this.adapter.resume({ ...message.payload, option: authority.option });
      } else {
        await this.adapter.start(message.payload);
      }
      if (!this.outbox.acknowledge(message.messageId, message.claimToken)) throw new Error('CLAIM_FENCE_LOST');
      return { messageId: message.messageId, dispatched: true };
    } catch {
      try { this.outbox.markUncertain(message.messageId, message.claimToken); } catch { /* preserve claim for recovery */ }
      throw new Error('DISPATCH_OUTCOME_UNKNOWN');
    }
  }
}
