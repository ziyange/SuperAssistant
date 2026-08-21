/* global window */
import { expect, test } from '@playwright/test';

test('stale proposal review disables confirmation before any side effect', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'superAssistant', { configurable: true, value: Object.freeze({ getOnboarding: async () => ({ onboarding: { completed: false } }), setOnboarding: async () => ({ onboarding: { completed: false } }) }) }));
  await page.goto('/');
  await expect(page.getByText('Preflight must be refreshed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm proposal' })).toBeDisabled();
});
