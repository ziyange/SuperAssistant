import { describe, expect, test } from 'vitest';
import { CodexDiscoveryAdapter } from '../src/discovery.js';

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
});
