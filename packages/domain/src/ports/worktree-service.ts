/* eslint-disable no-unused-vars -- public worktree contract parameter names. */
import type { FoundationId } from '../foundation.js';
export interface ManagedWorktree { projectId: FoundationId; taskId: FoundationId; path: string; branch: string; baselineCommit: string; resourceKey: string; disposition: 'ACTIVE' | 'QUARANTINED'; }
export interface WorktreeService { create(input: { projectId: FoundationId; taskId: FoundationId; projectPath: string; worktreeRoot: string }): ManagedWorktree; reconcile(path: string): 'QUARANTINED' | 'UNKNOWN'; }
