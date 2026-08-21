export interface ProjectChangesModel { changeId: string; resourceKey: string; baselineRevision: string; resultRevision: string; status: string; originalChangeId?: string; createdAt: string; }

export function ProjectChanges({ changes }: Readonly<{ changes: readonly ProjectChangesModel[] }>) {
  return <section aria-label="Project changes"><h2>Project Changes</h2>{changes.length === 0 ? <p>No Project changes.</p> : changes.map((change) => <article key={change.changeId}><p>{change.resourceKey}</p><p>{change.baselineRevision} → {change.resultRevision}</p><p>{change.originalChangeId ? `Compensates ${change.originalChangeId}` : change.status}</p></article>)}</section>;
}
