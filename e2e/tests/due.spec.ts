import { test, expect } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, uniqueName } from '../helpers/api';
import { waitForSaved } from '../helpers/wait';

test.describe('due dates + calendar (M19)', () => {
  test('quick-create with due date, calendar drop reschedules, persists after reload', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-Due'));
    const title = uniqueName('E2E-DueTask');

    await page.goto(`/project/${projectId}`);
    await expect(page.locator('[data-testid="kanban-col-todo"]')).toBeVisible();

    // Switch to the By Due Date view and create a task with a due date.
    await page.getByRole('tab', { name: 'By Due Date' }).click();
    await page.getByRole('tab', { name: 'Calendar' }).click();
    await expect(page.locator('.due-cal-grid')).toBeVisible();
    await expect(page.locator('.due-cal-grid')).toHaveCSS('display', 'grid');
    await expect(page.locator('.due-cal-cell').first()).toHaveCSS('min-height', '96px');
    const widths = await page.locator('.due-cal-cell').evaluateAll((els) => els.map((e) => e.offsetWidth));
    expect(new Set(widths).size).toBe(1);
    const heights = await page.locator('.due-cal-cell').evaluateAll((els) => els.map((e) => e.offsetHeight));
    expect(new Set(heights).size).toBe(1);

    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await page.locator(`[data-date="${todayIso}"]`).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('No tasks due on this day.');
    await page.getByRole('button', { name: /Add task/ }).click();
    await expect(page.getByRole('heading', { name: 'New task' })).toBeVisible();
    await page.locator('form#new-task-form').getByLabel('Title').fill(title);
    await page.locator('button[form="new-task-form"]').click();

    const chip = page.locator('.due-cal-task', { hasText: title });
    await expect(chip).toBeVisible();
    await expect(page.locator('.due-cal-task-title').first()).toHaveCSS('text-overflow', 'ellipsis');
    await expect(page.locator('.due-cal-task-title').first()).toHaveCSS('white-space', 'nowrap');
    await expect(page.locator('.due-cal-task').first()).toHaveCSS('overflow-x', 'hidden');
    await waitForSaved(page, projectId);

    // Drop the chip on tomorrow's cell to reschedule.
    const tomorrow = new Date(Date.now() + 86_400_000);
    const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    await chip.dragTo(page.locator(`[data-date="${tomorrowIso}"]`));
    await waitForSaved(page, projectId);

    // Reload and confirm the task is still due tomorrow in the calendar.
    await page.reload();
    await page.getByRole('tab', { name: 'By Due Date' }).click();
    await page.getByRole('tab', { name: 'Calendar' }).click();
    await expect(page.locator(`[data-date="${tomorrowIso}"]`).locator('.due-cal-task', { hasText: title })).toBeVisible();
    await expect(page.locator(`[data-date="${todayIso}"]`).locator('.due-cal-task', { hasText: title })).toHaveCount(0);

    // Bucket view shows it in Tomorrow.
    await page.getByRole('tab', { name: 'Buckets' }).click();
    await expect(page.locator('[data-testid="kanban-col-tomorrow"]').locator('[data-testid="task-card"]', { hasText: title })).toBeVisible();
  });
});