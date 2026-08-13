import { expect, test } from '../helpers/fixture';

test('smoke: dashboard loads with session and project can be created via UI', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'New project' }).first()).toBeVisible();

  const projectName = `E2E Smoke ${Date.now()}`;
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByLabel('Name').fill(projectName);
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await page.waitForURL(/\/project\/[0-9a-f-]{36}/, { timeout: 15_000 });
  await expect(page.getByText(projectName, { exact: true }).first()).toBeVisible();
});
