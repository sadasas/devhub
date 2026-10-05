import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, addEntity, uniqueName } from '../helpers/api';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, '..', 'shots', 'ui-fixes');
mkdirSync(SHOTS, { recursive: true });

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), animations: 'disabled' });
  console.log(`SHOT saved ui-fixes/${name}.png`);
}

async function assertWrapsCentered(page: Page): Promise<number> {
  const wraps = page.locator('.input-slot-wrap');
  const count = await wraps.count();
  expect(count, 'password fields with a toggle slot').toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const wrap = wraps.nth(i);
    const input = wrap.locator('input');
    const toggle = wrap.locator('.password-toggle');
    expect(await toggle.count(), `wrap #${i} has exactly one toggle`).toBe(1);
    const ib = await input.boundingBox();
    const tb = await toggle.boundingBox();
    expect(ib, `wrap #${i} input box`).toBeTruthy();
    expect(tb, `wrap #${i} toggle box`).toBeTruthy();
    const inputCenter = ib!.y + ib!.height / 2;
    const toggleCenter = tb!.y + tb!.height / 2;
    expect(Math.abs(inputCenter - toggleCenter), `wrap #${i} vertical center delta (px)`).toBeLessThanOrEqual(1);
    expect(tb!.x, `wrap #${i} toggle left inside input`).toBeGreaterThanOrEqual(ib!.x - 0.5);
    expect(tb!.x + tb!.width, `wrap #${i} toggle right inside input`).toBeLessThanOrEqual(ib!.x + ib!.width + 0.5);
  }
  return count;
}

test.describe('fix 1 — password toggle centering', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('sign-in: single toggle centered and flips visibility', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sign in to DevHub' })).toBeVisible();
    expect(await assertWrapsCentered(page)).toBe(1);

    const input = page.locator('.input-slot-wrap input');
    const toggle = page.locator('.password-toggle');
    expect(await input.getAttribute('type')).toBe('password');
    await toggle.click();
    expect(await input.getAttribute('type')).toBe('text');
    await expect(toggle).toHaveAttribute('aria-label', 'Hide password');
    await toggle.click();
    expect(await input.getAttribute('type')).toBe('password');
    await expect(toggle).toHaveAttribute('aria-label', 'Show password');
    await shot(page, 'auth-signin-toggle');
  });

  test('sign-up: both toggles centered', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create one' }).click();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    expect(await assertWrapsCentered(page)).toBe(2);
    await shot(page, 'auth-signup-toggles');
  });

  test('reset password: password + confirm toggles centered', async ({ page }) => {
    await page.goto('/reset-password?token=e2e-dummy');
    // Route di-lazy-load — tunggu form muncul sebelum mengukur.
    await expect(page.locator('.input-slot-wrap')).toHaveCount(2);
    expect(await assertWrapsCentered(page)).toBe(2);
    await shot(page, 'auth-reset-toggles');
  });
});

test.describe('fix 2 — assignee dropdown has no duplicate self row', () => {
  test('shows "Assign to me" once while the owner is a team member', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-Assignee'));

    // Owner wajib anggota tim — kalau tidak, test ini tidak membuktikan apa-apa.
    const membersRes = await ctx.get(`/api/v1/teams/${teamId}/members`);
    expect(membersRes.ok()).toBeTruthy();
    const members = (await membersRes.json()) as { members: { id: string; email: string }[] };
    expect(members.members.length).toBeGreaterThanOrEqual(1);

    await page.goto(`/project/${projectId}`);
    await expect(page.locator('[data-testid="kanban-col-todo"]')).toBeVisible();
    await page.keyboard.press('n');
    await expect(page.getByRole('heading', { name: 'New task' })).toBeVisible();

    await page.getByRole('button', { name: 'Assignee', exact: true }).click();
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible();
    await expect(page.getByRole('option', { name: 'Assign to me' })).toBeVisible();

    // Sebelum fix: "None" + "Assign to me" + baris email sendiri = 3 (duplikat diri).
    expect(await options.count()).toBe(2);
    // Tidak ada baris email anggota (termasuk owner yang tampil sebagai email).
    for (const m of members.members) {
      await expect(page.getByRole('option', { name: m.email })).toHaveCount(0);
    }
    expect(await page.getByRole('option', { name: /@/ }).count()).toBe(0);

    await shot(page, 'assignee-dropdown');
    await page.getByRole('option', { name: 'Assign to me' }).click();
    await expect(page.getByRole('option', { name: 'Assign to me' })).toHaveCount(0);
  });
});

