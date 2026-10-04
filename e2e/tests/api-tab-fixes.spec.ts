import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, deleteProject, addEntity, uniqueName } from '../helpers/api';
import type { APIRequestContext } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, '..', 'shots', 'api-tab-fixes');
mkdirSync(SHOTS, { recursive: true });

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), animations: 'disabled' });
}

async function measurePill(page: Page): Promise<{
  position: string;
  topGap: number;
  leftGap: number;
  barRight: number;
  pillRight: number;
  barLeft: number;
  pillLeft: number;
  scrollWidth: number;
  clientWidth: number;
}> {
  return page.evaluate(() => {
    const bar = document.querySelector('.tabs.mt-4') as HTMLElement;
    const pill = bar.querySelector('.tab-active') as HTMLElement;
    const b = bar.getBoundingClientRect();
    const p = pill.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    return {
      position: cs.position,
      topGap: p.top - b.top,
      leftGap: p.left - b.left,
      barRight: b.right,
      pillRight: p.right,
      barLeft: b.left,
      pillLeft: p.left,
      scrollWidth: bar.scrollWidth,
      clientWidth: bar.clientWidth,
    };
  });
}

async function openEndpointReadView(page: Page, projectId: string): Promise<void> {
  await page.goto(`/project/${projectId}?tab=api`);
  await expect(page.locator('.api-tree-item')).toHaveCount(2);
  await expect(page.locator('.api-tree-item.api-tree-item-selected')).toHaveCount(1);
}

