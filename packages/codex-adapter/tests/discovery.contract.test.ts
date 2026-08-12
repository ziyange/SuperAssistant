import { describe, expect, test } from 'vitest';
import { CodexDiscoveryAdapter } from '../src/discovery.js';
import { normalizeDiscoveryEvent } from '../src/protocol.js';
import { CodexWorker, createReadOnlyCodexLaunch } from '../src/worker.js';

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
});
