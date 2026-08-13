import type { Column, Relation, SchemaSnapshot, Table } from '../../lib/types';

export interface SchemaDiff {
  tablesAdded: Table[];
  tablesRemoved: Table[];
  columnsAdded: { tableName: string; column: Column }[];
  columnsRemoved: { tableName: string; column: Column }[];
  relationsAdded: Relation[];
  relationsRemoved: Relation[];
}

const byId = <T extends { id: string }>(list: T[]): Map<string, T> =>
  new Map(list.map((item) => [item.id, item]));

const columnLabel = (c: Column): string =>
  `${c.name} ${c.type}${c.primaryKey ? ' PK' : ''}${c.nullable ? '' : ' NOT NULL'}`;

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
    const fromCols = byId(fromTable.columns);
    for (const c of toTable.columns) {
      if (!fromCols.has(c.id)) diff.columnsAdded.push({ tableName: toTable.name, column: c });
    }
    const toCols = byId(toTable.columns);
    for (const c of fromTable.columns) {
      if (!toCols.has(c.id)) diff.columnsRemoved.push({ tableName: toTable.name, column: c });
    }
  }

  for (const r of toRels.values()) {
    if (!fromRels.has(r.id)) diff.relationsAdded.push(r);
  }
  for (const r of fromRels.values()) {
    if (!toRels.has(r.id)) diff.relationsRemoved.push(r);
  }

  return diff;
}

export function diffSummary(diff: SchemaDiff): string {
  const parts: string[] = [];
  if (diff.tablesAdded.length > 0) parts.push(`${diff.tablesAdded.length} table(s) added`);
  if (diff.tablesRemoved.length > 0) parts.push(`${diff.tablesRemoved.length} table(s) removed`);
  if (diff.columnsAdded.length > 0) parts.push(`${diff.columnsAdded.length} column(s) added`);
  if (diff.columnsRemoved.length > 0) parts.push(`${diff.columnsRemoved.length} column(s) removed`);
  if (diff.relationsAdded.length > 0) parts.push(`${diff.relationsAdded.length} relation(s) added`);
  if (diff.relationsRemoved.length > 0) parts.push(`${diff.relationsRemoved.length} relation(s) removed`);
  return parts.length > 0 ? parts.join(' · ') : 'No differences';
}

export { columnLabel };
