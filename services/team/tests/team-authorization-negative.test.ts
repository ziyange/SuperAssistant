import { expect, test } from 'vitest';
import { TeamAuthorizationService } from '../src/team-authorization.js';

test('rejects 200 cross-workspace or unqualified protected operations', () => {
  const authorization = new TeamAuthorizationService([{ workspaceId: 'workspace-a', actor: 'operator-a', role: 'OPERATOR' }]);

  for (let caseNumber = 0; caseNumber < 200; caseNumber += 1) {
    const workspaceId = caseNumber % 2 === 0 ? 'workspace-b' : 'workspace-a';
    const action = caseNumber % 2 === 0 ? 'READ' : 'APPROVE';
    expect(authorization.authorize({ actor: 'operator-a', workspaceId, action })).toMatchObject({ allowed: false });
  }
});
