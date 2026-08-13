import { test, expect } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, uniqueName } from '../helpers/api';
import { waitForSaved } from '../helpers/wait';

test.describe('ADR lifecycle', () => {
  test('create decision (proposed), update to accepted', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-ADR'));
    const title = uniqueName('E2E-Decision');

    await page.goto(`/project/${projectId}`);
    await page.getByRole('tab', { name: 'decisions' }).click();

    await page.getByRole('button', { name: 'New decision' }).first().click();
    await expect(page.getByRole('heading', { name: 'New decision' })).toBeVisible();
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Add decision' }).click();

    const row = page.locator('.data-row', { hasText: title });
    await expect(row).toBeVisible();
    await expect(row.getByText('Proposed')).toBeVisible();
    await waitForSaved(page, projectId);

    await row.locator('.data-row-main').click();
    await expect(page.getByRole('heading', { name: 'Decision record' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Status').selectOption('accepted');
    await page.getByRole('button', { name: 'Done' }).click();

    await expect(row.getByText('Accepted')).toBeVisible();
    await waitForSaved(page, projectId);
  });
});