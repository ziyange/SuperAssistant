import { describe, expect, it } from 'vitest';
import { reconcileDsh } from '../src/dsh-reconciler.js';

describe('reconcileDsh', () => {
  it('never permits redispatch from an ambiguous process interval', () => {
    expect(reconcileDsh({ processAlive: false, journalState: 'AMBIGUOUS' })).toEqual({ state: 'RECONCILING', redispatchAllowed: false });
  });
  it('does not infer RUNNING from an unauthenticated liveness boolean and in-memory coverage', () => {
    expect(reconcileDsh({ processAlive: true, journalState: 'COVERED' })).toEqual({ state: 'RECONCILING', redispatchAllowed: false });
  });
});
