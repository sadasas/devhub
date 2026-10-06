import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../helpers/fixture';
import { ownerContext } from '../helpers/api';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, '..', 'shots', 'settings-nav-empty');
mkdirSync(SHOTS, { recursive: true });

test('settings nav empty state: doodle + text centered', async ({ page }) => {
  const ctx = await ownerContext();
  try {
    const res = await ctx.get('/api/v1/teams');
    if (!res.ok()) throw new Error(`teams failed (${res.status()})`);
    const body = (await res.json()) as { teams: { slug: string }[] };
    const slug = body.teams[0]?.slug;
    expect(slug, 'owner has a team with slug').toBeTruthy();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/${slug}/settings`);
    const search = page.locator('.settings-nav .search-field-input');
    await expect(search).toBeVisible();
    await search.fill('zzz-tidak-ada-hasil');

    const empty = page.locator('.settings-nav-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('No matching settings');

    // Kontrak CSS: kolom flex rata-tengah + teks tengah.
    const style = await empty.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { display: cs.display, direction: cs.flexDirection, align: cs.alignItems, text: cs.textAlign };
    });
    expect(style, 'empty-state layout contract').toEqual({
      display: 'flex',
      direction: 'column',
      align: 'center',
      text: 'center',
    });

    // Bukti piksel: doodle (anak div pertama) terpusat horizontal di dalam blok.
    const emptyBox = (await empty.boundingBox())!;
    const doodle = empty.locator(':scope > div').first();
    const doodleBox = (await doodle.boundingBox())!;
    const emptyCenter = emptyBox.x + emptyBox.width / 2;
    const doodleCenter = doodleBox.x + doodleBox.width / 2;
    expect(Math.abs(emptyCenter - doodleCenter), 'doodle horizontal center delta (px)').toBeLessThanOrEqual(1);

    // Teks <p> membentang penuh (block) sehingga text-align:center berlaku simetris.
    const textBox = (await empty.locator(':scope > p').boundingBox())!;
    expect(textBox.x, 'text spans empty left edge').toBeLessThanOrEqual(emptyBox.x + 1);
    expect(emptyBox.x + emptyBox.width - (textBox.x + textBox.width), 'text spans empty right edge').toBeLessThanOrEqual(1);

    await page.locator('.settings-nav').screenshot({ path: path.join(SHOTS, 'empty-centered.png'), animations: 'disabled' });
    console.log('SHOT saved settings-nav-empty/empty-centered.png');
  } finally {
    await ctx.dispose();
  }
});
