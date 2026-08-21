/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TaskHistory } from '../../src/renderer/task-history.js';
test('keeps Agent Activity and Human History visibly separate', () => { render(<TaskHistory history={{ activity: [{ activityId: 'a', eventType: 'START', occurredAt: 'now' }], human: [{ historyId: 'h', actorId: 'user', action: 'DECISION_RESOLVED', occurredAt: 'now' }] }} />); expect(screen.getByRole('region', { name: 'Agent activity' })).toBeTruthy(); expect(screen.getByRole('region', { name: 'Human history' })).toBeTruthy(); });
