import { describe, expect, it } from 'vitest';
import { DshToolBroker } from '../src/dsh-tool-broker.js';

describe('DshToolBroker', () => {
  it('denies stale grants and journals an authorized fixture capability', () => {
    const broker = new DshToolBroker({ grant: 'grant-1', snapshot: 'snapshot-1', fence: 4, budget: 5, targets: { shell: ['fixture'], filesystem: ['fixture'], network: ['fixture'], plugin: ['approved-plugin@1'] }, plugins: { 'approved-plugin@1': 'sha256:plugin' } });
    expect(broker.authorize({ capability: 'shell', grant: 'old', snapshot: 'snapshot-1', fence: 4, target: 'fixture' }).allowed).toBe(false);
    expect(broker.authorize({ capability: 'network', grant: 'grant-1', snapshot: 'snapshot-1', fence: 4, target: 'fixture' }).allowed).toBe(true);
    expect(broker.records()).toHaveLength(2);
  });

  it('requires target rules and an approved plugin digest', () => {
    const broker = new DshToolBroker({ grant: 'grant-1', snapshot: 'snapshot-1', fence: 4, budget: 5, targets: { shell: ['fixture'], filesystem: ['fixture'], network: ['fixture'], plugin: ['approved-plugin@1'] }, plugins: { 'approved-plugin@1': 'sha256:plugin' } });
    expect(broker.authorize({ capability: 'network', grant: 'grant-1', snapshot: 'snapshot-1', fence: 4, target: 'outside' }).reason).toBe('TARGET_DENIED');
    expect(broker.authorize({ capability: 'plugin', grant: 'grant-1', snapshot: 'snapshot-1', fence: 4, target: 'approved-plugin@1', pluginDigest: 'wrong' }).reason).toBe('PLUGIN_DENIED');
    expect(broker.authorize({ capability: 'plugin', grant: 'grant-1', snapshot: 'snapshot-1', fence: 4, target: 'approved-plugin@1', pluginDigest: 'sha256:plugin' }).allowed).toBe(true);
  });
});
