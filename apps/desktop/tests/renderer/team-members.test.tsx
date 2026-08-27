// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'; import { expect, test } from 'vitest'; import { TeamMembers } from '../../src/renderer/team-members.js';
test('renders server-projected membership without credentials', () => { render(<TeamMembers members={[{ subject: 'member-a', role: 'MEMBER' }]} />); expect(screen.getByRole('region', { name: 'Team members' })).toBeTruthy(); expect(screen.getByText('member-a: MEMBER')).toBeTruthy(); expect(screen.queryByText(/token|secret/i)).toBeNull(); });
