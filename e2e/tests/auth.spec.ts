import { test, expect, type Page, withApiRoutes } from '../helpers/fixture';
import { uniqueEmail, uniqueIp } from '../helpers/api';

test.use({ storageState: { cookies: [], origins: [] } });

const PASSWORD = 'E2ePassw0rd!';

async function bypassLimiter(page: Page, paths: string[]): Promise<void> {
  for (const path of paths) {
    await page.route(`**${path}`, async (route) => {
      await route.continue({
        headers: { ...route.request().headers(), 'X-Forwarded-For': uniqueIp() },
      });
    });
  }
}

test.describe('auth round-trip', () => {
  test('register → dashboard → logout → login', async ({ page }) => {
    const email = uniqueEmail();
    await bypassLimiter(page, ['/api/v1/auth/register', '/api/v1/auth/login']);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sign in to DevHub' })).toBeVisible();

    await page.getByRole('button', { name: 'Create one' }).click();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await page.locator('form.auth-form').getByLabel('Email').fill(email);
    const pw = page.locator('form.auth-form input[type="password"]');
    await pw.first().fill(PASSWORD);
    await pw.nth(1).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in to DevHub' })).toBeVisible();

    await page.locator('form.auth-form').getByLabel('Email').fill(email);
    await page.locator('form.auth-form input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  });

  test('invalid login shows error and stays on auth page', async ({ page }) => {
    await bypassLimiter(page, ['/api/v1/auth/login']);

    await page.goto('/');
    await page.locator('form.auth-form').getByLabel('Email').fill(uniqueEmail());
    await page.locator('form.auth-form').getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('heading', { name: 'Sign in to DevHub' })).toBeVisible();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});