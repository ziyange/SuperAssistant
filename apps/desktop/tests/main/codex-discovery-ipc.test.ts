import { expect, test } from 'vitest';
import { projectCodexDiscovery } from '../../src/main/codex-discovery-ipc.js';

test('projects only product-neutral discovery data', () => {
  expect(projectCodexDiscovery({ connection: 'CONNECTED', availability: 'AVAILABLE', version: '0.121.0', functions: ['develop'], secret: 'must-not-leak', thread_id: 'native-id' })).toEqual({
    connection: 'CONNECTED', availability: 'AVAILABLE', version: '0.121.0', functions: ['develop']
  });
});
