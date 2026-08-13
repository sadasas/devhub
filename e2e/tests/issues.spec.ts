import { test, expect } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, addEntity, uniqueName } from '../helpers/api';
import { waitForSaved } from '../helpers/wait';

test.describe('issue lifecycle', () => {
  test('create issue, link task, resolve', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-Issues'));
    const taskTitle = uniqueName('E2E-Task');
    const { entity: task } = await addEntity<{ id: string }>(ctx, projectId, 'tasks', {
      id: crypto.randomUUID(),
      title: taskTitle,
      status: 'todo',
      priority: 'medium',
    });
    const issueTitle = uniqueName('E2E-Bug');

    await page.goto(`/project/${projectId}`);
    await page.getByRole('tab', { name: 'issues' }).click();

    await page.getByRole('button', { name: 'New issue' }).click();
    await expect(page.getByRole('heading', { name: 'New issue' })).toBeVisible();
    await page.locator('form#new-issue-form').getByLabel('Title').fill(issueTitle);
    await page.locator('form#new-issue-form').getByLabel('Severity').selectOption('high');
    await page.getByRole('button', { name: 'Log issue' }).click();

    const row = page.locator('.data-row', { hasText: issueTitle });
    await expect(row).toBeVisible();
    await waitForSaved(page, projectId);

    await row.locator('.data-row-main').click();
    await expect(page.getByRole('heading', { name: 'Issue', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit issue' })).toBeVisible();

    await page.getByLabel('Status').selectOption('resolved');
    await page.getByLabel('Linked task').selectOption(task.id);
    await page.getByRole('button', { name: 'Done' }).click();

    await expect(row.getByText('Resolved')).toBeVisible();
    await waitForSaved(page, projectId);
  });
});