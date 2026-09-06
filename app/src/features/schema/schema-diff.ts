import type { Column, Relation, SchemaSnapshot, Table } from '../../lib/types';

export interface ColumnModification {
  tableName: string;
  column: Column;
  changes: string[];
}

export interface TableModification {
  table: Table;
  changes: string[];
}

export interface RelationChange {
  relation: Relation;
  changes: string[];
}

export interface SchemaDiff {
  tablesAdded: Table[];
  tablesRemoved: Table[];
  columnsAdded: { tableName: string; column: Column }[];
  columnsRemoved: { tableName: string; column: Column }[];
  relationsAdded: Relation[];
  relationsRemoved: Relation[];
  columnsModified: ColumnModification[];
  tablesModified: TableModification[];
  relationsChanged: RelationChange[];
}

const byId = <T extends { id: string }>(list: T[]): Map<string, T> =>
  new Map(list.map((item) => [item.id, item]));

const columnLabel = (c: Column): string =>
  `${c.name} ${c.type}${c.primaryKey ? ' PK' : ''}${c.nullable ? '' : ' NOT NULL'}`;

// Non-goal: no cross-id rename detection (e.g. Levenshtein heuristic) — same id only.
const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Normalize like ddl-export: null/undefined/blank default === no default. */
const normDefault = (v: string | null | undefined): string => (v ?? '').trim();

/** Trim comments; empty vs empty (incl. whitespace-only) counts as equal. */
const normComment = (v: string | null | undefined): string => (v ?? '').trim();

const displayVal = (v: string): string => (v === '' ? '(empty)' : v);

/** Normalize indexes to a sorted deduped set of trimmed non-empty strings. */
function normIndexSet(indexes: string[] | null | undefined): string[] {
  const src = Array.isArray(indexes) ? indexes : [];
  const set = new Set<string>();
  for (const raw of src) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim();
    if (t === '') continue;
    set.add(t);
  }
  return [...set].sort(cmpStr);
}

function diffColumnFields(from: Column, to: Column): string[] {
  const changes: string[] = [];
  const fromName = from.name ?? '';
  const toName = to.name ?? '';
  if (fromName !== toName) changes.push(`name: ${displayVal(fromName)} → ${displayVal(toName)}`);
  const fromType = from.type ?? '';
  const toType = to.type ?? '';
  if (fromType !== toType) changes.push(`type: ${displayVal(fromType)} → ${displayVal(toType)}`);
  if (from.nullable !== to.nullable)
    changes.push(`nullable: ${String(from.nullable)} → ${String(to.nullable)}`);
  if (from.primaryKey !== to.primaryKey)
    changes.push(`primaryKey: ${String(from.primaryKey)} → ${String(to.primaryKey)}`);
  const fromDef = normDefault(from.default);
  const toDef = normDefault(to.default);
  if (fromDef !== toDef) changes.push(`default: ${displayVal(fromDef)} → ${displayVal(toDef)}`);
  const fromComment = normComment(from.comment);
  const toComment = normComment(to.comment);
  if (fromComment !== toComment)
    changes.push(`comment: ${displayVal(fromComment)} → ${displayVal(toComment)}`);
  return changes;
}

function diffTableFields(from: Table, to: Table): string[] {
  const changes: string[] = [];
  const fromName = from.name ?? '';
  const toName = to.name ?? '';
  if (fromName !== toName) changes.push(`name: ${displayVal(fromName)} → ${displayVal(toName)}`);
  const fromComment = normComment(from.comment);
  const toComment = normComment(to.comment);
  if (fromComment !== toComment)
    changes.push(`comment: ${displayVal(fromComment)} → ${displayVal(toComment)}`);
  const fromIdx = normIndexSet(from.indexes);
  const toIdx = normIndexSet(to.indexes);
  if (fromIdx.join('\0') !== toIdx.join('\0'))
    changes.push(`indexes: ${displayVal(fromIdx.join(', '))} → ${displayVal(toIdx.join(', '))}`);
  return changes;
}

function diffRelationFields(from: Relation, to: Relation): string[] {
  const changes: string[] = [];
  if (from.cardinality !== to.cardinality)
    changes.push(`cardinality: ${from.cardinality} → ${to.cardinality}`);
  if (from.onDelete !== to.onDelete) changes.push(`onDelete: ${from.onDelete} → ${to.onDelete}`);
  if (from.fromTableId !== to.fromTableId)
    changes.push(`fromTableId: ${from.fromTableId} → ${to.fromTableId}`);
  if (from.fromColumnId !== to.fromColumnId)
    changes.push(`fromColumnId: ${from.fromColumnId} → ${to.fromColumnId}`);
  if (from.toTableId !== to.toTableId) changes.push(`toTableId: ${from.toTableId} → ${to.toTableId}`);
  if (from.toColumnId !== to.toColumnId)
    changes.push(`toColumnId: ${from.toColumnId} → ${to.toColumnId}`);
  return changes;
}

