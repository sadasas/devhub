import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '../helpers/fixture';

// Jalan pintas tema + bahasa di content-header global (keputusan §6
// 2026-10-04): terlihat di semua halaman termasuk dashboard, tanpa project.
const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'shots', 'header-prefs');
mkdirSync(SHOTS, { recursive: true });

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), animations: 'disabled' });
  console.log(`SHOT saved header-prefs/${name}.png`);
}

test.describe('header prefs — tema + bahasa global', () => {
  test('theme toggle via header switches data-theme and persists', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Switch theme' });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();
    await expect(page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
    await shot(page, 'header-dark');
    await page.reload();
    await expect(page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
  });

  test('language switch via header flips UI to Indonesian', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Change language' }).click();
    await page.getByRole('menuitemradio', { name: 'Bahasa Indonesia' }).click();
    await expect(page.getByRole('button', { name: 'Ganti bahasa' })).toBeVisible();
    await shot(page, 'header-id');
  });

  test('mobile 360: both triggers visible in header', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Switch theme' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change language' })).toBeVisible();
    await shot(page, 'header-360');
  });
});
