/* DevHub Postgres DDL exporter (client-side, pure, zero-dep).
   Table[] + Relation[] -> Postgres DDL string.
   Urutan stabil: CREATE TYPE (enum) -> CREATE TABLE (PK inline)
   -> COMMENT ON -> CREATE [UNIQUE] INDEX -> ALTER TABLE ADD CONSTRAINT (FK).
   Tabel di-sort by name agar deterministik (diff git bersih). */

import type { OnDelete, Relation, Table } from '../../lib/types';
import { serialTypeFor } from './column-helpers';

const ON_DELETE_SQL: Record<OnDelete, string> = {
  cascade: 'CASCADE',
  setNull: 'SET NULL',
  restrict: 'RESTRICT',
};

/** Quote identifier dengan double-quote hanya bila perlu. */
export function safeIdent(name: string): string {
  if (/^[a-z_][a-z0-9_]*$/.test(name)) return name;
  return `"${name.replace(/"/g, '""')}"`;
}

function escapeLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function cmpStr(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sanitizeFragment(value: string): string {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s.slice(0, 40) || 'col';
}

function truncateIdent(name: string, max = 63): string {
  return name.length > max ? name.slice(0, max) : name;
}

/** Parse tipe kolom enum -> daftar label, atau null bila bukan enum.
    Mendukung `enum('a','b')`, `ENUM("a", "b")`, dan `enum: a, b`. */
function parseEnumValues(rawType: string): string[] | null {
  const trimmed = rawType.trim();
  const paren = trimmed.match(/^enum\s*\(([\s\S]*)\)$/i);
  if (paren) {
    const inner = (paren[1] ?? '').trim();
    if (!inner) return null;
    const quoted: string[] = [];
    const re = /'((?:''|[^'])*)'|"((?:""|[^"])*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(inner)) !== null) {
      const single = m[1];
      const dbl = m[2];
      if (single !== undefined) quoted.push(single.replace(/''/g, "'"));
      else if (dbl !== undefined) quoted.push(dbl.replace(/""/g, '"'));
    }
    if (quoted.length > 0) return quoted;
    const bare = inner
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter((s) => s !== '');
    return bare.length > 0 ? bare : null;
  }
  const colon = trimmed.match(/^enum\s*:\s*(.+)$/i);
  if (colon) {
    const labels = (colon[1] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter((s) => s !== '');
    return labels.length > 0 ? labels : null;
  }
  return null;
}

function uniqueIndexParts(raw: string): { unique: boolean; expr: string } {
  const colon = raw.match(/^unique\s*:\s*(.+)$/i);
  if (colon) return { unique: true, expr: (colon[1] ?? '').trim() };
  const space = raw.match(/^unique\s+(.+)$/i);
  if (space) return { unique: true, expr: (space[1] ?? '').trim() };
  return { unique: false, expr: raw.trim() };
}

function indexExprSql(expr: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(expr)) return safeIdent(expr);
  return expr;
}

