import { expect, test } from '@playwright/test';
test('quality rejection keeps remediation under the original Work Item', async ({ page }) => { await page.setContent('<main><section aria-label="Quality evidence"><p>Repair Work Item: work-1</p></section></main>'); await expect(page.getByText('Repair Work Item: work-1')).toBeVisible(); await expect(page.getByText(/new task/i)).toHaveCount(0); });
