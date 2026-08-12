/* global URL, process */
import { describe, expect, test } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CodexDiscoveryAdapter } from '../src/discovery.js';
import { normalizeDiscoveryEvent } from '../src/protocol.js';
import { CodexWorker, createReadOnlyCodexLaunch } from '../src/worker.js';
import { readStdioDiscovery } from '../src/stdio-transport.js';

const fakeAppServer = fileURLToPath(new URL('./fixtures/fake-app-server.mjs', import.meta.url));
function spawnFake(mode: string) {
  return spawn(process.execPath, [fakeAppServer], { stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, FAKE_APP_SERVER_MODE: mode } });
}

describe('read-only Codex discovery', () => {
  test('normalizes describe and health without provider execution identifiers', async () => {
    const adapter = new CodexDiscoveryAdapter(async () => ({ version: '0.121.0', authenticated: true, capabilities: ['develop'] }));
    await expect(adapter.describe()).resolves.toEqual(expect.objectContaining({ adapter: 'codex', functions: ['develop'] }));
    await expect(adapter.health()).resolves.toEqual(expect.objectContaining({ connection: 'CONNECTED', availability: 'AVAILABLE' }));
  });
  test.each(['start', 'resume', 'cancel', 'status', 'events', 'result'] as const)('%s fails closed before transport', async (operation) => {
    const adapter = new CodexDiscoveryAdapter(async () => { throw new Error('transport must not run'); });
    await expect(adapter[operation]()).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' });
  });
  test('reports incompatible versions without exposing native execution values', async () => {
    const adapter = new CodexDiscoveryAdapter(async () => ({ version: '0.120.0', authenticated: true, capabilities: ['develop'] }));
    await expect(adapter.health()).resolves.toMatchObject({ connection: 'VERSION_UNSUPPORTED', availability: 'UNAVAILABLE' });
  });
  test('deduplicates discovery events by their stable evidence key', () => {
    expect(normalizeDiscoveryEvent({ event_id: 'e-1', version: '0.121.0', authenticated: true, capabilities: ['develop'] }, new Set(['e-1']))).toBeNull();
  });
  test('launches only an absolute Codex executable with fixed App Server arguments and a bounded environment', () => {
    let received: unknown[] = [];
    const launch = createReadOnlyCodexLaunch('C:\\Tools\\codex.exe', 'C:\\Project', (command, args, options) => {
      received = [command, args, options];
      return { kill: () => undefined } as never;
    }, { SystemRoot: 'C:\\Windows', TEMP: 'C:\\Temp', USERPROFILE: 'C:\\User' });
    launch();
    expect(received).toEqual(['C:\\Tools\\codex.exe', ['app-server'], expect.objectContaining({ cwd: 'C:\\Project', shell: false, windowsHide: true, env: { SystemRoot: 'C:\\Windows', TEMP: 'C:\\Temp' } })]);
    expect(() => createReadOnlyCodexLaunch('codex.exe', 'C:\\Project', () => ({}) as never, {})).toThrow(/absolute/i);
  });
  test('terminates the child when initialization exceeds the frozen discovery timeout', async () => {
    let killed = false;
    const worker = new CodexWorker(() => ({ kill: () => { killed = true; } }) as never, async () => new Promise(() => undefined), 1);
    await expect(worker.initialize()).rejects.toThrow(/timed out/i);
    expect(killed).toBe(true);
  });
  test('delegates a real child PID to the controlled process-tree terminator', async () => {
    let terminatedPid: number | undefined;
    const worker = new CodexWorker(() => ({ pid: 4123, kill: () => undefined }) as never, async () => ({ version: '0.121.0', authenticated: true, capabilities: [] }), 100, async (pid) => { terminatedPid = pid; });
    await worker.initialize();
    await worker.shutdown();
    expect(terminatedPid).toBe(4123);
  });
  test.each([['success', { version: '0.121.0', authenticated: true, capabilities: ['develop'] }], ['auth_required', { version: '0.121.0', authenticated: false, capabilities: [] }]])('reads the %s fake App Server frame over stdio', async (mode, expected) => {
    await expect(readStdioDiscovery(spawnFake(mode), 500)).resolves.toEqual(expected);
  });
  test('fails closed for malformed, timeout, and exited fake App Server states', async () => {
    await expect(readStdioDiscovery(spawnFake('malformed'), 500)).rejects.toThrow(/malformed/i);
    await expect(readStdioDiscovery(spawnFake('timeout'), 20)).rejects.toThrow(/timed out/i);
    await expect(readStdioDiscovery(spawnFake('exit'), 500)).rejects.toThrow(/exited/i);
  });
});
