// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { NotificationSettings } from '../../src/renderer/notification-settings.js';

test('renders scoped quiet-hours settings without notification content', () => {
  render(<NotificationSettings workspaceId="workspace-1" principal="user-1" startHour={22} endHour={7} />);
  expect(screen.getByText('Quiet hours')).toBeTruthy();
  expect(screen.getByText('workspace-1')).toBeTruthy();
  expect(screen.queryByText(/secret|token/i)).toBeNull();
});
