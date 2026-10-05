import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, deleteProject, addEntity, uniqueName } from '../helpers/api';
import type { APIRequestContext } from '@playwright/test';

// Regresi mekanisme kanonik §10c (design-tokens.md): hidden row action &
// icon hint — reveal `:hover` + `:focus-within`, touch selalu tampak.
const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'shots', 'hidden-actions');
mkdirSync(SHOTS, { recursive: true });

async function op(page: Page, sel: string): Promise<string> {
  return page.locator(sel).first().evaluate((el) => getComputedStyle(el).opacity);
}

test.describe('hidden actions — mekanisme kanonik §10c', () => {
  test.describe.configure({ mode: 'serial' });
  let ctx: APIRequestContext;
  let projectId = '';

  test.beforeAll(async () => {
    ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    projectId = await createProject(ctx, teamId, uniqueName('E2E-HiddenMig'));
    await addEntity(ctx, projectId, 'issues', {
      id: crypto.randomUUID(),
      title: 'Swap check issue',
      severity: 'high',
      status: 'open',
      description: 'd',
      reproduction: 'r',
    });
    await addEntity(ctx, projectId, 'issues', {
      id: crypto.randomUUID(),
      title: 'Pinned issue',
      severity: 'low',
      status: 'open',
      description: 'd',
      reproduction: 'r',
      pinned: true,
    });
    await addEntity(ctx, projectId, 'whiteboards', {
      id: crypto.randomUUID(),
      name: 'WB visual',
      description: 'desc',
      elements: [],
    });
    const { entity: col } = await addEntity<{ id: string }>(ctx, projectId, 'apiCollections', {
      id: crypto.randomUUID(),
      name: 'Users',
      description: 'Users API',
    });
    await addEntity(ctx, projectId, 'apiEndpoints', {
      id: crypto.randomUUID(),
      collectionId: col.id,
      method: 'GET',
      path: '/users/:id',
      name: 'Get user',
      description: '',
    });
  });

  test.afterAll(async () => {
    if (projectId) await deleteProject(ctx, projectId).catch(() => {});
    await ctx?.dispose().catch(() => {});
  });

  test('issues swap: idle hidden, hover overlay, pinned pin-only', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/project/${projectId}?tab=issues`);
    const row = page.locator('.data-row', { hasText: 'Swap check issue' });
    await expect(row).toBeVisible();
    const group = row.locator('.swap-group');
    const status = row.locator('.swap-status');
    expect(await group.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    expect(await status.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');

    await row.hover();
    await expect.poll(() => op(page, '.data-row:has-text("Swap check issue") .swap-group'), { timeout: 3000 }).toBe('1');
    expect(await status.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    await page.screenshot({ path: path.join(SHOTS, 'issues-hover.png'), animations: 'disabled' });

    // Pinned idle: grup tampak (Pin), trash sembunyi, status tampak.
    const pinned = page.locator('.data-row', { hasText: 'Pinned issue' });
    await expect(pinned.locator('.row-swap.is-pinned')).toHaveCount(1);
    expect(await pinned.locator('.swap-group').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    expect(await pinned.locator('.swap-trash').evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    await pinned.screenshot({ path: path.join(SHOTS, 'issues-pinned-idle.png'), animations: 'disabled' });
  });

  test('whiteboard card overlay + api tree trash', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/project/${projectId}?tab=board`);
    await page.getByRole('tab', { name: /Whiteboard/ }).click();
    const card = page.locator('.wb-card', { hasText: 'WB visual' });
    await expect(card).toBeVisible();
    expect(await card.locator('.wb-card-actions').evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    await card.hover();
    await expect.poll(() => op(page, '.wb-card .wb-card-actions'), { timeout: 3000 }).toBe('1');
    await page.screenshot({ path: path.join(SHOTS, 'wb-hover.png'), animations: 'disabled' });

    await page.goto(`/project/${projectId}?tab=api`);
    await expect(page.locator('.api-tree-item').first()).toBeVisible();
    const trash = page.locator('.api-tree-item .api-tree-actions').first();
    expect(await trash.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    expect(await trash.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    await page.locator('.api-tree-item').first().hover();
    await expect.poll(async () => trash.evaluate((el) => getComputedStyle(el).opacity), { timeout: 3000 }).toBe('1');
    await page.screenshot({ path: path.join(SHOTS, 'api-tree-hover.png'), animations: 'disabled' });
  });
});
