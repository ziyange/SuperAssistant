/* global window */
import { expect, test } from '@playwright/test';

test('Project Center exposes bounded monitoring state without a follow-up action', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'superAssistant', { configurable: true, value: Object.freeze({ getOnboarding: async () => ({ onboarding: { completed: false } }), setOnboarding: async () => ({ onboarding: { completed: false } }), getMonitoringStatus: async () => ({ monitoring: { rawEventCount: 100, aggregateCount: 1, blockedFollowUpCount: 99, collector: 'BACKPRESSURE' } }) }) }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Project Center' }).click();
  await expect(page.getByRole('region', { name: 'Monitoring status' })).toBeVisible();
  await expect(page.getByText('Collector backpressure')).toBeVisible();
  await expect(page.getByText('Raw evidence: 100')).toBeVisible();
  await expect(page.getByRole('button', { name: /create follow-up/i })).toHaveCount(0);
});
