/* DevHub Postgres type constants + matcher (client-side, pure, zero-dep).
   Daftar nama tipe SQL generik Postgres + flag sederhana (sized/precision)
   untuk kebutuhan UI/picker. Clean-room: hanya nama tipe umum + flag buatan
   sendiri, tanpa metadata pihak ketiga.
   Deterministik, tidak pernah throw — input rusak -> null. */

export interface PgTypeEntry {
  name: string;
  group:
    | 'integer'
    | 'numeric'
    | 'character'
    | 'boolean'
    | 'datetime'
    | 'uuid'
    | 'json'
    | 'network'
    | 'binary'
    | 'other';
  sized?: boolean;
  precision?: boolean;
}

export const POSTGRES_TYPES: PgTypeEntry[] = [
  { name: 'SMALLINT', group: 'integer' },
  { name: 'INTEGER', group: 'integer' },
  { name: 'BIGINT', group: 'integer' },
  { name: 'SMALLSERIAL', group: 'integer' },
  { name: 'SERIAL', group: 'integer' },
  { name: 'BIGSERIAL', group: 'integer' },
  { name: 'DECIMAL', group: 'numeric', precision: true },
  { name: 'NUMERIC', group: 'numeric', precision: true },
  { name: 'REAL', group: 'numeric' },
  { name: 'VARCHAR', group: 'character', sized: true },
  { name: 'CHAR', group: 'character', sized: true },
  { name: 'TEXT', group: 'character' },
  { name: 'BOOLEAN', group: 'boolean' },
  { name: 'DATE', group: 'datetime' },
  { name: 'TIME', group: 'datetime', precision: true },
  { name: 'TIMETZ', group: 'datetime', precision: true },
  { name: 'TIMESTAMP', group: 'datetime', precision: true },
  { name: 'TIMESTAMPTZ', group: 'datetime', precision: true },
  { name: 'INTERVAL', group: 'datetime', precision: true },
  { name: 'UUID', group: 'uuid' },
  { name: 'JSON', group: 'json' },
  { name: 'JSONB', group: 'json' },
  { name: 'BYTEA', group: 'binary' },
];

/** Cocokkan nama tipe Postgres: case-insensitive, trim, strip param
    (`varchar(255)` -> `VARCHAR`). Null bila tak cocok. Tidak pernah throw. */
export function matchPgType(input: string): PgTypeEntry | null {
  try {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (trimmed === '') return null;
    const paren = trimmed.indexOf('(');
    const bare = (paren >= 0 ? trimmed.slice(0, paren) : trimmed).trim();
    if (bare === '') return null;
    const key = bare.toUpperCase();
    for (const entry of POSTGRES_TYPES) {
      if (entry.name === key) return entry;
    }
    return null;
  } catch {
    return null;
  }
}
