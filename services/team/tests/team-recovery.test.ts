import { expect, test } from 'vitest';
import { TeamAuthorityHealth } from '../src/team-api.js';

test('Team authority loss remains read-only and never delegates writes to a cache', () => {
  const health = new TeamAuthorityHealth(() => false);
  expect(health.writeState()).toEqual({ writable: false, reason: 'TEAM_AUTHORITY_UNAVAILABLE' });
  expect(health.readState()).toEqual({ readable: false, reason: 'TEAM_AUTHORITY_UNAVAILABLE' });
});
