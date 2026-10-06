import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, deleteProject, addEntity, uniqueName } from '../helpers/api';
import type { APIRequestContext } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, '..', 'shots', 'empty-states-center');
mkdirSync(SHOTS, { recursive: true });

async function assertDoodleCentered(page: Page, container: string): Promise<void> {
  const box = page.locator(container);
  await expect(box).toBeVisible();
  const style = await box.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { align: cs.alignItems, text: cs.textAlign };
  });
  expect(style.align, `${container} align-items`).toBe('center');
  expect(style.text, `${container} text-align`).toBe('center');
  const cBox = (await box.boundingBox())!;
  const doodle = box.locator(':scope > div').first();
  const dBox = (await doodle.boundingBox())!;
  const delta = Math.abs(cBox.x + cBox.width / 2 - (dBox.x + dBox.width / 2));
  expect(delta, `${container} doodle center delta (px)`).toBeLessThanOrEqual(1);
}

test.describe('empty states centered', () => {
  test.describe.configure({ mode: 'serial' });
  let ctx: APIRequestContext;
  let teamId = '';
  let fullProject = '';
  let emptyProject = '';

  test.beforeAll(async () => {
    ctx = await ownerContext();
    teamId = await getTeamId(ctx);
    fullProject = await createProject(ctx, teamId, uniqueName('E2E-EmptyFull'));
    const { entity: col } = await addEntity<{ id: string }>(ctx, fullProject, 'apiCollections', {
      id: crypto.randomUUID(),
      name: 'Users',
      description: 'Users API',
    });
    await addEntity(ctx, fullProject, 'apiEndpoints', {
      id: crypto.randomUUID(),
      collectionId: col.id,
      method: 'GET',
      path: '/users',
      name: 'List users',
    });
    emptyProject = await createProject(ctx, teamId, uniqueName('E2E-EmptyNone'));
    // Sidebar project filter only renders with >8 projects.
    for (let i = 0; i < 8; i += 1) {
      await createProject(ctx, teamId, uniqueName('E2E-EmptyPad'));
    }
  });

  test.afterAll(async () => {
    for (const pid of [fullProject, emptyProject]) {
      if (pid) await deleteProject(ctx, pid).catch(() => {});
    }
    await ctx.dispose();
  });

  test('api search no-match: doodle + text centered', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/project/${fullProject}?tab=api`);
    await expect(page.locator('.api-tree-item').first()).toBeVisible();
    await page.locator('.api-sidebar .search-field-input').fill('zzz-tidak-ada-hasil');
    await expect(page.locator('.api-search-empty')).toBeVisible();
    await expect(page.locator('.api-search-empty')).toContainText('No matches for');
    await assertDoodleCentered(page, '.api-search-empty');
    await page.locator('.api-sidebar').screenshot({ path: path.join(SHOTS, 'api-search-empty.png'), animations: 'disabled' });
  });

  test('api sidebar totally empty: doodle + text centered', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/project/${emptyProject}?tab=api`);
    const empty = page.locator('.api-sidebar > .api-sidebar-scroll > .api-sidebar-empty');
    await expect(empty).toBeVisible();
    await assertDoodleCentered(page, '.api-sidebar > .api-sidebar-scroll > .api-sidebar-empty');
    await page.locator('.api-sidebar').screenshot({ path: path.join(SHOTS, 'api-sidebar-empty.png'), animations: 'disabled' });
  });

  test('main sidebar project filter no-match: doodle + text centered', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/project/${fullProject}`);
    const filter = page.locator('.sidebar-filter .search-field-input');
    await expect(filter).toBeVisible();
    await filter.fill('zzz-tidak-ada-hasil');
    await expect(page.locator('.sidebar-empty')).toBeVisible();
    await assertDoodleCentered(page, '.sidebar-empty');
    await page.screenshot({ path: path.join(SHOTS, 'sidebar-empty.png'), animations: 'disabled' });
  });
});
