/* global window */
import { expect, test } from '@playwright/test';

test('fake execution truthfully displays reconciliation and cancellation', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'superAssistant', {
    configurable: true,
    value: Object.freeze({
      getOnboarding: async () => ({ onboarding: { completed: false } }),
      setOnboarding: async () => ({ onboarding: { completed: false } }),
      listTasks: async () => ({ tasks: [
        { taskId: 'task-reconciling', goal: 'Inspect <unsafe> result', projectName: 'Demo', agentName: 'Codex', updatedAt: '2026-08-20T00:00:00.000Z', state: 'RUNNING / RECONCILING', activity: ['<script>unsafe</script>'] },
        { taskId: 'task-cancelling', goal: 'Stop safely', projectName: 'Demo', agentName: 'Codex', updatedAt: '2026-08-20T00:00:00.000Z', state: 'CANCELLING', activity: [] }
      ] })
    })
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Task Center' }).click();
  await expect(page.getByText('Previous execution outcome is being determined. No duplicate execution will start.')).toBeVisible();
  await expect(page.getByText('Cancellation remains active until the process stops and leases release.')).toBeVisible();
  await expect(page.locator('#super-assistant-root')).not.toContainText('<script>');
  await expect(page.getByText('COMPLETED')).toHaveCount(0);
});
