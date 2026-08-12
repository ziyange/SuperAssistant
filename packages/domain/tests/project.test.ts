import { describe, expect, test } from 'vitest';
import { canArchiveProject, canCreateWorktree, projectResourceKey } from '../src/project.js';

describe('Project execution policy', () => {
  test('permits a worktree only for active Projects', () => {
    expect(canCreateWorktree('ACTIVE')).toBe(true);
    expect(canCreateWorktree('PAUSED')).toBe(false);
    expect(canCreateWorktree('ARCHIVED')).toBe(false);
  });
  test('rejects archive while active Tasks exist', () => {
    expect(canArchiveProject('ACTIVE', 1)).toBe(false);
    expect(canArchiveProject('ACTIVE', 0)).toBe(true);
  });
  test('uses a stable Project resource key', () => expect(projectResourceKey('project-1' as never)).toBe('project:project-1'));
});
