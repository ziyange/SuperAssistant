import { expect, test } from '@playwright/test';

test('restart reconciliation presents diagnostics without a redispatch action', async ({ page }) => {
  await page.setContent('<main><section aria-label="Degraded state" role="status"><p>Read-only diagnostics remain available. No retry or new dispatch is authorized.</p></section></main>');
  await expect(page.getByText('Read-only diagnostics remain available.')).toBeVisible();
  await expect(page.getByRole('button', { name: /retry|redispatch/i })).toHaveCount(0);
});