export function diffSnapshots(from: SchemaSnapshot | undefined, to: SchemaSnapshot | undefined): SchemaDiff {
  const fromTables = byId(from?.tables ?? []);
  const toTables = byId(to?.tables ?? []);
  const fromRels = byId(from?.relations ?? []);
  const toRels = byId(to?.relations ?? []);

  const diff: SchemaDiff = {
    tablesAdded: [],
    tablesRemoved: [],
    columnsAdded: [],
    columnsRemoved: [],
    relationsAdded: [],
    relationsRemoved: [],
    columnsModified: [],
    tablesModified: [],
    relationsChanged: [],
  };

  for (const t of toTables.values()) {
    if (!fromTables.has(t.id)) diff.tablesAdded.push(t);
  }
  for (const t of fromTables.values()) {
    if (!toTables.has(t.id)) diff.tablesRemoved.push(t);
  }

  for (const [id, toTable] of toTables) {
    const fromTable = fromTables.get(id);
    if (!fromTable) continue;
    const fromCols = byId(fromTable.columns ?? []);
    const toCols = byId(toTable.columns ?? []);
    for (const c of toTable.columns ?? []) {
      if (!c || typeof c.id !== 'string') continue;
      if (!fromCols.has(c.id)) diff.columnsAdded.push({ tableName: toTable.name, column: c });
    }
    for (const c of fromTable.columns ?? []) {
      if (!c || typeof c.id !== 'string') continue;
      if (!toCols.has(c.id)) diff.columnsRemoved.push({ tableName: toTable.name, column: c });
    }
    // Modified columns: same id present on both sides, at least one field differs.
    for (const [colId, toCol] of toCols) {
      const fromCol = fromCols.get(colId);
      if (!fromCol || !toCol) continue;
      const changes = diffColumnFields(fromCol, toCol);
      if (changes.length > 0)
        diff.columnsModified.push({ tableName: toTable.name, column: toCol, changes });
    }
    // Modified tables: same id, name/comment/indexes differ.
    const tableChanges = diffTableFields(fromTable, toTable);
    if (tableChanges.length > 0) diff.tablesModified.push({ table: toTable, changes: tableChanges });
  }

  for (const r of toRels.values()) {
    if (!fromRels.has(r.id)) diff.relationsAdded.push(r);
  }
  for (const r of fromRels.values()) {
    if (!toRels.has(r.id)) diff.relationsRemoved.push(r);
  }
  // Changed relations: same id, cardinality/onDelete/endpoints differ (not added/removed).
  for (const [id, toRel] of toRels) {
    const fromRel = fromRels.get(id);
    if (!fromRel || !toRel) continue;
    const changes = diffRelationFields(fromRel, toRel);
    if (changes.length > 0) diff.relationsChanged.push({ relation: toRel, changes });
  }

  diff.columnsModified.sort(
    (a, b) => cmpStr(a.tableName, b.tableName) || cmpStr(a.column.id, b.column.id),
  );
  diff.tablesModified.sort((a, b) => cmpStr(a.table.name, b.table.name) || cmpStr(a.table.id, b.table.id));
  diff.relationsChanged.sort((a, b) => cmpStr(a.relation.id, b.relation.id));

  return diff;
}

export function diffSummary(diff: SchemaDiff): string {
  const parts: string[] = [];
  const tablesAdded = diff.tablesAdded ?? [];
  const tablesRemoved = diff.tablesRemoved ?? [];
  const tablesModified = diff.tablesModified ?? [];
  const columnsAdded = diff.columnsAdded ?? [];
  const columnsRemoved = diff.columnsRemoved ?? [];
  const columnsModified = diff.columnsModified ?? [];
  const relationsAdded = diff.relationsAdded ?? [];
  const relationsRemoved = diff.relationsRemoved ?? [];
  const relationsChanged = diff.relationsChanged ?? [];
  if (tablesAdded.length > 0) parts.push(`${tablesAdded.length} table(s) added`);
  if (tablesRemoved.length > 0) parts.push(`${tablesRemoved.length} table(s) removed`);
  if (tablesModified.length > 0) parts.push(`${tablesModified.length} table(s) modified`);
  if (columnsAdded.length > 0) parts.push(`${columnsAdded.length} column(s) added`);
  if (columnsRemoved.length > 0) parts.push(`${columnsRemoved.length} column(s) removed`);
  if (columnsModified.length > 0) parts.push(`${columnsModified.length} column(s) modified`);
  if (relationsAdded.length > 0) parts.push(`${relationsAdded.length} relation(s) added`);
  if (relationsRemoved.length > 0) parts.push(`${relationsRemoved.length} relation(s) removed`);
  if (relationsChanged.length > 0) parts.push(`${relationsChanged.length} relation(s) changed`);
  return parts.length > 0 ? parts.join(' · ') : 'No differences';
}

export { columnLabel };
