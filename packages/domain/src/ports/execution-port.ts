/* eslint-disable no-unused-vars -- interface parameter names are contract vocabulary. */
export interface ExecutionPort {
  describe(): Promise<unknown>;
  health(): Promise<unknown>;
  start(command: unknown): Promise<unknown>;
  resume(command: unknown): Promise<unknown>;
  cancel(command: unknown): Promise<unknown>;
  status(command: unknown): Promise<unknown>;
  events(command: unknown): Promise<unknown>;
  result(command: unknown): Promise<unknown>;
}
