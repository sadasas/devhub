import { test, expect } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, addEntity, uniqueName } from '../helpers/api';

test.describe('team chat from the project drawer', () => {
  test('sends a message from the project drawer and it persists', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-Chat'));
    const content = uniqueName('E2E-Pesan');

    await page.goto(`/project/${projectId}`);
    await expect(page.locator('nav.tabs').getByRole('tab', { name: 'Board', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Open team chat' }).click();
    const drawer = page.getByRole('dialog', { name: 'Team chat' });
    await expect(drawer).toBeVisible();

    await drawer.getByLabel('Message', { exact: true }).fill(content);
    await drawer.getByRole('button', { name: 'Send message' }).click();
    await expect(drawer.locator('.chat-msg-text', { hasText: content })).toBeVisible();

    const res = await ctx.get(`/api/v1/teams/${teamId}/messages`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { messages: Array<{ content: string }> };
    expect(body.messages.some((m) => m.content === content)).toBe(true);

    await page.reload();
    await page.getByRole('button', { name: 'Open team chat' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Team chat' }).locator('.chat-msg-text', { hasText: content }),
    ).toBeVisible();
  });

  test('mention inserts a token and the ref chip renders', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-ChatRef'));
    const taskTitle = uniqueName('E2E-TaskChat');
    const { entity: task } = await addEntity<{ id: string }>(ctx, projectId, 'tasks', {
      id: crypto.randomUUID(),
      title: taskTitle,
      status: 'todo',
      priority: 'medium',
    });

    await page.goto(`/project/${projectId}`);
    await expect(page.locator('nav.tabs').getByRole('tab', { name: 'Board', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Open team chat' }).click();
    const drawer = page.getByRole('dialog', { name: 'Team chat' });
    await expect(drawer).toBeVisible();

    const input = drawer.getByLabel('Message', { exact: true });
    await input.fill('@' + taskTitle.slice(0, 6));
    const popup = drawer.getByRole('listbox', { name: 'Mention search' });
    await expect(popup.getByRole('option', { name: new RegExp(taskTitle) })).toBeVisible();
    await popup.getByRole('option', { name: new RegExp(taskTitle) }).click();

const token = `@[${taskTitle}](tasks:${task.id})`;
    await expect
      .poll(async () => input.inputValue())
      .toContain(token);
    await drawer.getByRole('button', { name: 'Send message' }).click();

    const chip = drawer.locator('.chat-chip', { hasText: taskTitle });
    await expect(chip).toBeVisible();
    await expect(chip).toBeEnabled();

    const res = await ctx.get(`/api/v1/teams/${teamId}/messages`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      messages: Array<{ refs: Array<{ entity: string; entityId: string }> }>;
    };
    expect(body.messages[0].refs).toEqual([{ entity: 'tasks', entityId: task.id }]);
  });
});

