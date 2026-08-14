/* eslint-disable no-unused-vars -- port parameter names are contract vocabulary. */
export interface StartOutboxMessage {
  messageId: string;
  attemptId: string;
  payload: { attemptId: string };
}

export interface ExecutionOutboxPort {
  claimNext(): StartOutboxMessage | null;
  acknowledge(messageId: string): void;
}

export interface StartAdapterPort {
  start(command: { attemptId: string }): Promise<void>;
}

export class OutboxDispatcher {
  constructor(private readonly outbox: ExecutionOutboxPort, private readonly adapter: StartAdapterPort) {}

  async dispatchOne(): Promise<{ messageId?: string; dispatched: boolean }> {
    const message = this.outbox.claimNext();
    if (!message) return { dispatched: false };
    await this.adapter.start(message.payload);
    this.outbox.acknowledge(message.messageId);
    return { messageId: message.messageId, dispatched: true };
  }
}
