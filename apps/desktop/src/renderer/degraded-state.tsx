export function DegradedState({ reason }: Readonly<{ reason: string }>) {
  return <section aria-label="Degraded state" role="status"><strong>Execution is paused for reconciliation.</strong><p>{reason}</p><p>Read-only diagnostics remain available. No retry or new dispatch is authorized.</p></section>;
}
