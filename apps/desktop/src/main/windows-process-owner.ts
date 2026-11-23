/* eslint-disable no-unused-vars -- callback and parameter-property names document the transport boundary. */
import { Buffer } from 'node:buffer';
import { performance } from 'node:perf_hooks';
import type { Readable, Writable } from 'node:stream';
import { clearTimeout, setTimeout } from 'node:timers';

type State = 'NEW' | 'STARTING' | 'READY' | 'STOPPING' | 'UNKNOWN' | 'TERMINATED_UNVERIFIED';
type StartRequest = { executable: string; cwd: string; args: string[] };
type Pending = { deadline: number; timer: ReturnType<typeof setTimeout>; resolve: (value: string) => void };

/** A parser for an untrusted transport; it proves neither ownership nor termination. */
export class UntrustedOwnerProtocol {
  private currentState: State = 'NEW';
  public get state(): State { return this.currentState; }
  private pending: Pending | undefined;
  private buffer = Buffer.alloc(0);

  public constructor(
    private readonly input: Writable,
    output: Readable,
    private readonly onOutput: (stream: 'stdout' | 'stderr', bytes: Buffer) => void,
  ) {
    output.on('data', (chunk: Buffer | string) => this.receive(Buffer.from(chunk)));
    output.on('end', () => this.fail());
    output.on('close', () => this.fail());
    output.on('error', () => this.fail());
    input.on('error', () => this.fail());
    input.on('finish', () => { if (this.currentState !== 'STOPPING' && !this.isFinished()) this.fail(); });
    input.on('close', () => {
      if (this.currentState !== 'STOPPING' || !input.writableFinished) this.fail();
    });
  }

  public start(request: StartRequest, timeoutMs: number): Promise<'READY_UNTRUSTED' | 'UNKNOWN'> {
    if (this.currentState !== 'NEW' || !Number.isFinite(timeoutMs) || timeoutMs <= 0 ||
        typeof request.executable !== 'string' || typeof request.cwd !== 'string' ||
        !Array.isArray(request.args) || request.args.some((arg) => typeof arg !== 'string')) {
      this.fail();
      return Promise.resolve('UNKNOWN');
    }
    const frame = JSON.stringify({ type: 'start', executable: request.executable, cwd: request.cwd, args: request.args }) + '\n';
    if (Buffer.byteLength(frame) > 65536) { this.fail(); return Promise.resolve('UNKNOWN'); }
    this.currentState = 'STARTING';
    const result = this.wait(timeoutMs) as Promise<'READY_UNTRUSTED' | 'UNKNOWN'>;
    try { this.input.write(frame); } catch { this.fail(); }
    return result;
  }

  public sendInput(bytes: Buffer): { accepted: boolean; backpressured: boolean } {
    if (this.currentState !== 'READY' || !Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 12288 ||
        this.input.destroyed || this.input.writableEnded || this.input.writableNeedDrain) {
      return { accepted: false, backpressured: this.input.writableNeedDrain };
    }
    try {
      const writable = this.input.write(JSON.stringify({ type: 'input', data: bytes.toString('base64') }) + '\n');
      return { accepted: true, backpressured: !writable };
    } catch { this.fail(); return { accepted: false, backpressured: false }; }
  }

  public stop(timeoutMs: number): Promise<'UNVERIFIED_TERMINATION' | 'UNKNOWN'> {
    if (this.currentState !== 'READY' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      this.fail();
      return Promise.resolve('UNKNOWN');
    }
    this.currentState = 'STOPPING';
    const result = this.wait(timeoutMs) as Promise<'UNVERIFIED_TERMINATION' | 'UNKNOWN'>;
    try { this.input.end('{"type":"stop"}\n'); } catch { this.fail(); }
    return result;
  }

  private wait(timeoutMs: number): Promise<string> {
    return new Promise((resolve) => {
      const deadline = performance.now() + timeoutMs;
      const timer = setTimeout(() => this.fail(), timeoutMs);
      this.pending = { deadline, timer, resolve };
    });
  }

  private settle(value: string): void {
    const pending = this.pending;
    this.pending = undefined;
    if (pending) { clearTimeout(pending.timer); pending.resolve(value); }
  }

  private fail(): void {
    if (this.currentState === 'UNKNOWN' || this.currentState === 'TERMINATED_UNVERIFIED') return;
    this.currentState = 'UNKNOWN';
    this.settle('UNKNOWN');
    if (!this.input.destroyed) this.input.destroy();
  }

  private receive(chunk: Buffer): void {
    if (this.currentState === 'UNKNOWN' || this.currentState === 'TERMINATED_UNVERIFIED') return;
    if (chunk.length > 1048576) { this.fail(); return; }
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const end = this.buffer.indexOf(10);
      if (end < 0) { if (this.buffer.length > 65536) this.fail(); return; }
      if (end > 65536) { this.fail(); return; }
      const line = this.buffer.subarray(0, end > 0 && this.buffer[end - 1] === 13 ? end - 1 : end);
      this.buffer = this.buffer.subarray(end + 1);
      if (line.some((byte) => byte < 32 || byte > 126)) { this.fail(); return; }
      this.handleLine(line.toString('ascii'));
      if (this.isFinished()) return;
    }
  }

  private isFinished(): boolean {
    return this.currentState === 'UNKNOWN' || this.currentState === 'TERMINATED_UNVERIFIED';
  }

  private handleLine(line: string): void {
    if (this.pending && performance.now() >= this.pending.deadline) { this.fail(); return; }
    if (line === '{"type":"ready"}' && this.currentState === 'STARTING') {
      this.currentState = 'READY'; this.settle('READY_UNTRUSTED'); return;
    }
    if (line === '{"type":"terminated","active":0}' && this.currentState === 'STOPPING') {
      if (!this.input.writableFinished) { this.fail(); return; }
      this.currentState = 'TERMINATED_UNVERIFIED'; this.settle('UNVERIFIED_TERMINATION'); return;
    }
    if ((line === '{"type":"running"}' || line === '{"type":"idle"}') && this.currentState === 'READY') return;
    if (this.currentState !== 'READY' && this.currentState !== 'STOPPING') { this.fail(); return; }
    try {
      const value: unknown = JSON.parse(line);
      if (!value || typeof value !== 'object' || JSON.stringify(value) !== line) { this.fail(); return; }
      const frame = value as Record<string, unknown>;
      if (Object.keys(frame).join(',') !== 'type,stream,data' || frame.type !== 'output' ||
          (frame.stream !== 'stdout' && frame.stream !== 'stderr') || typeof frame.data !== 'string' ||
          !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(frame.data)) { this.fail(); return; }
      const bytes = Buffer.from(frame.data, 'base64');
      if (bytes.length === 0 || bytes.length > 12288 || bytes.toString('base64') !== frame.data) { this.fail(); return; }
      this.onOutput(frame.stream, bytes);
    } catch { this.fail(); }
  }
}
