import { test, expect } from '../helpers/fixture';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('language switcher', () => {
  test('auto-detects browser locale and persists explicit choice on the auth page', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'language', { get: () => 'id-ID' });
    });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Masuk ke DevHub' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');

    const toggle = page.getByRole('button', { name: 'Ganti bahasa' });
    await toggle.click();
    const menu = page.getByRole('menu', { name: 'Bahasa' });
    await expect(menu.getByRole('menuitemradio', { name: 'Bahasa Indonesia' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await menu.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in to DevHub' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.evaluate(() => localStorage.getItem('devhub.lang'))).resolves.toBe('en');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Sign in to DevHub' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('stored id preference survives reload and shows Indonesian UI', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('devhub.lang', 'id');
    });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Masuk ke DevHub' })).toBeVisible();
    await expect(page.locator('form.auth-form').getByLabel('Email')).toBeVisible();

    await page.getByRole('button', { name: 'Ganti bahasa' }).click();
    await page
      .getByRole('menu', { name: 'Bahasa' })
      .getByRole('menuitemradio', { name: 'English' })
      .click();
    await expect(page.getByRole('heading', { name: 'Sign in to DevHub' })).toBeVisible();
  });
});
