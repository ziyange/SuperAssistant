import { expect, test } from 'vitest';
import { createArtifactVersion, canReadArtifact, sanitizeArtifactLabel } from '../src/artifact.js';

const input = { artifactVersionId: 'artifact-version-1', artifactId: 'artifact-1', taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', projectId: 'project-1', baselineCommit: 'abc123', authorizationGrantId: 'grant-1', logicalName: 'result.txt', mimeType: 'text/plain', byteSize: 12, checksum: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', storageRef: 'artifact://artifact-version-1', createdAt: '2026-08-14T00:00:00.000Z' };

test('creates an immutable, attributable ArtifactVersion only with a safe type and digest', () => {
  expect(createArtifactVersion(input)).toEqual(expect.objectContaining({ ...input, logicalName: 'result.txt' }));
  expect(() => createArtifactVersion({ ...input, checksum: 'sha256:bad' })).toThrow('ARTIFACT_CHECKSUM_INVALID');
  expect(() => createArtifactVersion({ ...input, mimeType: 'text/html' })).toThrow('ARTIFACT_MIME_UNSAFE');
  expect(() => createArtifactVersion({ ...input, storageRef: 'C:/secret/result.txt' })).toThrow('ARTIFACT_STORAGE_REF_INVALID');
});

test('requires checksum and Grant identity before reading an Artifact', () => {
  const artifact = createArtifactVersion(input);
  expect(canReadArtifact(artifact, { authorizationGrantId: 'grant-1', checksum: input.checksum })).toBe(true);
  expect(canReadArtifact(artifact, { authorizationGrantId: 'grant-2', checksum: input.checksum })).toBe(false);
  expect(canReadArtifact(artifact, { authorizationGrantId: 'grant-1', checksum: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' })).toBe(false);
});

test('sanitizes hostile Artifact labels before display', () => {
  expect(sanitizeArtifactLabel('<script>thread-1</script>\u0000')).toBe('scriptthread-1/script');
});
