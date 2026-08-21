/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ProjectChanges } from '../../src/renderer/project-changes.js';
test('labels a compensating change without deleting the original reference', () => { render(<ProjectChanges changes={[{ changeId: 'c2', resourceKey: 'worktree:p', baselineRevision: 'result', resultRevision: 'rollback', status: 'APPLIED', originalChangeId: 'c1', createdAt: 'now' }]} />); expect(screen.getByText('Compensates c1')).toBeTruthy(); });
