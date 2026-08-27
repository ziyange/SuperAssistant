import type { TeamWorkspaceProjection } from './team-client.js';
import { TeamClient } from './team-client.js';
export interface TeamWorkspacePort { workspace(workspaceId: string): Promise<TeamWorkspaceProjection>; }
export function projectTeamWorkspace(port: TeamWorkspacePort, workspaceId: string): Promise<TeamWorkspaceProjection> { return port.workspace(workspaceId); }
export function unavailableTeamPort(): TeamWorkspacePort { return new TeamClient({ async request() { return { status: 503, body: {} }; } }); }
