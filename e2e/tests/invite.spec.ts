import { test, expect, withApiRoutes } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, addEntity, uniqueName, uniqueEmail, registerUser } from '../helpers/api';

const PASSWORD = 'E2ePassw0rd!';

test.describe('team invite', () => {
  test('owner invites viewer; viewer cannot edit', async ({ page, browser }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-Invite'));
    const viewerEmail = uniqueEmail();

    const viewerCookie = await registerUser(ctx, viewerEmail, PASSWORD);

    await page.goto(`/team/${teamId}`);
    await page.getByRole('button', { name: 'Invite' }).click();
    await expect(page.getByRole('heading', { name: 'Invite member' })).toBeVisible();
    await page.locator('form#invite-form').getByLabel('Email').fill(viewerEmail);
    await page.locator('form#invite-form').getByLabel('Role').selectOption('viewer');
    await page.getByRole('button', { name: 'Send invite' }).click();
    await expect(page.locator('.data-row', { hasText: viewerEmail })).toBeVisible();

    const viewerContext = await withApiRoutes(
      await browser.newContext({ storageState: { cookies: [], origins: [] } }),
    );
    const cookieValue = viewerCookie.split('=').slice(1).join('=');
    await viewerContext.addCookies([
      { name: 'devhub_session', value: cookieValue, domain: 'localhost', path: '/' },
    ]);
    const viewerPage = await viewerContext.newPage();

    await viewerPage.goto('/');
    await expect(viewerPage.getByRole('heading', { name: 'Projects' })).toBeVisible();

    await viewerPage.goto('/invites');
    const inviteRow = viewerPage.locator('.data-row', { hasText: 'Personal' });
    await expect(inviteRow).toBeVisible();
    await inviteRow.getByRole('button', { name: 'Accept' }).click();
    await expect(viewerPage.locator('.data-row', { hasText: 'Personal' })).toHaveCount(0);

    await viewerPage.goto(`/project/${projectId}`);
    await expect(viewerPage.getByRole('tab', { name: 'board' })).toBeVisible();
    await expect(viewerPage.getByRole('button', { name: 'New task' })).toHaveCount(0);
    await expect(viewerPage.locator('[data-testid="task-card"]')).toHaveCount(0);

    const denied = await viewerContext.request.post(
      `http://localhost:3100/api/v1/projects/${projectId}/tasks`,
      { data: { id: crypto.randomUUID(), title: uniqueName('E2E-Forbidden'), status: 'todo', priority: 'medium' } },
    );
    expect(denied.status()).toBe(403);

    await viewerContext.close();
  });
});