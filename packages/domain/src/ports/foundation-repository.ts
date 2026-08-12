/* eslint-disable no-unused-vars -- parameter names are part of the public TypeScript repository contract. */
import type { AgentState } from '../agent-state.js';
import type { FoundationId, Project, Workspace } from '../foundation.js';

export interface Agent extends AgentState { agentId: FoundationId; workspaceId: FoundationId; name: string; agentVersion: string; credentialRef: string | null; rowVersion: number; }
export interface FunctionRecord { functionId: FoundationId; agentId: FoundationId; name: string; functionVersion: string; lifecycle: 'ACTIVE' | 'DEPRECATED' | 'DISABLED' | 'INCOMPATIBLE'; }
export interface FoundationRepository {
  createWorkspace(input: { ownerId: string; name: string }): Workspace;
  createProject(input: { workspaceId: FoundationId; name: string; canonicalPath: string; defaultAgentId?: FoundationId; snapshotVersion?: number }): Project;
  getProject(projectId: FoundationId): Project | null;
  createAgent(input: { workspaceId: FoundationId; name: string; connection: AgentState['connection']; availability: AgentState['availability']; agentVersion?: string; credentialRef?: string }): Agent;
  createFunction(input: { agentId: FoundationId; name: string; functionVersion: string }): FunctionRecord;
  listFunctions(agentId: FoundationId): FunctionRecord[];
}
