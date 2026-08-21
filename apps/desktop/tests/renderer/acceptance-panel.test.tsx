/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AcceptancePanel } from '../../src/renderer/acceptance-panel.js';
test('makes remediation explicit without presenting Task completion', () => { render(<AcceptancePanel acceptance={{ state: 'REJECTED', remediationFor: 'work-2', evidenceCount: 1 }} />); expect(screen.getByText(/Repair Work Item: work-2/)).toBeTruthy(); expect(screen.queryByText('Required work accepted.')).toBeNull(); });
