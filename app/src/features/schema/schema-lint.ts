/* DevHub schema linter (client-side, pure, zero-dep).
   Table[] + Relation[] -> SchemaIssue[] (deterministic, never throws).
   Read-only checks for F2-2; UI/i18n rendering follows in F2-3. */

import type { Relation, Table } from '../../lib/types';

export type SchemaIssueCode =
  | 'missing-fk-target'
  | 'orphan-relation'
  | 'pk-null'
  | 'index-typo'
  | 'type-mismatch';

export interface SchemaIssue {
  code: SchemaIssueCode;
  tableId: string;
  columnId?: string | null;
  relationId?: string | null;
  message: string;
}

function cmpStr(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Mirror of ddl-export.ts uniqueIndexParts (colon or space prefix). */
function uniqueIndexExpr(raw: string): string {
  const colon = raw.match(/^unique\s*:\s*(.+)$/i);
  if (colon) return (colon[1] ?? '').trim();
  const space = raw.match(/^unique\s+(.+)$/i);
  if (space) return (space[1] ?? '').trim();
  return raw.trim();
}

/**
 * Canonical type for FK type-mismatch comparison.
 * Decisions:
 * - lowercase + trim + collapse inner whitespace + tighten parens/commas.
 * - `int` -> `integer`; `bool` -> `boolean` (Postgres aliases).
 * - `timestamptz[(p)]` <-> `timestamp[(p)] with time zone` -> one canonical.
 * - `text` <-> `varchar[(n)]` <-> `character varying[(n)]` -> `text` (weak match, SKIP).
 * - everything else compares literally (char, bigint vs integer, numeric vs
 *   decimal, timestamp vs timestamptz, enum labels, etc. stay distinct).
 */
export function normalizeColumnType(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let s = raw.trim().toLowerCase();
  if (s === '') return '';
  s = s.replace(/\s+/g, ' ');
  s = s
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)/g, ')')
    .replace(/\s*,\s*/g, ',');
  if (s === 'int') return 'integer';
  if (s === 'bool') return 'boolean';
  if (s === 'timestamptz' || /^timestamptz\(\d+\)$/.test(s)) return 'timestamp with time zone';
  if (
    s === 'timestamp with time zone' ||
    /^timestamp\(\d+\) with time zone$/.test(s)
  ) {
    return 'timestamp with time zone';
  }
  if (s === 'text') return 'text';
  if (/^varchar(\(\d+\))?$/.test(s)) return 'text';
  if (/^character varying(\(\d+\))?$/.test(s)) return 'text';
  return s;
}

