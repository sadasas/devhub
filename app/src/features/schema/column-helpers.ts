/* DevHub column helpers (pure, zero-dep). Rumah untuk helper kolom kecil. */

import { matchPgType } from './postgres-types';

/** Varian serial Postgres -> tipe basis integer-nya (uppercase, tanpa param). */
const SERIAL_BASE: Record<string, string> = {
  SMALLSERIAL: 'SMALLINT',
  SERIAL: 'INTEGER',
  BIGSERIAL: 'BIGINT',
};

/** True bila tipe adalah varian SERIAL (case-insensitive, param diabaikan). */
export function isSerialType(type: unknown): boolean {
  try {
    if (typeof type !== 'string') return false;
    const bare = type.trim().toUpperCase().split('(')[0]!.trim();
    return bare in SERIAL_BASE;
  } catch {
    return false;
  }
}

/** True bila tipe keluarga integer (termasuk varian serial + alias INT). */
export function isIntegerType(type: unknown): boolean {
  try {
    if (typeof type !== 'string') return false;
    const t = type.trim();
    if (t === '') return false;
    if (isSerialType(t)) return true;
    if (/^int$/i.test(t)) return true;
    return matchPgType(t)?.group === 'integer';
  } catch {
    return false;
  }
}

/** Auto increment hanya bermakna untuk kolom integer. */
export function canAutoincrement(type: unknown): boolean {
  try {
    return isIntegerType(type);
  } catch {
    return false;
  }
}

/**
 * Tipe SERIAL untuk flag auto increment (uppercase kanonis):
 * SMALLINT->SMALLSERIAL, BIGINT->BIGSERIAL, INTEGER/INT->SERIAL.
 * Sudah serial -> apa adanya (uppercase); non-integer -> null (abaikan flag).
 */
export function serialTypeFor(type: unknown): string | null {
  try {
    if (typeof type !== 'string') return null;
    const bare = type.trim().toUpperCase().split('(')[0]!.trim();
    if (bare === '') return null;
    if (bare in SERIAL_BASE) return bare;
    if (/^SMALLINT$/.test(bare)) return 'SMALLSERIAL';
    if (/^BIGINT$/.test(bare)) return 'BIGSERIAL';
    if (/^INT(EGER)?$/.test(bare)) return 'SERIAL';
    return null;
  } catch {
    return null;
  }
}

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
export function toggleUnique(indexes: string[], colName: string): string[] {  try {
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

/** True bila ada entri index BIASA (bukan unique) yang expr-nya sama dengan nama kolom. */
export function isPlainIndex(indexes: string[], colName: string): boolean {
  try {
    if (!Array.isArray(indexes)) return false;
    if (typeof colName !== 'string') return false;
    const target = colName.trim().toLowerCase();
    if (target === '') return false;
    return indexes.some((raw) => {
      if (typeof raw !== 'string') return false;
      const { unique, expr } = uniqueIndexParts(raw);
      return !unique && expr.toLowerCase() === target;
    });
  } catch {
    return false;
  }
}

/** Toggle index biasa per-kolom: hapus entri plain kolom itu, atau append `<col>`. Composite/ekspresi tak tersentuh. */
export function togglePlainIndex(indexes: string[], colName: string): string[] {
  try {
    const list = Array.isArray(indexes) ? [...indexes] : [];
    if (typeof colName !== 'string') return list;
    const name = colName.trim();
    if (name === '') return list;
    const target = name.toLowerCase();
    if (isPlainIndex(list, name)) {
      return list.filter((raw) => {
        if (typeof raw !== 'string') return true;
        const { unique, expr } = uniqueIndexParts(raw);
        return !(!unique && expr.toLowerCase() === target);
      });
    }
    return [...list, name];
  } catch {
    return Array.isArray(indexes) ? [...indexes] : [];
  }
}
