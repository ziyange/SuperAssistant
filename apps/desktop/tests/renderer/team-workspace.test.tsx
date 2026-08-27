// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'; import { expect, test } from 'vitest'; import { TeamWorkspace } from '../../src/renderer/team-workspace.js';
test('does not show protected workspace content when access is denied', () => { render(<TeamWorkspace team={{ state: 'DENIED', members: [], approvals: [] }} />); expect(screen.getByText('Access denied.')).toBeTruthy(); expect(screen.queryByText(/token|admin/i)).toBeNull(); });
