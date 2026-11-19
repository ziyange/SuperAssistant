/* global window */
import { expect, test } from '@playwright/test';

test('Project prerequisites are shown without any proposal confirmation path', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'superAssistant', { configurable: true, value: Object.freeze({
    getOnboarding: async () => ({ onboarding: { completed: false } }),
    listProjects: async () => ({ projects: [
      { id: 'needs-codex', name: 'Unassigned Project', status: 'ACTIVE', provenance: 'DISCOVERED' },
      { id: 'catalog-match', name: 'Configured Project', status: 'ACTIVE', provenance: 'DISCOVERED' }
    ] }),
    getProposalContext: async (projectId: string) => ({
      proposalContext: { status: projectId === 'needs-codex' ? 'CODEX_REQUIRED' : 'LIVE_VERIFICATION_REQUIRED' }
    })
  }) }));
  await page.goto('/');
  const select = page.getByRole('combobox', { name: 'Project for proposal' });
  await select.selectOption('needs-codex');
  await expect(page.getByText(/Assign a registered Codex/)).toBeVisible();
  await select.selectOption('catalog-match');
  await expect(page.getByText(/Live verification is still required/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm proposal' })).toBeDisabled();
});