export function toPostgresDDL(tables: Table[], relations: Relation[]): string {
  const sorted = [...(tables ?? [])]
    .filter((t) => t && typeof t.name === 'string' && t.name.trim() !== '')
    .sort((a, b) => cmpStr(a.name, b.name) || cmpStr(a.id, b.id));

  const tableById = new Map(sorted.map((t) => [t.id, t]));
  const colsByTable = new Map<string, Map<string, string>>();
  for (const t of sorted) {
    const m = new Map<string, string>();
    for (const c of t.columns ?? []) {
      if (c && typeof c.name === 'string' && c.name.trim() !== '') m.set(c.id, c.name);
    }
    colsByTable.set(t.id, m);
  }

  // -- Phase 1: enum registry (table/column order deterministik) --
  const enums = new Map<string, string[]>();
  const colEnumType = new Map<string, string>(); // `${tableId}.${colId}` -> enum type name
  for (const t of sorted) {
    for (const c of t.columns ?? []) {
      if (!c || c.name.trim() === '' || !c.type) continue;
      const labels = parseEnumValues(c.type);
      if (!labels) continue;
      let base = `${sanitizeFragment(t.name)}_${sanitizeFragment(c.name)}_enum`;
      base = truncateIdent(base);
      let candidate = base;
      let n = 1;
      while (enums.has(candidate) && enums.get(candidate)?.join('\0') !== labels.join('\0')) {
        n += 1;
        const suffix = `_${n}`;
        candidate = base.slice(0, 63 - suffix.length) + suffix;
      }
      if (!enums.has(candidate)) enums.set(candidate, labels);
      colEnumType.set(`${t.id}.${c.id}`, candidate);
    }
  }

  const statements: string[] = [];

  // -- Phase 1 emit: CREATE TYPE --
  const enumNames = [...enums.keys()].sort(cmpStr);
  for (const name of enumNames) {
    const labels = enums.get(name) ?? [];
    const list = labels.map((l) => escapeLiteral(l)).join(', ');
    statements.push(`CREATE TYPE IF NOT EXISTS ${safeIdent(name)} AS ENUM (${list});`);
  }

  // -- Phase 2 emit: CREATE TABLE (PK inline) --
  const validTables = sorted.filter((t) =>
    (t.columns ?? []).some((c) => c && c.name.trim() !== ''),
  );
  for (const t of validTables) {
    const lines: string[] = [];
    const pkCols: string[] = [];
    for (const c of t.columns ?? []) {
      if (!c || c.name.trim() === '') continue;
      const enumType = colEnumType.get(`${t.id}.${c.id}`);
      // Auto increment: INTEGER -> SERIAL (kanonis, DEFAULT eksplisit digugurkan).
      let serial: string | null = null;
      try {
        serial = c.autoincrement === true ? serialTypeFor(c.type) : null;
      } catch {
        serial = null;
      }
      const dataType = enumType ? safeIdent(enumType) : serial ?? (c.type.trim() !== '' ? c.type.trim() : 'TEXT');
      const notNull = !c.nullable || c.primaryKey;
      const def =
        !serial && c.default != null && c.default.trim() !== '' ? ` DEFAULT ${c.default.trim()}` : '';
      lines.push(`  ${safeIdent(c.name)} ${dataType}${notNull ? ' NOT NULL' : ''}${def}`);
      if (c.primaryKey) pkCols.push(safeIdent(c.name));
    }
    if (pkCols.length > 0) lines.push(`  PRIMARY KEY (${pkCols.join(', ')})`);
    statements.push(
      `CREATE TABLE IF NOT EXISTS ${safeIdent(t.name)} (\n${lines.join(',\n')}\n);`,
    );
  }

  // -- Phase 3 emit: COMMENT ON (table + column) --
  for (const t of validTables) {
    if (t.comment.trim() !== '') {
      statements.push(
        `COMMENT ON TABLE ${safeIdent(t.name)} IS ${escapeLiteral(t.comment.trim())};`,
      );
    }
    for (const c of t.columns ?? []) {
      if (!c || c.name.trim() === '' || c.comment.trim() === '') continue;
      statements.push(
        `COMMENT ON COLUMN ${safeIdent(t.name)}.${safeIdent(c.name)} IS ${escapeLiteral(c.comment.trim())};`,
      );
    }
  }

  // -- Phase 4 emit: CREATE [UNIQUE] INDEX --
  const usedIndexNames = new Set<string>();
  for (const t of validTables) {
    for (const raw of t.indexes ?? []) {
      if (typeof raw !== 'string' || raw.trim() === '') continue;
      const { unique, expr } = uniqueIndexParts(raw);
      if (expr === '' || expr.includes(';')) continue;
      const base = truncateIdent(`idx_${sanitizeFragment(t.name)}_${sanitizeFragment(expr)}`);
      let name = base;
      let n = 1;
      while (usedIndexNames.has(name)) {
        n += 1;
        const suffix = `_${n}`;
        name = base.slice(0, 63 - suffix.length) + suffix;
      }
      usedIndexNames.add(name);
      const kind = unique ? 'CREATE UNIQUE INDEX IF NOT EXISTS' : 'CREATE INDEX IF NOT EXISTS';
      statements.push(
        `${kind} ${safeIdent(name)} ON ${safeIdent(t.name)} (${indexExprSql(expr)});`,
      );
    }
  }

  // -- Phase 5 emit: ALTER TABLE ADD CONSTRAINT (FK, orphan di-skip) --
  interface FkRow {
    key: string;
    sql: string;
  }
  const fkRows: FkRow[] = [];
  const usedFkNames = new Set<string>();
  const rels = [...(relations ?? [])].sort((a, b) => cmpStr(a.id, b.id));
  for (const r of rels) {
    if (!r) continue;
    const fromTable = tableById.get(r.fromTableId);
    const toTable = tableById.get(r.toTableId);
    if (!fromTable || !toTable) continue;
    const fromCol = colsByTable.get(fromTable.id)?.get(r.fromColumnId);
    const toCol = colsByTable.get(toTable.id)?.get(r.toColumnId);
    if (!fromCol || !toCol) continue;
    if (fromTable.name.trim() === '' || toTable.name.trim() === '') continue;
    const base = truncateIdent(
      `fk_${sanitizeFragment(fromTable.name)}_${sanitizeFragment(fromCol)}_${sanitizeFragment(toTable.name)}_${sanitizeFragment(toCol)}`,
    );
    let name = base;
    let n = 1;
    while (usedFkNames.has(name)) {
      n += 1;
      const suffix = `_${n}`;
      name = base.slice(0, 63 - suffix.length) + suffix;
    }
    usedFkNames.add(name);
    const action = ON_DELETE_SQL[r.onDelete] ?? 'RESTRICT';
    fkRows.push({
      key: `${fromTable.name}\0${fromCol}\0${toTable.name}\0${toCol}\0${r.id}`,
      sql:
        `ALTER TABLE ${safeIdent(fromTable.name)} ADD CONSTRAINT ${safeIdent(name)} ` +
        `FOREIGN KEY (${safeIdent(fromCol)}) REFERENCES ${safeIdent(toTable.name)} (${safeIdent(toCol)}) ON DELETE ${action};`,
    });
  }
  fkRows.sort((a, b) => cmpStr(a.key, b.key));
  for (const row of fkRows) statements.push(row.sql);

  if (statements.length === 0) return '';
  return `${statements.join('\n\n')}\n`;
}
