// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'; import { expect, test } from 'vitest'; import { TeamApprovals } from '../../src/renderer/team-approvals.js';
test('presents approval state without an approval action', () => { render(<TeamApprovals approvals={[{ proposalDigest: 'sha256:abc', state: 'PENDING' }]} />); expect(screen.getByText('PENDING')).toBeTruthy(); expect(screen.queryByRole('button')).toBeNull(); });
