import { Buffer } from 'node:buffer';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { UntrustedOwnerProtocol } from './windows-process-owner.js';

const MAX_FRAME = 1_048_576;
const MAX_CHUNK = 12_288;

/** Framing only: this does not authenticate the owner or prove a sandbox or process-tree exit. */
export class OwnerAppServerTransport extends EventEmitter {
  readonly stdin: Writable;
  readonly stdout = new PassThrough({ highWaterMark: MAX_FRAME });
  readonly #owner: ChildProcess;
  readonly #protocol: UntrustedOwnerProtocol;
  #closed = false;

  constructor(owner: ChildProcess) {
    super();
    if (!owner.stdin || !owner.stdout) throw new Error('OWNER_TRANSPORT_UNAVAILABLE');
    this.#owner = owner;
    const control = owner.stdin;
    this.#protocol = new UntrustedOwnerProtocol(control, owner.stdout, (stream, bytes) => {
      if (stream === 'stdout' && !this.stdout.write(bytes)) this.fail();
    });
    this.stdin = new Writable({
      highWaterMark: MAX_FRAME,
      write: (chunk: Buffer, _encoding, callback) => {
        if (!Buffer.isBuffer(chunk) || chunk.length === 0 || chunk.length > MAX_FRAME || this.#closed) {
          callback(new Error('OWNER_TRANSPORT_UNAVAILABLE')); return;
        }
        let offset = 0;
        let finished = false;
        const cleanup = () => { control.off('drain', send); control.off('close', onClosed); control.off('error', onClosed); };
        const done = (error?: Error) => { if (finished) return; finished = true; cleanup(); callback(error); };
        const onClosed = () => done(new Error('OWNER_TRANSPORT_UNAVAILABLE'));
        const send = () => {
          if (this.#closed) { onClosed(); return; }
          while (offset < chunk.length) {
            const next = chunk.subarray(offset, Math.min(offset + MAX_CHUNK, chunk.length));
            const result = this.#protocol.sendInput(next);
            if (!result.accepted && !result.backpressured) { onClosed(); return; }
            if (result.accepted) offset += next.length;
            if (result.backpressured) { control.once('drain', send); return; }
          }
          done();
        };
        control.once('close', onClosed);
        control.once('error', onClosed);
        send();
      }
    });
    this.stdin.on('error', () => this.fail());
    this.stdout.on('error', () => this.fail());
    owner.stdout.on('data', () => { if (this.#protocol.state === 'UNKNOWN') this.fail(); });
    owner.stdout.once('end', () => this.fail());
    owner.stdout.once('close', () => this.fail());
    owner.stdout.once('error', () => this.fail());
    control.once('error', () => this.fail());
    control.once('close', () => {
      if (this.#protocol.state !== 'STOPPING' && this.#protocol.state !== 'TERMINATED_UNVERIFIED') this.fail();
    });
    owner.once('error', () => this.fail());
    owner.once('exit', () => this.fail());
    owner.stderr?.on('error', () => this.fail());
    owner.stderr?.resume();
  }

  async start(request: Parameters<UntrustedOwnerProtocol['start']>[0], timeoutMs: number): Promise<'READY_UNTRUSTED' | 'UNKNOWN'> {
    const result = await this.#protocol.start(request, timeoutMs);
    if (result !== 'READY_UNTRUSTED' || this.#closed || this.#protocol.state !== 'READY') {
      this.fail();
      return 'UNKNOWN';
    }
    return 'READY_UNTRUSTED';
  }

  async stop(timeoutMs: number): Promise<'UNVERIFIED_TERMINATION' | 'UNKNOWN'> {
    const result = await this.#protocol.stop(timeoutMs);
    if (result !== 'UNVERIFIED_TERMINATION') this.fail();
    return result;
  }

  private fail(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.stdin.destroy();
    this.stdout.destroy();
    if (this.#owner.stdin && !this.#owner.stdin.destroyed) this.#owner.stdin.destroy();
    this.emit('exit', null, null);
  }
}
