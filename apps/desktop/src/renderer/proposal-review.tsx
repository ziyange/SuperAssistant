export function ProposalReview({ objective, classification, preflight, onConfirm }: Readonly<{ objective: string; classification: 'READ_ONLY' | 'SIDE_EFFECTING'; preflight: 'READY' | 'STALE'; onConfirm: () => void }>) {
  if (classification === 'READ_ONLY') return <section aria-label="Proposal Review"><h2>Proposal Review</h2><p>{objective}</p><p>No authorization required</p></section>;
  const ready = preflight === 'READY';
  return <section aria-label="Proposal Review"><h2>Proposal Review</h2><p>{objective}</p>{!ready && <p>Preflight must be refreshed</p>}<button type="button" disabled={!ready} onClick={onConfirm}>Confirm proposal</button></section>;
}
