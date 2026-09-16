/** Single source untuk format mata uang & tanggal admin (Wave1.1 ADR-048).
 *  - formatIdr: Rp + grouping ikut bahasa aktif (id-ID vs en-US), prefix Rp tetap (IDR)
 *  - formatDateAdmin: Intl ikut bahasa aktif, deterministik (mengganti toLocaleDateString mentah di 4 tab admin)
 *  - compactId: fix bug replace(',0') -> '.0'
 */

export function formatIdr(amount: number, locale = 'id-ID'): string {
  return `Rp ${amount.toLocaleString(locale)}`;
}

export function formatDateAdmin(iso: string | null | undefined, locale = 'id-ID'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  // deterministik, mono display di UI (global.css tabular)
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function compactId(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}rb`;
  return String(n);
}

export function formatHours(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (!Number.isFinite(rounded)) return '0';
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
