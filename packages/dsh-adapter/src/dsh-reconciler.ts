export function reconcileDsh(evidence: { processAlive: boolean; journalState: 'COVERED' | 'AMBIGUOUS' }): { state: 'RUNNING' | 'RECONCILING'; redispatchAllowed: false } {
  return evidence.processAlive && evidence.journalState === 'COVERED'
    ? { state: 'RUNNING', redispatchAllowed: false }
    : { state: 'RECONCILING', redispatchAllowed: false };
}
