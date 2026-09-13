/** CSV client-side sederhana untuk Export per-tabel (Fase 1).
 *  Tanpa dependensi baru. Reuse format existing (formatIdr/formatDateAdmin di caller).
 */

export interface CsvColumn {
  key: string;
  label: string;
}

function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(
  rows: Array<Record<string, unknown>>,
  columns: CsvColumn[],
): string {
  const head = columns.map((c) => escapeCell(c.label)).join(',');
  const lines = rows.map((r) => columns.map((c) => escapeCell(r[c.key])).join(','));
  return [head, ...lines].join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // revoke async agar download sempat mulai di Safari
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
