export function reconcileDsh(evidence: { processAlive: boolean; journalState: 'COVERED' | 'AMBIGUOUS' }): { state: 'RUNNING' | 'RECONCILING'; redispatchAllowed: false } {
  // A boolean and an in-memory journal cannot authenticate an owned process.
  void evidence;
  return { state: 'RECONCILING', redispatchAllowed: false };
}
