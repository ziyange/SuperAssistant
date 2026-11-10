/* eslint-disable no-unused-vars -- public repository contract parameter names. */
import type { FoundationId, ProjectStatus } from '../foundation.js';
import type { ProjectMetadata, RegisteredProject } from '../project.js';
export interface ProjectRepository {
  register(input: { workspaceId: FoundationId; name: string; canonicalPath: string; metadata: ProjectMetadata }): RegisteredProject;
  setStatus(projectId: FoundationId, status: ProjectStatus, activeTasks: number): RegisteredProject;
  get(projectId: FoundationId): RegisteredProject | null;
  list(workspaceId: FoundationId): RegisteredProject[];
}
