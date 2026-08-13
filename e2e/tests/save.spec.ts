import { test, expect } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, uniqueName } from '../helpers/api';
import { waitForSaved } from '../helpers/wait';

test.describe('debounced save + persistence', () => {
  test('edit task title survives reload', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-Save'));
    const title = uniqueName('E2E-Task');
    const newTitle = uniqueName('E2E-Renamed');

    await page.goto(`/project/${projectId}`);
    await expect(page.locator('[data-testid="kanban-col-todo"]')).toBeVisible();
    await page.keyboard.press('n');
    await page.locator('form#new-task-form').getByLabel('Title').fill(title);
    await page.locator('button[form="new-task-form"]').click();
    await expect(page.locator('[data-testid="task-card"]', { hasText: title })).toBeVisible();
    await waitForSaved(page, projectId);

    const card = page.locator('[data-testid="task-card"]', { hasText: title });
    await card.click();
    await expect(page.getByRole('heading', { name: 'Task', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit task' })).toBeVisible();
    await page.getByLabel('Title').fill(newTitle);
    await page.getByRole('button', { name: 'Done' }).click();

    await expect(page.locator('[data-testid="task-card"]', { hasText: newTitle })).toBeVisible();
    await waitForSaved(page, projectId);

    await page.reload();
    await expect(page.locator('[data-testid="task-card"]', { hasText: newTitle })).toBeVisible();
  });
});