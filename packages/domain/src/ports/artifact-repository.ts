/* eslint-disable no-unused-vars -- port parameter names are interface contracts. */
import type { ArtifactVersion } from '../artifact.js';

export interface ArtifactRepository {
  create(version: ArtifactVersion): void;
  get(artifactVersionId: string): ArtifactVersion | null;
  listForTask(taskId: string): readonly ArtifactVersion[];
}
