import { test, expect } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, addEntity, uniqueName } from '../helpers/api';
import { waitForSaved } from '../helpers/wait';

test.describe('done-block business rule', () => {
  test('task cannot move to Done while test case pending, then moves after Pass', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-DoneBlock'));
    const title = uniqueName('E2E-Task');
    const { entity: task } = await addEntity<{ id: string }>(ctx, projectId, 'tasks', {
      id: crypto.randomUUID(),
      title,
      status: 'todo',
      priority: 'medium',
    });
    const testName = uniqueName('E2E-Test');
    await addEntity(ctx, projectId, 'testCases', {
      id: crypto.randomUUID(),
      name: testName,
      taskId: task.id,
      status: 'pending',
    });

    await page.goto(`/project/${projectId}`);
    const card = page.locator('[data-testid="task-card"]', { hasText: title });
    await expect(card).toBeVisible();

    await card.focus();
    await page.keyboard.press('ArrowRight');
    await expect(card).toBeVisible();
    await card.focus();
    await page.keyboard.press('ArrowRight');
    await expect(card).toBeVisible();
    await card.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(/still has test case/i)).toBeVisible();
    await expect(page.locator('[data-testid="kanban-col-done"]').locator('[data-testid="task-card"]', { hasText: title })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Test Cases' }).click();
    const testRow = page.locator('.data-row', { hasText: testName });
    await expect(testRow).toBeVisible();
    await testRow.locator('.data-row-main').click();
    await expect(page.getByRole('heading', { name: 'Test case', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Status').selectOption('pass');
    await page.getByRole('button', { name: 'Done' }).click();
    await waitForSaved(page, projectId);

    await page.getByRole('tab', { name: 'Board' }).click();
    const card2 = page.locator('[data-testid="task-card"]', { hasText: title });
    await card2.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="kanban-col-done"]').locator('[data-testid="task-card"]', { hasText: title })).toBeVisible();
    await waitForSaved(page, projectId);
  });
});