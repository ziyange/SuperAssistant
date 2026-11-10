/* global window, sessionStorage */
import { expect, test } from '@playwright/test';

test('default page provides bounded navigation and H1 onboarding', async ({ page }) => {
  await page.addInitScript(() => {
    const key = 'super-assistant-test-onboarding';
    const read = () => ({ completed: sessionStorage.getItem(key) === 'true' });
    Object.defineProperty(window, 'superAssistant', {
      configurable: true,
      value: Object.freeze({
        getOnboarding: async () => ({ onboarding: read() }),
        setOnboarding: async (projection: { completed: boolean }) => {
          sessionStorage.setItem(key, String(projection.completed));
          return { onboarding: read() };
        }
      })
    });
  });
  await page.goto('/');
  await expect(page.locator('#super-assistant-root')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Super Assistant' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button')).toHaveCount(5);
  for (const destination of ['Agent Center', 'Task Center', 'Project Center', 'Settings']) {
    await page.getByRole('button', { name: destination }).click();
    await expect(page.getByRole('heading', { name: destination.toLowerCase().replace(' ', '-') })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Connect Codex' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Project' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Task' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Task' })).toBeDisabled();
  await expect(page.getByText(/Task execution is not available/)).toBeVisible();
  await page.getByRole('button', { name: 'Add Project' }).click();
  await expect(page.getByRole('region', { name: 'Project Center' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('button', { name: 'Start Task' })).toBeDisabled();
  await expect(page.evaluate(() => {
    const pageGlobal = globalThis as Record<string, unknown>;
    return { process: typeof pageGlobal.process, require: typeof pageGlobal.require, electron: typeof pageGlobal.electron };
  })).resolves.toEqual({ process: 'undefined', require: 'undefined', electron: 'undefined' });
  await expect(page.getByText(/Agent Template/i)).toHaveCount(0);
});
