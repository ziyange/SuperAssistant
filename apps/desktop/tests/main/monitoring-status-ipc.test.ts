import { expect, test } from 'vitest';
import { routeIpc } from '../../src/main/ipc-router.js';

test('routes a read-only redacted monitoring status projection', async () => {
  const onboarding = { get: async () => ({ completed: false }), set: async () => ({ completed: false }) };
  const monitoring = { get: (projectId: string) => ({ rawEventCount: projectId === 'project-1' ? 3 : 0, aggregateCount: 1, blockedFollowUpCount: 2, collector: 'UNAVAILABLE' as const }) };
  await expect(routeIpc({ channel: 'monitoring:status', payload: { projectId: 'project-1' } }, onboarding, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, monitoring)).resolves.toEqual({ monitoring: { rawEventCount: 3, aggregateCount: 1, blockedFollowUpCount: 2, collector: 'UNAVAILABLE' } });
  await expect(routeIpc({ channel: 'monitoring:status', payload: { projectId: 'project-1', payload: '{}' } }, onboarding, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, monitoring)).rejects.toThrow('IPC channel or payload is not allowed.');
});
