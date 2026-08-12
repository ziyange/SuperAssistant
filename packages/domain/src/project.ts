import type { FoundationId, Project, ProjectStatus } from './foundation.js';

export interface ProjectMetadata { repository: string | null; defaultBranch: string | null; technology: string | null; provenance: 'DISCOVERED' | 'USER'; }
export interface RegisteredProject extends Project { metadata: ProjectMetadata; }
export function canCreateWorktree(status: ProjectStatus): boolean { return status === 'ACTIVE'; }
export function canArchiveProject(status: ProjectStatus, activeTasks: number): boolean { return status !== 'ARCHIVED' && activeTasks === 0; }
export function projectResourceKey(projectId: FoundationId): string { return `project:${projectId}`; }
