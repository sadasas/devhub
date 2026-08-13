import { test, expect } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, uniqueName } from '../helpers/api';

test.describe('command palette', () => {
  test('Ctrl+K navigates to project', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const name = uniqueName('E2E-Palette');
    await createProject(ctx, teamId, name);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await page.keyboard.press('Control+K');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();

    await page.getByPlaceholder(/type a command/i).fill(name);
    const item = page.getByRole('option', { name: new RegExp(name) });
    await expect(item).toBeVisible();
    await item.click();

    await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}$/);
  });
});