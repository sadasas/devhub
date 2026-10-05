import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, deleteProject, uniqueName } from '../helpers/api';
import type { APIRequestContext } from '@playwright/test';

// Regresi aturan shadow §8 (design-tokens.md): `shadow-raised` khusus
// overlay/sheet — konten in-flow (chip filter aktif, kartu antre, stat
// terpilih) wajib `box-shadow: none`; seleksi ditandai `accent-dim`.
const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'shots', 'dashboard-flat');
mkdirSync(SHOTS, { recursive: true });

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), animations: 'disabled' });
  console.log(`SHOT saved dashboard-flat/${name}.png`);
}

async function expectFlat(page: Page): Promise<void> {
  // Chip filter aktif = selected-pill kanonik (accent-dim, tanpa shadow).
  const chip = page.locator('.archive-filter-btn-active');
  await expect(chip).toBeVisible();
  await expect(chip).toHaveCSS('box-shadow', 'none');
  const chipBg = await chip.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(chipBg, 'chip aktif bukan transparan').not.toBe('rgba(0, 0, 0, 0)');
  expect(chipBg, 'chip aktif bukan lagi bg-elevated (#fffcf8)').not.toBe('rgb(255, 252, 248)');

  // Kartu antre "Open project" = flat hairline box, tanpa shadow.
  const card = page.locator('.welcome-queue-card').first();
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS('box-shadow', 'none');

  // Stat terpilih = dim tint + accent-ring, tanpa shadow.
  const bento = page.locator('.bento-stat-card[aria-pressed="true"]');
  await expect(bento).toBeVisible();
  await expect(bento).toHaveCSS('box-shadow', 'none');
}

test.describe('dashboard flat surfaces — aturan shadow §8', () => {
  test.describe.configure({ mode: 'serial' });
  let ctx: APIRequestContext;
  let projectId = '';

  test.beforeAll(async () => {
    ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    // Semua blok welcome (filter, antre, bento) di-gate teamProjects > 0.
    projectId = await createProject(ctx, teamId, uniqueName('E2E-Flat'));
  });

  test.afterAll(async () => {
    if (projectId) await deleteProject(ctx, projectId).catch(() => {});
    await ctx?.dispose().catch(() => {});
  });

  test('light: chip, kartu antre, stat terpilih tanpa shadow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expectFlat(page);
    await shot(page, 'dashboard-flat-light');
  });

  test('dark: tanpa shadow', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('devhub.theme', 'dark');
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
    await expectFlat(page);
    await shot(page, 'dashboard-flat-dark');
  });
});
