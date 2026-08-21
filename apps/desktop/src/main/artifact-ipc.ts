/* eslint-disable no-unused-vars -- port parameter names are interface contracts. */
import type { ArtifactVersion } from '@super-assistant/domain';

export interface ArtifactReadPort { get(artifactVersionId: string): ArtifactVersion | null; }

export function projectArtifactForRenderer(port: ArtifactReadPort, input: { artifactVersionId: string; authorizationGrantId: string; checksum: string }): { logicalName: string; mimeType: string; checksum: string; state: 'AVAILABLE' | 'QUARANTINED' | 'DOWNLOAD_ONLY' } {
  const artifact = port.get(input.artifactVersionId);
  if (!artifact || artifact.authorizationGrantId !== input.authorizationGrantId || artifact.checksum !== input.checksum) throw new Error('ARTIFACT_ACCESS_DENIED');
  const state = artifact.mimeType === 'text/plain' || artifact.mimeType === 'application/json' || artifact.mimeType.startsWith('image/') ? 'AVAILABLE' : 'DOWNLOAD_ONLY';
  return { logicalName: artifact.logicalName, mimeType: artifact.mimeType, checksum: artifact.checksum, state };
}
