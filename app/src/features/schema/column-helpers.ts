/* DevHub column helpers (pure, zero-dep). Rumah untuk helper kolom kecil. */

function uniqueIndexParts(raw: string): { unique: boolean; expr: string } {
  const colon = raw.match(/^unique\s*:\s*(.+)$/i);
  if (colon) return { unique: true, expr: (colon[1] ?? '').trim() };
  const space = raw.match(/^unique\s+(.+)$/i);
  if (space) return { unique: true, expr: (space[1] ?? '').trim() };
  return { unique: false, expr: raw.trim() };
}

/** True bila ada entri unique (`unique:`/`unique `) yang expr-nya sama dengan nama kolom (case-insensitive). */
export function isUniqueIndex(indexes: string[], colName: string): boolean {
  try {
    if (!Array.isArray(indexes)) return false;
    if (typeof colName !== 'string') return false;
    const target = colName.trim().toLowerCase();
    if (target === '') return false;
    return indexes.some((raw) => {
      if (typeof raw !== 'string') return false;
      const { unique, expr } = uniqueIndexParts(raw);
      return unique && expr.toLowerCase() === target;
    });
  } catch {
    return false;
  }
}

/** Toggle unique per-kolom: hapus semua entri unique kolom itu, atau append `unique:<col>`. Tidak pernah throw/mutasi input. */
// composite `unique:(a, b)` tidak disentuh toggle per-kolom (di luar scope).
export function toggleUnique(indexes: string[], colName: string): string[] {
  try {
    const list = Array.isArray(indexes) ? [...indexes] : [];
    if (typeof colName !== 'string') return list;
    const name = colName.trim();
    if (name === '') return list;
    const target = name.toLowerCase();
    if (isUniqueIndex(list, name)) {
      return list.filter((raw) => {
        if (typeof raw !== 'string') return true;
        const { unique, expr } = uniqueIndexParts(raw);
        return !(unique && expr.toLowerCase() === target);
      });
    }
    return [...list, `unique:${name}`];
  } catch {
    return Array.isArray(indexes) ? [...indexes] : [];
  }
}
