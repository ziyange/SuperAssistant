import { describe, expect, it } from 'vitest';
import { reconcileDsh } from '../src/dsh-reconciler.js';

describe('reconcileDsh', () => {
  it('never permits redispatch from an ambiguous process interval', () => {
    expect(reconcileDsh({ processAlive: false, journalState: 'AMBIGUOUS' })).toEqual({ state: 'RECONCILING', redispatchAllowed: false });
  });
});