export function lintSchema(tables: Table[], relations: Relation[]): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  const safeTables = Array.isArray(tables) ? tables : [];
  const safeRelations = Array.isArray(relations) ? relations : [];

  const tableById = new Map<string, Table>();
  for (const t of safeTables) {
    if (!t || typeof t.id !== 'string' || t.id === '') continue;
    if (!tableById.has(t.id)) tableById.set(t.id, t);
  }

  const colsByTable = new Map<string, Map<string, NonNullable<Table['columns']>[number]>>();
  const namesByTable = new Map<string, Set<string>>();
  const hasPkByTable = new Map<string, boolean>();
  for (const [id, t] of tableById) {
    const colMap = new Map<string, NonNullable<Table['columns']>[number]>();
    const nameSet = new Set<string>();
    let hasPk = false;
    const cols = Array.isArray(t.columns) ? t.columns : [];
    for (const c of cols) {
      if (!c || typeof c.id !== 'string' || c.id === '') continue;
      if (!colMap.has(c.id)) colMap.set(c.id, c);
      if (typeof c.name === 'string' && c.name.trim() !== '') {
        nameSet.add(c.name.trim().toLowerCase());
      }
      if (c.primaryKey === true) hasPk = true;
    }
    colsByTable.set(id, colMap);
    namesByTable.set(id, nameSet);
    hasPkByTable.set(id, hasPk);
  }

  // -- pk-null: one issue per nullable PK column --
  for (const [id, t] of tableById) {
    const cols = Array.isArray(t.columns) ? t.columns : [];
    for (const c of cols) {
      if (!c || c.primaryKey !== true || c.nullable !== true) continue;
      if (typeof c.id !== 'string' || c.id === '') continue;
      const label = typeof c.name === 'string' && c.name.trim() !== '' ? c.name.trim() : c.id;
      issues.push({
        code: 'pk-null',
        tableId: id,
        columnId: c.id,
        relationId: null,
        message: `Primary key column "${label}" must not be nullable`,
      });
    }
  }

  // -- index-typo: one issue per index entry matching no column name --
  for (const [id, t] of tableById) {
    const indexes = Array.isArray(t.indexes) ? t.indexes : [];
    const nameSet = namesByTable.get(id) ?? new Set<string>();
    for (const raw of indexes) {
      if (typeof raw !== 'string') continue;
      if (raw.trim() === '') continue;
      const expr = uniqueIndexExpr(raw);
      if (expr === '' || expr.includes(';')) continue;
      // Complex expressions are handled by ddl-export as raw SQL — skip.
      if (/[\s(),]/.test(expr)) continue;
      if (nameSet.has(expr.toLowerCase())) continue;
      issues.push({
        code: 'index-typo',
        tableId: id,
        columnId: null,
        relationId: null,
        message: `Index "${expr}" does not match any column`,
      });
    }
  }

  // -- relation checks: missing-fk-target short-circuits orphan/type-mismatch --
  for (const r of safeRelations) {
    if (!r || typeof r.id !== 'string' || r.id === '') continue;
    const fromTable = typeof r.fromTableId === 'string' ? tableById.get(r.fromTableId) : undefined;
    const toTable = typeof r.toTableId === 'string' ? tableById.get(r.toTableId) : undefined;
    const fromCol =
      fromTable && typeof r.fromColumnId === 'string'
        ? colsByTable.get(fromTable.id)?.get(r.fromColumnId)
        : undefined;
    const toCol =
      toTable && typeof r.toColumnId === 'string'
        ? colsByTable.get(toTable.id)?.get(r.toColumnId)
        : undefined;

    if (!fromTable || !toTable || !fromCol || !toCol) {
      let tableId = typeof r.fromTableId === 'string' ? r.fromTableId : '';
      let columnId: string | null = null;
      let missing: 'table' | 'column' = 'table';
      if (!fromTable) {
        tableId = typeof r.fromTableId === 'string' ? r.fromTableId : '';
      } else if (!toTable) {
        tableId = typeof r.toTableId === 'string' ? r.toTableId : '';
      } else if (!fromCol) {
        tableId = fromTable.id;
        columnId = typeof r.fromColumnId === 'string' ? r.fromColumnId : null;
        missing = 'column';
      } else {
        tableId = toTable.id;
        columnId = typeof r.toColumnId === 'string' ? r.toColumnId : null;
        missing = 'column';
      }
      issues.push({
        code: 'missing-fk-target',
        tableId,
        columnId,
        relationId: r.id,
        message:
          missing === 'table'
            ? 'Relation references a missing table'
            : 'Relation references a missing column',
      });
      continue;
    }

    const fromHasPk = hasPkByTable.get(fromTable.id) === true;
    const toHasPk = hasPkByTable.get(toTable.id) === true;
    if (!fromHasPk || !toHasPk) {
      const lacking = !fromHasPk ? fromTable : toTable;
      issues.push({
        code: 'orphan-relation',
        tableId: lacking.id,
        columnId: null,
        relationId: r.id,
        message: `Related table "${lacking.name}" has no primary key`,
      });
    }

    if (normalizeColumnType(fromCol.type) !== normalizeColumnType(toCol.type)) {
      const fromType =
        typeof fromCol.type === 'string' && fromCol.type.trim() !== '' ? fromCol.type.trim() : '(empty)';
      const toType =
        typeof toCol.type === 'string' && toCol.type.trim() !== '' ? toCol.type.trim() : '(empty)';
      issues.push({
        code: 'type-mismatch',
        tableId: fromTable.id,
        columnId: typeof r.fromColumnId === 'string' ? r.fromColumnId : null,
        relationId: r.id,
        message: `Type mismatch: "${fromType}" vs "${toType}"`,
      });
    }
  }

  issues.sort(
    (a, b) =>
      cmpStr(a.code, b.code) ||
      cmpStr(a.tableId, b.tableId) ||
      cmpStr(a.columnId ?? '', b.columnId ?? '') ||
      cmpStr(a.relationId ?? '', b.relationId ?? ''),
  );
  return issues;
}
