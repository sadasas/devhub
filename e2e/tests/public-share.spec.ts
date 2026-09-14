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

    const res = await ctx.patch(`/api/v1/projects/${projectId}`, {
      data: { visibility: 'public', publicTabs: ['board', 'issues', 'stack', 'milestones', 'about', 'whiteboard'] },
    });
    if (!res.ok()) throw new Error(`make public failed (${res.status()}): ${await res.text()}`);

    const anon = await withApiRoutes(
      await browser.newContext({ storageState: { cookies: [], origins: [] } }),
    );
    const anonPage = await anon.newPage();
    // Default tab publik adalah Ringkasan — task ada di tab Board.
    await anonPage.goto(`/p/${projectId}?tab=board`);
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

  test('owner contact links appear for anonymous, disappear when cleared', async ({ browser }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-CTA'));

    const save = await ctx.patch(`/api/v1/projects/${projectId}`, {
      data: {
        visibility: 'public',
        contactUrl: 'https://owner.example/contact',
        liveDemoUrl: 'https://demo.example/app',
      },
    });
    if (!save.ok()) throw new Error(`save cta failed (${save.status()}): ${await save.text()}`);

    const anon = await withApiRoutes(
      await browser.newContext({ storageState: { cookies: [], origins: [] } }),
    );
    const anonPage = await anon.newPage();
    await anonPage.goto(`/p/${projectId}`);
    const contact = anonPage.getByRole('link', { name: 'Contact' });
    const demo = anonPage.getByRole('link', { name: 'View Demo' });
    await expect(contact).toBeVisible();
    await expect(demo).toBeVisible();
    await expect(contact).toHaveAttribute('href', 'https://owner.example/contact');
    await expect(contact).toHaveAttribute('target', '_blank');

    const clear = await ctx.patch(`/api/v1/projects/${projectId}`, {
      data: { contactUrl: '', liveDemoUrl: '' },
    });
    if (!clear.ok()) throw new Error(`clear cta failed (${clear.status()}): ${await clear.text()}`);
    await anonPage.reload();
    await expect(anonPage.getByRole('link', { name: 'Contact' })).toHaveCount(0);
    await expect(anonPage.getByRole('link', { name: 'View Demo' })).toHaveCount(0);
    await anon.close();
  });

  test('long unbroken strings wrap in public detail modals (no horizontal overflow)', async ({ browser }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-Wrap'));
    const longTitle = `T${'K'.repeat(200)}`;
    const longUrl = `https://example.com/${'p'.repeat(280)}`;
    const taskId = crypto.randomUUID();
    await addEntity(ctx, projectId, 'tasks', {
      id: taskId,
      title: longTitle,
      status: 'todo',
      priority: 'medium',
      description: `Lihat ${longUrl} untuk detail.`,
    });
    const issueTitle = `I${'K'.repeat(200)}`;
    const issueId = crypto.randomUUID();
    await addEntity(ctx, projectId, 'issues', {
      id: issueId,
      title: issueTitle,
      severity: 'critical',
      status: 'open',
      description: `Buka ${longUrl}`,
      reproduction: `Jalankan ${longUrl}`,
    });

    const pub = await ctx.patch(`/api/v1/projects/${projectId}`, {
      data: { visibility: 'public', publicTabs: ['board', 'issues'] },
    });
    if (!pub.ok()) throw new Error(`make public failed (${pub.status()}): ${await pub.text()}`);

    const anon = await withApiRoutes(
      await browser.newContext({ storageState: { cookies: [], origins: [] } }),
    );
    const anonPage = await anon.newPage();

    const assertNoOverflow = async () => {
      const bad = await anonPage.evaluate(() => {
        const over: string[] = [];
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return ['(no dialog)'];
        for (const sel of ['.composer-scroll', '.detail-main', '.detail-side', '.md-blocks', 'h3.detail-title']) {
          const el = dialog.querySelector(sel) as HTMLElement | null;
          if (el && el.scrollWidth > el.clientWidth + 1) over.push(`${sel}: ${el.scrollWidth}>${el.clientWidth}`);
        }
        const h3 = dialog.querySelector('h3.detail-title') as HTMLElement | null;
        const tw = h3 ? getComputedStyle(h3).getPropertyValue('text-wrap').trim() : '';
        if (h3 && tw !== 'wrap') over.push(`text-wrap=${tw}`);
        return over;
      });
      expect(bad).toEqual([]);
    };

    await anonPage.goto(`/p/${projectId}?tab=board&task=${taskId}`);
    await expect(anonPage.getByRole('dialog')).toBeVisible();
    await assertNoOverflow();

    await anonPage.goto(`/p/${projectId}?tab=issues&issue=${issueId}`);
    await expect(anonPage.getByRole('dialog')).toBeVisible();
    await assertNoOverflow();
    await anon.close();
  });
});