import { describe, expect, test } from 'vitest';
import { CodexDiscoveryAdapter } from '../src/discovery.js';
import { normalizeDiscoveryEvent } from '../src/protocol.js';

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
});
