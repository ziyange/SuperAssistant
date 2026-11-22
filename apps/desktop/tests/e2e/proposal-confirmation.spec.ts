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

test('review-only goal form passes user input to the fake preload and shows no authorization', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    Object.defineProperty(window, '__reviewCalls', { value: calls });
    Object.defineProperty(window, 'superAssistant', { configurable: true, value: Object.freeze({
      getOnboarding: async () => ({ onboarding: { completed: false } }),
      listProjects: async () => ({ projects: [{ id: 'project-1', name: 'Example Project', status: 'ACTIVE', provenance: 'DISCOVERED' }] }),
      getProposalContext: async () => ({ proposalContext: { status: 'LIVE_VERIFICATION_REQUIRED' } }),
      createProposalDraft: async (input: unknown) => { calls.push(input); return { proposalDraft: { status: 'CREATED', draftId: 'draft-1' } }; },
      reviewProposal: async (id: string) => { calls.push(id); return { proposalReview: 'REVIEWED_ONLY' }; }
    }) });
  });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Project for proposal' }).selectOption('project-1');
  await page.getByLabel('Goal').fill('Write a report');
  await page.getByLabel('Acceptance criterion').fill('Report exists');
  await expect(page.getByText(/commands, network, external writes and credentials are forbidden/)).toBeVisible();
  await page.getByRole('button', { name: 'Create and review draft' }).click();
  await expect(page.getByText(/Reviewed only: no execution has been authorized or started/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm proposal' })).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { __reviewCalls: unknown[] }).__reviewCalls)).toEqual([
    { projectId: 'project-1', objective: 'Write a report', criterion: 'Report exists' }, 'draft-1'
  ]);
});
