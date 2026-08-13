import { test, expect, withApiRoutes } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, addEntity, uniqueName } from '../helpers/api';

test.describe('public share', () => {
  test('anonymous visitor sees public project read-only', async ({ browser }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-Public'));
    const title = uniqueName('E2E-Task');
    await addEntity(ctx, projectId, 'tasks', {
      id: crypto.randomUUID(),
      title,
      status: 'todo',
      priority: 'medium',
    });

    const res = await ctx.patch(`/api/v1/projects/${projectId}`, { data: { visibility: 'public' } });
    if (!res.ok()) throw new Error(`make public failed (${res.status()}): ${await res.text()}`);

    const anon = await withApiRoutes(
      await browser.newContext({ storageState: { cookies: [], origins: [] } }),
    );
    const anonPage = await anon.newPage();
    await anonPage.goto(`/p/${projectId}`);
    await expect(anonPage.getByText(title)).toBeVisible();
    await expect(anonPage.getByRole('button', { name: 'New task' })).toHaveCount(0);
    await expect(anonPage.getByRole('button', { name: 'Add task' })).toHaveCount(0);
    await anon.close();
  });

  test('private project shows not found for anonymous', async ({ browser }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-Private'));

    const anon = await withApiRoutes(
      await browser.newContext({ storageState: { cookies: [], origins: [] } }),
    );
    const anonPage = await anon.newPage();
    await anonPage.goto(`/p/${projectId}`);
    await expect(anonPage.getByText(/not found/i)).toBeVisible();
    await anon.close();
  });
});