import { test, expect } from '../helpers/fixture';
import { uniqueName } from '../helpers/api';

test.describe('create project', () => {
  test('new project via dashboard → redirected to project page', async ({ page }) => {
    const name = uniqueName('E2E-Project');
    await page.goto('/');

    await page.getByRole('button', { name: 'New project' }).click();
    await expect(page.getByRole('heading', { name: 'New project' })).toBeVisible();

    await page.locator('form#new-project-form').getByLabel('Name').fill(name);
    await page.locator('form#new-project-form').getByLabel('Description').fill('Created by E2E');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText('Owner', { exact: true })).toBeVisible();
  });
});