test.describe('API page — 5 issue fixes', () => {
  test.describe.configure({ mode: 'serial' });
  let ctx: APIRequestContext;
  let projectId = '';

  test.beforeAll(async () => {
    ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    projectId = await createProject(ctx, teamId, uniqueName('E2E-ApiFixes'));
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
      description: 'Returns a single user',
      headers: [{ key: 'X-Api-Key', value: 'abc', description: '' }],
      params: [{ name: 'id', in: 'path', required: true, description: '' }],
      responses: [{ status: 200, contentType: 'application/json', description: 'OK', body: '{}' }],
    });
    await addEntity(ctx, projectId, 'apiEndpoints', {
      id: crypto.randomUUID(),
      collectionId: col.id,
      method: 'POST',
      path: '/users',
      name: 'Create user',
      description: '',
    });
  });

  test.afterAll(async () => {
    if (projectId) await deleteProject(ctx, projectId).catch(() => {});
    await ctx?.dispose().catch(() => {});
  });

  test('issue 1: first sidebar endpoint is selected by default (no empty state)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEndpointReadView(page, projectId);

    const items = page.locator('.api-tree-item');
    await expect(items.first()).toHaveClass(/api-tree-item-selected/);
    await expect(page.getByText('No endpoint selected')).toHaveCount(0);

    // Panel kanan mengikuti endpoint pertama di sidebar (bukan hardcoded nama).
    const firstTitle = ((await items.first().locator('.api-tree-item-title').textContent()) ?? '').trim();
    expect(firstTitle).not.toBe('');
    await expect(page.locator('.preview-title')).toHaveText(firstTitle);
    await shot(page, 'issue1-default-selection');
  });

  test('issue 2: clicking the row path (outside the method button) selects that endpoint', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEndpointReadView(page, projectId);

    const items = page.locator('.api-tree-item');
    await expect(items.first()).toHaveClass(/api-tree-item-selected/);
    const second = items.nth(1);

    // Klik path baris — bukan tombol method/select di kiri baris.
    await second.locator('.api-tree-item-path').click();
    await expect(second).toHaveClass(/api-tree-item-selected/);
    await expect(items.first()).not.toHaveClass(/api-tree-item-selected/);
    // Panel kanan ikut pindah (read view terikat endpoint terpilih).
    const secondTitle = ((await second.locator('.api-tree-item-title').textContent()) ?? '').trim();
    await expect(page.locator('.preview-title')).toHaveText(secondTitle);
    await expect(page.locator('.api-read-actions').getByRole('button', { name: `Delete endpoint ${secondTitle}` })).toBeVisible();
    await shot(page, 'issue2-row-click');
  });

  test('issue 3: trash + Edit share the Tier-1 sm ladder (28px, aligned)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEndpointReadView(page, projectId);

    const trash = page.locator('.api-read-actions .btn-icon');
    const edit = page.locator('.api-read-actions').getByRole('button', { name: 'Edit', exact: true });
    await expect(trash).toBeVisible();
    await expect(edit).toBeVisible();

    const tb = (await trash.boundingBox())!;
    const eb = (await edit.boundingBox())!;
    // Sebelum fix: `.btn-icon` 36px menimpa `.btn-sm` 28px (trash melayang 8px).
    expect(tb.width, 'trash width').toBeGreaterThanOrEqual(27.5);
    expect(tb.width, 'trash width').toBeLessThanOrEqual(28.5);
    expect(tb.height, 'trash height').toBeGreaterThanOrEqual(27.5);
    expect(tb.height, 'trash height').toBeLessThanOrEqual(28.5);
    expect(eb.height, 'Edit height').toBeGreaterThanOrEqual(27.5);
    expect(eb.height, 'Edit height').toBeLessThanOrEqual(28.5);
    const trashCenter = tb.y + tb.height / 2;
    const editCenter = eb.y + eb.height / 2;
    expect(Math.abs(trashCenter - editCenter), 'vertical center delta').toBeLessThanOrEqual(1);
    await shot(page, 'issue3-buttons-desktop');
  });

  test('issue 4a: workbench tab bar is static with an inset active pill (desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEndpointReadView(page, projectId);

    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('.tabs.mt-4 .tab-active')).toBeVisible();

    const m = await measurePill(page);
    expect(m.position, 'bar position (tanpa sticky top:40 di dalam .api-main)').toBe('static');
    expect(m.topGap, 'pill top inset (sebelumnya 0px = flush)').toBeGreaterThanOrEqual(3);
    expect(m.leftGap, 'pill left inset (sebelumnya 0px = flush)').toBeGreaterThanOrEqual(7);
    await shot(page, 'issue4a-tabs-desktop');
  });

  test('issue 4b: active pill stays fully visible when the bar overflows (360px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEndpointReadView(page, projectId);
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('.tabs.mt-4 .tab-active')).toBeVisible();

    await page.setViewportSize({ width: 360, height: 740 });
    await page.waitForTimeout(300);
    await page.getByRole('tab', { name: /Body/ }).click();
    await page.getByRole('tab', { name: /Responses/ }).click();
    await page.waitForTimeout(200);

    const m = await measurePill(page);
    expect(m.scrollWidth, 'bar overflow di 360').toBeGreaterThan(m.clientWidth);
    expect(m.pillRight, 'pill terpotong di tepi kanan').toBeLessThanOrEqual(m.barRight + 1);
    expect(m.pillLeft, 'pill terpotong di tepi kiri').toBeGreaterThanOrEqual(m.barLeft - 1);
    await shot(page, 'issue4b-tabs-mobile-pill');
  });

  test('method select keeps its natural width in edit mode (no "G…" truncation)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEndpointReadView(page, projectId);
    await page.getByRole('button', { name: 'Edit' }).click();

    const row = page.locator('.api-workbench-method');
    await expect(row).toBeVisible();
    const label = row.locator('.ss-trigger-text');
    await expect(label).toBeVisible();

    const m = await label.evaluate((el) => ({
      text: (el.textContent ?? '').trim(),
      over: el.scrollWidth - el.clientWidth,
      wrapWidth: (el.closest('.ss-wrap') as HTMLElement).getBoundingClientRect().width,
    }));
    // Sebelum fix: `.ss-wrap` ikut menyusut → ellipsis memotong label jadi "G…".
    expect(m.text.length, 'method label lengkap').toBeGreaterThan(1);
    expect(m.over, 'label ellipsized').toBeLessThanOrEqual(0);
    expect(m.wrapWidth, 'select width (alami ≥ 60px)').toBeGreaterThanOrEqual(60);
    await shot(page, 'method-select-edit');
  });

  test('issue 5: mobile docs keeps a 12px gap between TOC chip and search', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/project/${projectId}?tab=api&apiView=docs`);

    const toc = page.locator('.api-docs .docs-toc-mobile');
    const search = page.locator('.api-docs .api-docs-search');
    await expect(toc).toBeVisible();
    await expect(search).toBeVisible();

    const tBox = (await toc.boundingBox())!;
    const sBox = (await search.boundingBox())!;
    const gap = sBox.y - (tBox.y + tBox.height);
    // Sebelum fix: `margin: 12px 0 0` menimpa margin-bottom base → gap 0.
    expect(gap, 'jarak TOC ↔ search (px)').toBeGreaterThanOrEqual(11);
    expect(gap, 'jarak TOC ↔ search (px)').toBeLessThanOrEqual(13.5);
    await shot(page, 'issue5-docs-gap-360');
  });

  test.describe('touch', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 740 } });

    test('issue 3 touch: icon buttons grow to the 44px touch target', async ({ page }) => {
      const hoverNone = await page.evaluate(() => matchMedia('(hover: none)').matches);
      expect(hoverNone, 'emulasi touch aktif (hover: none)').toBe(true);

      await page.goto(`/project/${projectId}?tab=api`);
      await expect(page.locator('.api-tree-item.api-tree-item-selected')).toHaveCount(1);
      const trash = page.locator('.api-read-actions .btn-icon');
      await expect(trash).toBeVisible();
      const tb = (await trash.boundingBox())!;
      expect(tb.width, 'touch trash width').toBeGreaterThanOrEqual(43.5);
      expect(tb.height, 'touch trash height').toBeGreaterThanOrEqual(43.5);
      await shot(page, 'issue3-touch-44');
    });
  });
});
