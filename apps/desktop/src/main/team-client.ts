export type TeamUiState = 'READY' | 'DENIED' | 'EXPIRED' | 'DEGRADED';
export interface TeamTransport { request(path: string): Promise<Readonly<{ status: number; body: Readonly<Record<string, unknown>> }>>; }
export interface TeamWorkspaceProjection { state: TeamUiState; workspace?: Readonly<{ workspaceId: string; name: string }>; members: readonly Readonly<{ subject: string; role: string }>[]; approvals: readonly Readonly<{ proposalDigest: string; state: string }>[]; audit?: Readonly<{ digest: string; recordCount: number }>; retention?: Readonly<{ state: string; reason?: string }>; }

export class TeamClient {
  constructor(private readonly transport: TeamTransport) {}
  async workspace(workspaceId: string): Promise<TeamWorkspaceProjection> {
    const response = await this.transport.request(`/v1/workspaces/${encodeURIComponent(workspaceId)}`);
    if (response.status === 401) return { state: 'EXPIRED', members: [], approvals: [] };
    if (response.status === 403) return { state: 'DENIED', members: [], approvals: [] };
    if (response.status >= 500) return { state: 'DEGRADED', members: [], approvals: [] };
    const workspace = response.body.workspace;
    if (response.status !== 200 || typeof workspace !== 'object' || workspace === null) return { state: 'DENIED', members: [], approvals: [] };
    const value = workspace as Record<string, unknown>;
    return typeof value.workspaceId === 'string' && typeof value.name === 'string'
      ? { state: 'READY', workspace: { workspaceId: value.workspaceId, name: value.name }, members: [], approvals: [] }
      : { state: 'DEGRADED', members: [], approvals: [] };
  }
}
