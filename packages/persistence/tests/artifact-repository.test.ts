import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteArtifactRepository } from '../src/repositories/artifact-repository.js';

const version = { artifactVersionId: 'artifact-version-1', artifactId: 'artifact-1', taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', projectId: 'project-1', baselineCommit: 'abc123', authorizationGrantId: 'grant-1', logicalName: 'result.txt', mimeType: 'text/plain', byteSize: 12, checksum: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', storageRef: 'artifact://artifact-version-1', createdAt: '2026-08-14T00:00:00.000Z' };

function seedExecution(db: ReturnType<typeof createFoundationDatabase>): void {
  db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)').run('workspace-1', 'owner-1', 'Workspace', 'ACTIVE', '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('agent-1', 'workspace-1', 'Codex', '1.0.0', 'CONNECTED', 'AVAILABLE', null, 1);
  db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('project-1', 'workspace-1', 'Project', 'E:/fixture', 'e:/fixture', 'ACTIVE', 'agent-1', 1, '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO functions VALUES (?, ?, ?, ?, ?)').run('function-1', 'agent-1', 'implement', '1.0.0', 'ACTIVE');
  db.prepare('INSERT INTO proposal_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('proposal-1', 'workspace-1', 'project-1', 'agent-1', 'function-1', 'Test execution', '[]', '1', '1.0.0', '1.0.0', '1.0.0', 'base', '2026-08-14T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 'sha256:abc');
  db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('grant-1', 'proposal-1', 'sha256:abc', 'actor-1', 'grant-key-1', '[]', 'CONSUMED', '2026-08-12T00:00:00.000Z', '2026-08-14T00:00:00.000Z');
  db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)').run('task-1', 'workspace-1', 'project-1', 'proposal-1', 'grant-1', 'QUEUED', '2026-08-12T00:00:00.000Z');
  db.prepare('INSERT INTO work_items VALUES (?, ?, ?, ?, ?)').run('work-1', 'task-1', 'agent-1', 'function-1', 'WAITING');
  db.prepare('INSERT INTO execution_attempts VALUES (?, ?, ?, ?, ?, ?, ?)').run('attempt-1', 'work-1', 'request-1', 'key-1', 'SUCCEEDED', 2, '2026-08-12T00:00:00.000Z');
}

test('retains immutable, checksummed ArtifactVersions by Task', () => {
  const db = createFoundationDatabase(':memory:'); seedExecution(db); const artifacts = new SqliteArtifactRepository(db);
  artifacts.create(version);
  expect(artifacts.get('artifact-version-1')).toEqual(expect.objectContaining({ taskId: 'task-1', checksum: version.checksum }));
  expect(artifacts.listForTask('task-1')).toHaveLength(1);
  expect(() => db.prepare("UPDATE artifact_versions SET logical_name = 'changed' WHERE artifact_version_id = 'artifact-version-1'").run()).toThrow(/immutable/i);
  db.close();
});

test('does not overwrite a prior ArtifactVersion on retry', () => {
  const db = createFoundationDatabase(':memory:'); seedExecution(db); const artifacts = new SqliteArtifactRepository(db);
  artifacts.create(version);
  artifacts.create({ ...version, artifactVersionId: 'artifact-version-2', attemptId: 'attempt-1', checksum: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', storageRef: 'artifact://artifact-version-2' });
  expect(artifacts.listForTask('task-1').map((artifact) => artifact.artifactVersionId)).toEqual(['artifact-version-1', 'artifact-version-2']);
  db.close();
});
