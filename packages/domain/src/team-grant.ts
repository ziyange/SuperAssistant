export interface TeamGrant { actor: string; workspaceId: string; proposalDigest: string; credentialRef: `cred:${string}` }
export function createTeamGrant(input: TeamGrant): Readonly<TeamGrant> {
  if (input.actor.length === 0 || input.workspaceId.length === 0 || !/^sha256:[a-f0-9]+$/.test(input.proposalDigest) || !/^cred:[a-z0-9-]+$/.test(input.credentialRef)) throw new Error('TEAM_GRANT_INVALID');
  return Object.freeze({ ...input });
}
export function canUseTeamGrant(grant: Readonly<TeamGrant>, request: Readonly<TeamGrant>): boolean {
  return grant.actor === request.actor && grant.workspaceId === request.workspaceId && grant.proposalDigest === request.proposalDigest && grant.credentialRef === request.credentialRef;
}
