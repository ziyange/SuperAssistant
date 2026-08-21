/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { createArtifactVersion, type ArtifactVersion } from '@super-assistant/domain';

function toArtifactVersion(row: Record<string, unknown>): ArtifactVersion {
  return { artifactVersionId: String(row.artifact_version_id), artifactId: String(row.artifact_id), taskId: String(row.task_id), workItemId: String(row.work_item_id), attemptId: String(row.attempt_id), projectId: String(row.project_id), baselineCommit: String(row.baseline_commit), authorizationGrantId: String(row.authorization_grant_id), logicalName: String(row.logical_name), mimeType: String(row.mime_type), byteSize: Number(row.byte_size), checksum: String(row.checksum), storageRef: String(row.storage_ref), createdAt: String(row.created_at) };
}

export class SqliteArtifactRepository {
  constructor(private readonly database: Database.Database) {}

  create(input: ArtifactVersion): void {
    const artifact = createArtifactVersion(input);
    this.database.prepare('INSERT INTO artifact_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(artifact.artifactVersionId, artifact.artifactId, artifact.taskId, artifact.workItemId, artifact.attemptId, artifact.projectId, artifact.baselineCommit, artifact.authorizationGrantId, artifact.logicalName, artifact.mimeType, artifact.byteSize, artifact.checksum, artifact.storageRef, artifact.createdAt);
  }

  get(artifactVersionId: string): ArtifactVersion | null {
    const row = this.database.prepare('SELECT * FROM artifact_versions WHERE artifact_version_id = ?').get(artifactVersionId) as Record<string, unknown> | undefined;
    return row ? toArtifactVersion(row) : null;
  }

  listForTask(taskId: string): readonly ArtifactVersion[] {
    return (this.database.prepare('SELECT * FROM artifact_versions WHERE task_id = ? ORDER BY created_at, artifact_version_id').all(taskId) as Array<Record<string, unknown>>).map(toArtifactVersion);
  }
}
