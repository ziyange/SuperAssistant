export interface ArtifactVersion {
  artifactVersionId: string;
  artifactId: string;
  taskId: string;
  workItemId: string;
  attemptId: string;
  projectId: string;
  baselineCommit: string;
  authorizationGrantId: string;
  logicalName: string;
  mimeType: string;
  byteSize: number;
  checksum: string;
  storageRef: string;
  createdAt: string;
}

const SAFE_MIME_TYPES = new Set(['text/plain', 'application/json', 'image/png', 'image/jpeg', 'application/pdf']);
const SHA256 = /^sha256:[a-f0-9]{64}$/;

/* eslint-disable no-control-regex -- intentionally strips renderer control characters. */
export function sanitizeArtifactLabel(value: string): string {
  return value.replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 160);
}

export function createArtifactVersion(input: ArtifactVersion): Readonly<ArtifactVersion> {
  if (!SHA256.test(input.checksum)) throw new Error('ARTIFACT_CHECKSUM_INVALID');
  if (!SAFE_MIME_TYPES.has(input.mimeType)) throw new Error('ARTIFACT_MIME_UNSAFE');
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize < 0) throw new Error('ARTIFACT_SIZE_INVALID');
  if (!/^artifact:\/\/[a-zA-Z0-9._:-]+$/.test(input.storageRef)) throw new Error('ARTIFACT_STORAGE_REF_INVALID');
  const logicalName = sanitizeArtifactLabel(input.logicalName);
  if (logicalName.length === 0) throw new Error('ARTIFACT_NAME_INVALID');
  return Object.freeze({ ...input, logicalName });
}

export function canReadArtifact(artifact: ArtifactVersion, proof: { authorizationGrantId: string; checksum: string }): boolean {
  return artifact.authorizationGrantId === proof.authorizationGrantId && artifact.checksum === proof.checksum;
}
