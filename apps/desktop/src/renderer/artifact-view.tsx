export interface ArtifactViewModel { logicalName: string; mimeType: string; checksum: string; state: 'AVAILABLE' | 'QUARANTINED' | 'DOWNLOAD_ONLY'; }

export function ArtifactView({ artifact }: Readonly<{ artifact: ArtifactViewModel }>) {
  return <section aria-label="Artifact evidence"><h3>{artifact.logicalName}</h3><p>{artifact.mimeType}</p><p>{artifact.checksum}</p><p>{artifact.state === 'AVAILABLE' ? 'Safe preview available' : artifact.state === 'QUARANTINED' ? 'Artifact quarantined' : 'Download only'}</p></section>;
}
