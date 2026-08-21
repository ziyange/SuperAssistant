import { expect, test } from '@playwright/test';

test('acceptance remediation never presents a new completed Task', async ({ page }) => {
  await page.setContent('<main><section aria-label="Acceptance"><p>Acceptance rejected. Repair Work Item: work-2</p></section></main>');
  await expect(page.getByText('Repair Work Item: work-2')).toBeVisible();
  await expect(page.getByText('Required work accepted.')).toHaveCount(0);
});
