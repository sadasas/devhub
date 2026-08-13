import { test, expect } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, uniqueName } from '../helpers/api';
import { waitForSaved } from '../helpers/wait';

test.describe('board create + keyboard move', () => {
  test('shortcut n creates task, ArrowRight moves column', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-Board'));
    const title = uniqueName('E2E-Task');

    await page.goto(`/project/${projectId}`);
    await expect(page.locator('[data-testid="kanban-col-todo"]')).toBeVisible();

    await page.keyboard.press('n');
    await expect(page.getByRole('heading', { name: 'New task' })).toBeVisible();
    await page.locator('form#new-task-form').getByLabel('Title').fill(title);
    await page.locator('button[form="new-task-form"]').click();

    const card = page.locator('[data-testid="task-card"]', { hasText: title });
    await expect(card).toBeVisible();
    await expect(page.locator('[data-testid="kanban-col-todo"]').locator('[data-testid="task-card"]', { hasText: title })).toBeVisible();
    await waitForSaved(page, projectId);

    await card.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="kanban-col-inProgress"]').locator('[data-testid="task-card"]', { hasText: title })).toBeVisible();
    await waitForSaved(page, projectId);

    await page.reload();
    await expect(page.locator('[data-testid="kanban-col-inProgress"]').locator('[data-testid="task-card"]', { hasText: title })).toBeVisible();
  });
});