import { createFoundationId, type FoundationId } from './identifiers.js';

export type WorkspaceStatus = 'ACTIVE' | 'LOCKED' | 'ARCHIVED';
export type ProjectStatus = 'INITIALIZING' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'ERROR';
export type IsoTimestamp = string;

const workspaceTransitions: Readonly<Record<WorkspaceStatus, readonly WorkspaceStatus[]>> = {
  ACTIVE: ['LOCKED', 'ARCHIVED'], LOCKED: ['ACTIVE', 'ARCHIVED'], ARCHIVED: []
};
const projectTransitions: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  INITIALIZING: ['ACTIVE', 'ERROR'], ACTIVE: ['PAUSED', 'ARCHIVED', 'ERROR'], PAUSED: ['ACTIVE', 'ARCHIVED', 'ERROR'], ARCHIVED: [], ERROR: ['INITIALIZING']
};

export function canTransitionWorkspace(from: WorkspaceStatus, to: WorkspaceStatus): boolean { return workspaceTransitions[from].includes(to); }
export function canTransitionProject(from: ProjectStatus, to: ProjectStatus): boolean { return projectTransitions[from].includes(to); }
export { createFoundationId, type FoundationId };

export interface Workspace { workspaceId: FoundationId; ownerId: string; name: string; status: WorkspaceStatus; createdAt: IsoTimestamp; updatedAt: IsoTimestamp; rowVersion: number; }
export interface Project { projectId: FoundationId; workspaceId: FoundationId; name: string; canonicalPath: string; status: ProjectStatus; defaultAgentId: FoundationId | null; snapshotVersion: number; createdAt: IsoTimestamp; updatedAt: IsoTimestamp; rowVersion: number; }
