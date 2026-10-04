/**
 * Helper konten dinamis untuk ShellBanner (global top-of-layout alerts).
 * - daysUntil(): sisa hari kalender menuju deadline ISO — dipakai countdown
 *   GraceBanner ("tersisa X hari"). Null bila tak valid / sudah lewat.
 * Pure + testable — tanpa DOM/storage.
 */

/** Sisa hari kalender (UTC) dari hari ini ke tanggal `iso`. Null bila tak valid/lewat. */
export function daysUntil(iso: string): number | null {
  try {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return null;
    const day = 86_400_000;
    const today = Math.floor(Date.now() / day);
    const target = Math.floor(ms / day);
    const diff = target - today;
    return diff >= 0 ? diff : null;
  } catch {
    return null;
  }
}
