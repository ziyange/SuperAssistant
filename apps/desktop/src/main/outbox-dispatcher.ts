/* eslint-disable no-unused-vars -- port parameter names are contract vocabulary. */
export interface StartOutboxMessage {
  messageId: string;
  attemptId: string;
  kind?: 'start';
  payload: { attemptId: string };
}

export interface ResumeOutboxMessage {
  messageId: string;
  attemptId: string;
  kind: 'resume';
  payload: { attemptId: string; decisionId: string; resolutionId: string };
}

export interface ExecutionOutboxPort {
  claimNext(): StartOutboxMessage | ResumeOutboxMessage | null;
  acknowledge(messageId: string): void;
}

export interface ExecutionAdapterPort {
  start(command: { attemptId: string }): Promise<void>;
  resume?(command: { attemptId: string; decisionId: string; resolutionId: string }): Promise<void>;
}

export class OutboxDispatcher {
  constructor(private readonly outbox: ExecutionOutboxPort, private readonly adapter: ExecutionAdapterPort) {}

  async dispatchOne(): Promise<{ messageId?: string; dispatched: boolean }> {
    const message = this.outbox.claimNext();
    if (!message) return { dispatched: false };
    if (message.kind === 'resume') {
      if (!this.adapter.resume) throw new Error('RESUME_NOT_SUPPORTED');
      await this.adapter.resume(message.payload);
    } else {
      await this.adapter.start(message.payload);
    }
    this.outbox.acknowledge(message.messageId);
    return { messageId: message.messageId, dispatched: true };
  }
}
