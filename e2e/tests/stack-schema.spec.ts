import { test, expect } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, uniqueName } from '../helpers/api';

test.describe('stack + schema CRUD', () => {
  test('add tech entry and table via UI', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-StackSchema'));
    const techName = uniqueName('E2E-Tech');
    const tableName = uniqueName('e2e_table');

    await page.goto(`/project/${projectId}`);

    await page.getByRole('tab', { name: 'stack' }).click();
    await page.getByRole('button', { name: 'New entry' }).click();
    await expect(page.getByRole('heading', { name: 'New stack entry' })).toBeVisible();
    await page.locator('form#new-tech-form').getByLabel('Name').fill(techName);
    await page.locator('form#new-tech-form').getByLabel('Version').fill('1.2.3');
    await page.getByRole('button', { name: 'Add entry' }).click();
    await expect(page.locator('.data-row', { hasText: techName })).toBeVisible();

    await page.getByRole('tab', { name: 'schema' }).click();
    await page.getByRole('button', { name: 'New table' }).first().click();
    await expect(page.getByRole('heading', { name: 'New table' })).toBeVisible();
    await page.locator('form#new-table-form').getByLabel('Name').fill(tableName);
    await page.getByRole('button', { name: 'Create table' }).click();
    await expect(page.locator('.data-row', { hasText: tableName })).toBeVisible();
  });
});