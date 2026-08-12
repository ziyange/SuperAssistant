/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type { FoundationId } from '../foundation.js';
import type { ProjectMetadata } from '../project.js';
import type { ProjectRepository } from '../ports/project-repository.js';
export class ProjectService {
  constructor(private readonly repository: ProjectRepository) {}
  register(input: { workspaceId: FoundationId; name: string; canonicalPath: string; metadata: ProjectMetadata }) { return this.repository.register(input); }
}
