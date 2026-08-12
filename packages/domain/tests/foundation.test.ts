import { describe, expect, test } from 'vitest';
import { canTransitionProject, canTransitionWorkspace, createFoundationId } from '../src/foundation.js';

describe('foundation lifecycle transitions', () => {
  test.each([['ACTIVE', 'LOCKED', true], ['LOCKED', 'ACTIVE', true], ['ACTIVE', 'ARCHIVED', true], ['ARCHIVED', 'ACTIVE', false], ['LOCKED', 'ARCHIVED', true]] as const)('Workspace %s -> %s is %s', (from, to, allowed) => expect(canTransitionWorkspace(from, to)).toBe(allowed));
  test.each([['INITIALIZING', 'ACTIVE', true], ['ACTIVE', 'PAUSED', true], ['PAUSED', 'ACTIVE', true], ['ACTIVE', 'ARCHIVED', true], ['ARCHIVED', 'ACTIVE', false], ['ERROR', 'ACTIVE', false], ['ERROR', 'INITIALIZING', true]] as const)('Project %s -> %s is %s', (from, to, allowed) => expect(canTransitionProject(from, to)).toBe(allowed));
  test('creates opaque UUID-shaped identifiers', () => expect(createFoundationId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
});
