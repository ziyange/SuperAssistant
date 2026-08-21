/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { QualityEvidence } from '../../src/renderer/quality-evidence.js';
test('shows independent rejection as original Task remediation', () => { render(<QualityEvidence evidence={{ role: 'INSPECTOR', evaluator: 'agent-2', outcome: 'REJECTED', remediationFor: 'work-1' }} />); expect(screen.getByText('Repair Work Item: work-1')).toBeTruthy(); });