test.describe('fix 3 — mini-row actions replace content on hover', () => {
  // Serial + satu project bersama: free tier dibatasi 3 project/workspace,
  // sedangkan describe lain (fix 2) membuat 1 project lagi saat paralel.
  test.describe.configure({ mode: 'serial' });
  let projectId = '';
  let taskTitle = '';

  test.beforeAll(async () => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    projectId = await createProject(ctx, teamId, uniqueName('E2E-Hover'));
    taskTitle = uniqueName('Hover-task');
    await addEntity(ctx, projectId, 'labelDefs', {
      id: crypto.randomUUID(),
      name: 'ui',
      color: 'blue',
      description: '',
    });
    await addEntity<{ id: string }>(ctx, projectId, 'tasks', {
      id: crypto.randomUUID(),
      title: taskTitle,
      status: 'todo',
      priority: 'medium',
      labels: ['ui'],
      blockedBy: [],
      description: '',
      checklist: [{ id: crypto.randomUUID(), title: 'Step one', done: false }],
      attachments: [
        {
          id: crypto.randomUUID(),
          provider: 'link',
          name: 'Spec doc',
          mime: '',
          size: 0,
          storageKey: null,
          url: 'https://example.com/spec.pdf',
          linkedAt: new Date().toISOString(),
          linkedBy: null,
        },
      ],
    });
  });

  test('labels / checklist / attachment rows: idle has no reserved gap, hover reveals actions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // --- Labels (project settings) ---
    await page.goto(`/project/${projectId}?tab=settings&section=labels`);
    const labelRow = page.locator('.mini-row').first();
    await expect(labelRow).toBeVisible();
    const labelMeta = labelRow.locator('.mini-row-meta');
    const labelActions = labelRow.locator('.mini-row-actions');
    await expect(labelRow).toContainText('ui');
    await expect(labelMeta).toContainText('tasks');

    // Idle: aksi tersembunyi, meta di tepi kanan (tanpa ruang cadangan).
    expect(await labelActions.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    expect(await labelMeta.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    const rowBox = (await labelRow.boundingBox())!;
    const metaBox = (await labelMeta.boundingBox())!;
    expect(rowBox.x + rowBox.width - (metaBox.x + metaBox.width), 'idle: meta reaches row right edge (no dead space)').toBeLessThanOrEqual(2);
    await shot(page, 'labels-idle');

    // Hover: aksi tampil, meta fade-out.
    await labelRow.hover();
    await page.waitForTimeout(300);
    expect(await labelActions.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    expect(await labelActions.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('auto');
    expect(await labelMeta.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    await shot(page, 'labels-hover');

    // --- Task detail: checklist + attachment ---
    await page.goto(`/project/${projectId}`);
    const card = page.locator('[data-testid="task-card"]').filter({ hasText: taskTitle });
    await expect(card).toBeVisible();
    await card.click();

    const checkRow = page.locator('.mini-row').filter({ hasText: 'Step one' }).first();
    await expect(checkRow).toBeVisible();
    const checkBody = checkRow.locator('.mini-row-body');
    const checkActions = checkRow.locator('.mini-row-actions');
    expect(await checkBody.evaluate((el) => getComputedStyle(el).paddingRight)).toBe('0px');
    expect(await checkActions.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    await shot(page, 'checklist-idle');

    await checkRow.hover();
    await page.waitForTimeout(300);
    expect(await checkActions.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    expect(parseFloat(await checkBody.evaluate((el) => getComputedStyle(el).paddingRight))).toBeGreaterThan(0);
    await shot(page, 'checklist-hover');

    const attRow = page.locator('.mini-row').filter({ hasText: 'Spec doc' }).first();
    await expect(attRow).toBeVisible();
    const attBody = attRow.locator('.mini-row-body');
    const attActions = attRow.locator('.mini-row-actions');
    expect(await attBody.evaluate((el) => getComputedStyle(el).paddingRight)).toBe('0px');
    expect(await attActions.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    await shot(page, 'attach-idle');

    await attRow.hover();
    await page.waitForTimeout(300);
    expect(await attActions.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    expect(parseFloat(await attBody.evaluate((el) => getComputedStyle(el).paddingRight))).toBeGreaterThan(0);
    await shot(page, 'attach-hover');
  });

  test('checklist hover reveal in dark theme', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('devhub.theme', 'dark');
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/project/${projectId}`);
    await expect(page.locator('[data-testid="kanban-col-todo"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
    const card = page.locator('[data-testid="task-card"]').filter({ hasText: taskTitle });
    await card.click();
    const checkRow = page.locator('.mini-row').filter({ hasText: 'Step one' }).first();
    await expect(checkRow).toBeVisible();
    await checkRow.hover();
    await page.waitForTimeout(300);
    expect(await checkRow.locator('.mini-row-actions').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    await shot(page, 'checklist-hover-dark');
  });

  test('narrow 360px: labels swap actions for the row menu (no hidden dead space)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/project/${projectId}?tab=settings&section=labels`);
    const labelRow = page.locator('.mini-row').first();
    await expect(labelRow).toBeVisible();
    await expect(labelRow).toContainText('ui');
    expect(await labelRow.locator('.mini-row-actions').count()).toBe(0);
    await expect(labelRow.getByRole('button', { name: /More actions for ui/ })).toBeVisible();
    await shot(page, 'labels-360');
  });
});
