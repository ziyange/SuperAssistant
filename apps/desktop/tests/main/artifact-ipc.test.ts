import { expect, test } from 'vitest';
import { projectArtifactForRenderer } from '../../src/main/artifact-ipc.js';
import { routeIpc } from '../../src/main/ipc-router.js';

const artifact = { artifactVersionId: 'artifact-version-1', artifactId: 'artifact-1', taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', projectId: 'project-1', baselineCommit: 'base', authorizationGrantId: 'grant-1', logicalName: 'result.txt', mimeType: 'text/plain', byteSize: 1, checksum: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', storageRef: 'artifact://artifact-version-1', createdAt: '2026-08-14T00:00:00.000Z' };

test('projects only checksum-verified authorized metadata to the renderer', () => {
  expect(projectArtifactForRenderer({ get: () => artifact }, { artifactVersionId: 'artifact-version-1', authorizationGrantId: 'grant-1', checksum: artifact.checksum })).toEqual({ logicalName: 'result.txt', mimeType: 'text/plain', checksum: artifact.checksum, state: 'AVAILABLE' });
  expect(() => projectArtifactForRenderer({ get: () => artifact }, { artifactVersionId: 'artifact-version-1', authorizationGrantId: 'grant-2', checksum: artifact.checksum })).toThrow('ARTIFACT_ACCESS_DENIED');
});

test('routes only validated read-only task and Artifact projections', async () => {
  const onboarding = { get: async () => ({ completed: false }), set: async () => ({ completed: false }) };
  const task = { taskId: 'task-1', goal: 'Safe goal', projectName: 'Project', agentName: 'Codex', updatedAt: '2026-08-14T00:00:00.000Z', state: 'RUNNING' as const, activity: [] };
  await expect(routeIpc({ channel: 'task:get', payload: { taskId: 'task-1' } }, onboarding, undefined, { get: () => task })).resolves.toEqual({ task });
  await expect(routeIpc({ channel: 'task:list', payload: {} }, onboarding, undefined, { get: () => task, list: () => [task] })).resolves.toEqual({ tasks: [task] });
  await expect(routeIpc({ channel: 'artifact:get', payload: { artifactVersionId: 'artifact-version-1', authorizationGrantId: 'grant-1', checksum: artifact.checksum } }, onboarding, undefined, undefined, { get: () => artifact })).resolves.toEqual({ artifact: { logicalName: 'result.txt', mimeType: 'text/plain', checksum: artifact.checksum, state: 'AVAILABLE' } });
  await expect(routeIpc({ channel: 'artifact:get', payload: { artifactVersionId: 'artifact-version-1', authorizationGrantId: 'grant-1', checksum: 'bad' } }, onboarding)).rejects.toThrow('IPC channel or payload is not allowed.');
});
