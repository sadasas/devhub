import { test, expect, type Page } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, uniqueName } from '../helpers/api';
import { waitForSaved } from '../helpers/wait';

// Navigasi 2026-10-04: tab "By Due Date" / "Calendar" / "Buckets" sudah tidak
// ada — Board memakai switcher button (By Status / By Milestone / Calendar),
// lalu DueCalendar langsung (sub-tab Month/Week). Baris 20 lama
// (`min-height: 112px`) stale sejak `min-height: 0` (commit 519a49e) → dihapus.
async function gotoCalendar(page: Page, projectId: string): Promise<void> {
  await page.goto(`/project/${projectId}`);
  await expect(page.locator('[data-testid="kanban-col-todo"]')).toBeVisible();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.locator('.due-cal-grid')).toBeVisible();
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test.describe('due dates + calendar (M19)', () => {
  test('quick-create with due date, calendar drop reschedules, persists after reload', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-Due'));
    const title = uniqueName('E2E-DueTask');

    await gotoCalendar(page, projectId);
    await expect(page.locator('.due-cal-grid')).toHaveCSS('display', 'grid');
    await expect(page.locator('.due-cal-cell').first()).toHaveCSS('overflow', 'hidden');
    const widths = await page.locator('.due-cal-cell').evaluateAll((els) => els.map((e) => e.offsetWidth));
    expect(new Set(widths).size).toBe(1);
    const heights = await page.locator('.due-cal-cell').evaluateAll((els) => els.map((e) => e.offsetHeight));
    expect(new Set(heights).size).toBe(1);

    // Klik cell hari ini → quick-create langsung membuka modal New task
    // (tanpa dialog perantara "No tasks due").
    const todayIso = isoOf(new Date());
    await page.locator(`[data-date="${todayIso}"]`).click();
    await expect(page.getByRole('heading', { name: 'New task' })).toBeVisible();
    await page.locator('form#new-task-form').getByLabel('Name').fill(title);
    await page.locator('button[form="new-task-form"]').click();

    const chip = page.locator('.due-cal-task', { hasText: title });
    await expect(chip).toBeVisible();
    await expect(page.locator('.due-cal-task').first()).toHaveCSS('overflow-x', 'hidden');
    await waitForSaved(page, projectId);

    // REGRESI 2026-10-04: baris berisi task vs kosong tingginya sama (seragam
    // collapsed 142). Sebelum fix: 142 vs 112 (unique = 2).
    const heightsAfter = await page.locator('.due-cal-cell').evaluateAll((els) => els.map((e) => e.offsetHeight));
    expect(new Set(heightsAfter).size).toBe(1);

    // Drop the chip on tomorrow's cell to reschedule.
    const tomorrowIso = isoOf(new Date(Date.now() + 86_400_000));
    await chip.dragTo(page.locator(`[data-date="${tomorrowIso}"]`));
    await waitForSaved(page, projectId);

    // Tanggal pindah tercatat di API (fix-2: startDate = dueDate = target).
    const listRes = await ctx.get(`/api/v1/projects/${projectId}/tasks`);
    expect(listRes.ok()).toBeTruthy();
    const listBody = (await listRes.json()) as {
      items: { title: string; dueDate: string | null; startDate: string | null }[];
    };
    const moved = listBody.items.find((t) => t.title === title);
    expect(moved?.dueDate).toBe(tomorrowIso);
    expect(moved?.startDate).toBe(tomorrowIso);

    // Reload: chip tetap dirender sekali (bukti persistensi di UI).
    // NOTE: chip dirender di overlay `.due-cal-spans-container`, BUKAN di
    // dalam cell `[data-date]` — locator cope-date takkan pernah cocok.
    await page.reload();
    await gotoCalendar(page, projectId);
    await expect(page.locator('.due-cal-task', { hasText: title })).toBeVisible();
    await expect(page.locator('.due-cal-task', { hasText: title })).toHaveCount(1);
  });
});
