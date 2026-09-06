/* DevHub DrawDB compatibility mapper (client-side, pure, zero-dep).
   Clean-room implementation — DO NOT copy DrawDB source (AGPL-3.0).
   Written only from: (a) self-made JSON fixtures in drawdb-compat.test.ts,
   (b) general knowledge that DrawDB diagrams use `tables[]` with `fields[]`,
   `relationships[]`/`refs[]`, `enums[]`, `notes`, plus `title`/`database`.
   Uncertain DrawDB fields are treated as optional and ignored (see below).

   Mapped fields:
   - tables: `name` (fallback `title`/`label`), `comment` (fallback `note`),
     `fields` (fallback `columns`/`attrs`) -> Table{name, comment, columns}
   - fields: `name`, `type` (string or {name/type}), `nullable` (fallback
     `notNull`/`required` inverse), `primaryKey` (fallback `pk`/`primary`),
     `default` (fallback `defaultValue`), `comment` -> Column
   - relations: endpoint table+field refs (flat `startTableId/endTableId` +
     `startFieldId/endFieldId`, incl. `from/to/source/target/primary/foreign`
     variants, nested `start/end/from/to` objects, or `endpoints[2]` array;
     id match first, then case-insensitive name match),
     `cardinality` (fallback `type`, values `1:1`/`1:N`/`N:M`, default `1:N`),
     `onDelete` (fallback `deleteConstraint`/`deleteAction`, values
     `cascade`/`setNull`/`restrict`, default `restrict`)
   - toDrawDB emits the same minimal subset so
     `toDrawDB -> fromDrawDB` round-trips the core fields.

   Deliberately ignored (no warning, kept for forward-compat):
   - table layout/style: `x`, `y`, `color`, `width`, `height`, `order`, `schema`
   - field extras: `unique`, `increment`/`autoincrement`, `check`, `collation`
   - top-level metadata on import: `enums`, `notes`, `title`, `database`
     (re-emitted with defaults on export), `author`, `createdAt`, `updatedAt`
   - relation extras: `name`, `color`, `labels`, `updateConstraint`/`onUpdate`,
     line routing/vertices. When in doubt a field is skipped and noted here. */

import { FE_LIMITS } from '../../lib/limits';
import type { OnDelete, Relation, RelationCardinality, Table } from '../../lib/types';
import { newId, nowIso } from '../../lib/utils';

export interface DrawDBDiagram {
  tables?: unknown;
  relationships?: unknown;
  refs?: unknown;
  enums?: unknown;
  notes?: unknown;
  title?: unknown;
  database?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function strRef(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function rawIdOf(obj: Record<string, unknown>): string | null {
  for (const k of ['id', '_id', 'key']) {
    if (k in obj) {
      const s = strRef(obj[k]);
      if (s) return s;
    }
  }
  return null;
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

function stringifyType(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (isRecord(v)) {
    for (const k of ['name', 'type', 'typeName', 'label', 'kind']) {
      const inner = v[k];
      if (typeof inner === 'string' && inner.trim() !== '') return inner.trim();
      if (typeof inner === 'number' && Number.isFinite(inner)) return String(inner);
    }
  }
  return '';
}

function stringifyDefault(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return String(v);
  return null;
}

function parseNullable(obj: Record<string, unknown>): boolean {
  const direct = obj['nullable'];
  if (typeof direct === 'boolean') return direct;
  const isNullable = obj['isNullable'];
  if (typeof isNullable === 'boolean') return isNullable;
  const notNull = obj['notNull'];
  if (typeof notNull === 'boolean') return !notNull;
  const notNullSnake = obj['not_null'];
  if (typeof notNullSnake === 'boolean') return !notNullSnake;
  const required = obj['required'];
  if (typeof required === 'boolean') return !required;
  return true;
}

function parsePrimaryKey(obj: Record<string, unknown>): boolean {
  for (const k of ['primaryKey', 'pk', 'primary', 'isPrimary', 'isPrimaryKey']) {
    const v = obj[k];
    if (v === true || v === 1) return true;
  }
  return false;
}

function parseCardinality(raw: unknown): { value: RelationCardinality; unknown: boolean } {
  if (raw === null || raw === undefined) return { value: '1:N', unknown: false };
  if (typeof raw !== 'string') return { value: '1:N', unknown: true };
  if (raw.trim() === '') return { value: '1:N', unknown: false };
  const n = raw.toLowerCase().replace(/[\s_-]+/g, '');
  if (n === '1:1' || n === 'onetoone' || n === 'oneone' || n === '11') {
    return { value: '1:1', unknown: false };
  }
  if (
    n === '1:n' ||
    n === '1:m' ||
    n === 'n:1' ||
    n === 'm:1' ||
    n === 'onetomany' ||
    n === 'manytoone'
  ) {
    return { value: '1:N', unknown: false };
  }
  if (n === 'n:m' || n === 'm:n' || n === 'm:m' || n === 'n:n' || n === 'manytomany') {
    return { value: 'N:M', unknown: false };
  }
  return { value: '1:N', unknown: true };
}

function parseOnDelete(raw: unknown): OnDelete {
  if (typeof raw !== 'string') return 'restrict';
  const n = raw.toLowerCase().replace(/[\s_-]+/g, '');
  if (n === '') return 'restrict';
  if (n === 'cascade' || n === 'cascading' || n === 'deletecascade') return 'cascade';
  if (n === 'setnull') return 'setNull';
  return 'restrict';
}

/** Resolve a table/field reference value (id string, number, or nested object). */
function refFromValue(v: unknown): string | null {
  if (typeof v === 'string' || typeof v === 'number') return strRef(v);
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = refFromValue(item);
      if (s) return s;
    }
    return null;
  }
  if (isRecord(v)) {
    for (const k of [
      'id',
      'tableId',
      'fieldId',
      'columnId',
      'tableName',
      'fieldName',
      'columnName',
      'name',
    ]) {
      const s = strRef(v[k]);
      if (s) return s;
    }
  }
  return null;
}

interface EndpointRefs {
  startTable: string | null;
  startField: string | null;
  endTable: string | null;
  endField: string | null;
}

const START_TABLE_KEYS = [
  'startTableId',
  'fromTableId',
  'sourceTableId',
  'primaryTableId',
  'startTable',
  'fromTable',
  'sourceTable',
  'primaryTable',
  'startTableName',
  'fromTableName',
];
const END_TABLE_KEYS = [
  'endTableId',
  'toTableId',
  'targetTableId',
  'foreignTableId',
  'endTable',
  'toTable',
  'targetTable',
  'foreignTable',
  'endTableName',
  'toTableName',
];
const START_FIELD_KEYS = [
  'startFieldId',
  'fromFieldId',
  'sourceFieldId',
  'primaryFieldId',
  'startColumnId',
  'fromColumnId',
  'startField',
  'fromField',
  'sourceField',
  'primaryField',
  'startFieldName',
  'fromFieldName',
  'startColumn',
  'fromColumn',
];
const END_FIELD_KEYS = [
  'endFieldId',
  'toFieldId',
  'targetFieldId',
  'foreignFieldId',
  'endColumnId',
  'toColumnId',
  'endField',
  'toField',
  'targetField',
  'foreignField',
  'endFieldName',
  'toFieldName',
  'endColumn',
  'toColumn',
];

function pickFirstRef(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    if (!(k in obj)) continue;
    const s = refFromValue(obj[k]);
    if (s) return s;
  }
  return null;
}

function extractFromNested(nested: Record<string, unknown>): {
  table: string | null;
  field: string | null;
} {
  const table = pickFirstRef(nested, [
    'tableId',
    'table_id',
    'table',
    'tableName',
    'table_name',
    'id',
    'name',
  ]);
  const field = pickFirstRef(nested, [
    'fieldId',
    'field_id',
    'field',
    'fieldName',
    'field_name',
    'columnId',
    'column_id',
    'column',
    'columnName',
    'column_name',
    'id',
    'name',
  ]);
  return { table, field };
}

function extractEndpointRefs(rel: Record<string, unknown>): EndpointRefs {
  let startTable = pickFirstRef(rel, START_TABLE_KEYS);
  let startField = pickFirstRef(rel, START_FIELD_KEYS);
  let endTable = pickFirstRef(rel, END_TABLE_KEYS);
  let endField = pickFirstRef(rel, END_FIELD_KEYS);

  // Nested objects: start/end/from/to/source/target/primary/foreign.
  const nestedPairs: Array<[string, string]> = [
    ['start', 'end'],
    ['from', 'to'],
    ['source', 'target'],
    ['primary', 'foreign'],
  ];
  for (const [a, b] of nestedPairs) {
    const na = rel[a];
    const nb = rel[b];
    if (!startTable || !startField) {
      if (isRecord(na)) {
        const ex = extractFromNested(na);
        if (!startTable && ex.table) startTable = ex.table;
        if (!startField && ex.field) startField = ex.field;
      } else if (typeof na === 'string' || typeof na === 'number') {
        // Ambiguous scalar nested ref — treat as table ref only when missing.
        if (!startTable) startTable = strRef(na);
      }
    }
    if (!endTable || !endField) {
      if (isRecord(nb)) {
        const ex = extractFromNested(nb);
        if (!endTable && ex.table) endTable = ex.table;
        if (!endField && ex.field) endField = ex.field;
      } else if (typeof nb === 'string' || typeof nb === 'number') {
        if (!endTable) endTable = strRef(nb);
      }
    }
  }

  // endpoints[2] array style (used by some ref serializations).
  const endpoints = rel['endpoints'];
  if ((!startTable || !startField || !endTable || !endField) && Array.isArray(endpoints)) {
    const first = endpoints[0];
    const second = endpoints[1];
    if (!startTable || !startField) {
      if (isRecord(first)) {
        const ex = extractFromNested(first);
        if (!startTable && ex.table) startTable = ex.table;
        if (!startField && ex.field) startField = ex.field;
      }
    }
    if (!endTable || !endField) {
      if (isRecord(second)) {
        const ex = extractFromNested(second);
        if (!endTable && ex.table) endTable = ex.table;
        if (!endField && ex.field) endField = ex.field;
      }
    }
  }

  return { startTable, startField, endTable, endField };
}

export function fromDrawDB(input: unknown): {
  tables: Table[];
  relations: Relation[];
  warnings: string[];
} {
  const warnings: string[] = [];
  try {
    let root: unknown = input;
    if (typeof root === 'string') {
      try {
        root = JSON.parse(root) as unknown;
      } catch {
        return { tables: [], relations: [], warnings: ['Invalid JSON string'] };
      }
    }
    if (!isRecord(root)) {
      return { tables: [], relations: [], warnings: ['Invalid input, expected object or JSON string'] };
    }

    const tables: Table[] = [];
    const tableIdToNew = new Map<string, string>();
    const tableNameToNew = new Map<string, string>();
    const fieldIdToLoc = new Map<string, { tableNewId: string; columnNewId: string }>();
    const colNameByTable = new Map<string, Map<string, string>>();
    const now = nowIso();

    const rawTables = root['tables'];
    let rawTableList: unknown[];
    if (rawTables === null || rawTables === undefined) {
      rawTableList = [];
    } else if (Array.isArray(rawTables)) {
      rawTableList = rawTables;
    } else {
      warnings.push('Invalid tables array, expected array');
      rawTableList = [];
    }

    for (let i = 0; i < rawTableList.length; i += 1) {
      const entry = rawTableList[i];
      if (!isRecord(entry)) {
        warnings.push(`Skipped table at index ${i}: invalid entry`);
        continue;
      }
      const rawTableId = rawIdOf(entry);
      let name = firstString(entry, ['name', 'title', 'label', 'tableName']);
      if (!name) {
        warnings.push(`Skipped table at index ${i}: missing name`);
        continue;
      }
      if (name.length > FE_LIMITS.TABLE_NAME) {
        name = name.slice(0, FE_LIMITS.TABLE_NAME);
        warnings.push(`Table at index ${i} name truncated to ${FE_LIMITS.TABLE_NAME} chars`);
      }
      let comment = firstString(entry, ['comment', 'note', 'description']) ?? '';
      if (comment.length > FE_LIMITS.TABLE_COMMENT) {
        comment = comment.slice(0, FE_LIMITS.TABLE_COMMENT);
        warnings.push(`Table "${name}" comment truncated to ${FE_LIMITS.TABLE_COMMENT} chars`);
      }

      let fieldsRaw: unknown = entry['fields'];
      if (!Array.isArray(fieldsRaw)) {
        for (const k of ['columns', 'attrs', 'attributes']) {
          if (Array.isArray(entry[k])) {
            fieldsRaw = entry[k];
            break;
          }
        }
      }
      let fieldList: unknown[];
      if (fieldsRaw === null || fieldsRaw === undefined) {
        warnings.push(`Table "${name}" has no fields array`);
        fieldList = [];
      } else if (Array.isArray(fieldsRaw)) {
        fieldList = fieldsRaw;
      } else {
        warnings.push(`Table "${name}" has no fields array`);
        fieldList = [];
      }

      const newTableId = newId();
      if (rawTableId && !tableIdToNew.has(rawTableId)) tableIdToNew.set(rawTableId, newTableId);
      const lowerName = name.toLowerCase();
      if (!tableNameToNew.has(lowerName)) tableNameToNew.set(lowerName, newTableId);
      const perTableNameMap = new Map<string, string>();
      colNameByTable.set(newTableId, perTableNameMap);

      const columns: Array<Table['columns'][number]> = [];
      for (let j = 0; j < fieldList.length; j += 1) {
        const f = fieldList[j];
        if (!isRecord(f)) {
          warnings.push(`Skipped column at index ${j} in table "${name}": invalid entry`);
          continue;
        }
        const rawFieldId = rawIdOf(f);
        let colName = firstString(f, ['name', 'label', 'title', 'columnName']);
        if (!colName) {
          warnings.push(`Skipped column at index ${j} in table "${name}": missing name`);
          continue;
        }
        if (colName.length > FE_LIMITS.COLUMN_NAME) {
          const short = colName.slice(0, 30);
          colName = colName.slice(0, FE_LIMITS.COLUMN_NAME);
          warnings.push(
            `Column "${short}" in table "${name}" name truncated to ${FE_LIMITS.COLUMN_NAME} chars`,
          );
        }
        let colType = stringifyType(
          f['type'] ?? f['dataType'] ?? f['columnType'] ?? f['kind'] ?? '',
        );
        if (colType.length > FE_LIMITS.COLUMN_TYPE) {
          colType = colType.slice(0, FE_LIMITS.COLUMN_TYPE);
          warnings.push(
            `Column "${colName}" in table "${name}" type truncated to ${FE_LIMITS.COLUMN_TYPE} chars`,
          );
        }
        const nullable = parseNullable(f);
        const primaryKey = parsePrimaryKey(f);
        let def = stringifyDefault(f['default'] ?? f['defaultValue'] ?? f['default_value']);
        if (def !== null && def.length > FE_LIMITS.COLUMN_DEFAULT) {
          def = def.slice(0, FE_LIMITS.COLUMN_DEFAULT);
          warnings.push(
            `Column "${colName}" in table "${name}" default truncated to ${FE_LIMITS.COLUMN_DEFAULT} chars`,
          );
        }
        let colComment = firstString(f, ['comment', 'note', 'description']) ?? '';
        if (colComment.length > FE_LIMITS.COLUMN_COMMENT) {
          colComment = colComment.slice(0, FE_LIMITS.COLUMN_COMMENT);
          warnings.push(
            `Column "${colName}" in table "${name}" comment truncated to ${FE_LIMITS.COLUMN_COMMENT} chars`,
          );
        }
        const newColId = newId();
        columns.push({
          id: newColId,
          name: colName,
          type: colType,
          nullable,
          primaryKey,
          default: def,
          comment: colComment,
        });
        if (rawFieldId && !fieldIdToLoc.has(rawFieldId)) {
          fieldIdToLoc.set(rawFieldId, { tableNewId: newTableId, columnNewId: newColId });
        }
        const lowerCol = colName.toLowerCase();
        if (!perTableNameMap.has(lowerCol)) perTableNameMap.set(lowerCol, newColId);
      }

      tables.push({
        id: newTableId,
        createdAt: now,
        updatedAt: now,
        name,
        comment,
        columns,
        indexes: [],
      });
    }

    const resolveTable = (ref: string | null): string | null => {
      if (!ref) return null;
      const byId = tableIdToNew.get(ref);
      if (byId) return byId;
      return tableNameToNew.get(ref.toLowerCase()) ?? null;
    };
    const resolveColumn = (tableNewId: string, ref: string | null): string | null => {
      if (!ref) return null;
      const loc = fieldIdToLoc.get(ref);
      if (loc && loc.tableNewId === tableNewId) return loc.columnNewId;
      const perTable = colNameByTable.get(tableNewId);
      if (perTable) {
        const byName = perTable.get(ref.toLowerCase());
        if (byName) return byName;
      }
      return null;
    };

    const combinedRels: unknown[] = [];
    const rawRelationships = root['relationships'];
    if (rawRelationships === null || rawRelationships === undefined) {
      // none — ok
    } else if (Array.isArray(rawRelationships)) {
      for (const r of rawRelationships) combinedRels.push(r);
    } else {
      warnings.push('Invalid relationships array, expected array');
    }
    const rawRefs = root['refs'];
    if (rawRefs === null || rawRefs === undefined) {
      // none — ok
    } else if (Array.isArray(rawRefs)) {
      for (const r of rawRefs) combinedRels.push(r);
    } else {
      warnings.push('Invalid refs array, expected array');
    }

    const relations: Relation[] = [];
    for (let k = 0; k < combinedRels.length; k += 1) {
      const r = combinedRels[k];
      if (!isRecord(r)) {
        warnings.push(`Skipped relation at index ${k}: invalid entry`);
        continue;
      }
      const eps = extractEndpointRefs(r);
      if (!eps.startTable || !eps.startField || !eps.endTable || !eps.endField) {
        warnings.push(`Skipped relation at index ${k}: orphan endpoint`);
        continue;
      }
      const fromTableId = resolveTable(eps.startTable);
      const toTableId = resolveTable(eps.endTable);
      if (!fromTableId || !toTableId) {
        warnings.push(`Skipped relation at index ${k}: orphan endpoint`);
        continue;
      }
      const fromColumnId = resolveColumn(fromTableId, eps.startField);
      const toColumnId = resolveColumn(toTableId, eps.endField);
      if (!fromColumnId || !toColumnId) {
        warnings.push(`Skipped relation at index ${k}: orphan endpoint`);
        continue;
      }
      const cardRaw = r['cardinality'] ?? r['type'] ?? r['relation'] ?? r['kind'];
      const parsedCard = parseCardinality(cardRaw);
      if (parsedCard.unknown) {
        warnings.push(`Relation at index ${k} has unknown cardinality, defaulted to 1:N`);
      }
      const onDelete = parseOnDelete(
        r['onDelete'] ?? r['deleteConstraint'] ?? r['deleteAction'] ?? r['on_delete'] ?? r['action'],
      );
      relations.push({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        fromTableId,
        fromColumnId,
        toTableId,
        toColumnId,
        cardinality: parsedCard.value,
        onDelete,
      });
    }

    return { tables, relations, warnings };
  } catch {
    warnings.push('Failed to parse DrawDB diagram');
    return { tables: [], relations: [], warnings };
  }
}

export function toDrawDB(tables: Table[], relations: Relation[]): DrawDBDiagram {
  const safeTables = Array.isArray(tables) ? tables : [];
  const safeRelations = Array.isArray(relations) ? relations : [];

  const outTables: Array<Record<string, unknown>> = [];
  for (const t of safeTables) {
    if (!t || typeof t.name !== 'string' || t.name.trim() === '') continue;
    const cols = Array.isArray(t.columns) ? t.columns : [];
    const fields: Array<Record<string, unknown>> = [];
    for (const c of cols) {
      if (!c || typeof c.name !== 'string' || c.name.trim() === '') continue;
      fields.push({
        id: c.id,
        name: c.name,
        type: c.type ?? '',
        primaryKey: Boolean(c.primaryKey),
        nullable: Boolean(c.nullable),
        notNull: !c.nullable,
        default: c.default ?? null,
        comment: c.comment ?? '',
      });
    }
    outTables.push({
      id: t.id,
      name: t.name,
      comment: t.comment ?? '',
      fields,
    });
  }

  const outRels: Array<Record<string, unknown>> = [];
  for (const r of safeRelations) {
    if (!r || !r.fromTableId || !r.fromColumnId || !r.toTableId || !r.toColumnId) continue;
    outRels.push({
      id: r.id,
      startTableId: r.fromTableId,
      startFieldId: r.fromColumnId,
      endTableId: r.toTableId,
      endFieldId: r.toColumnId,
      cardinality: r.cardinality ?? '1:N',
      onDelete: r.onDelete ?? 'restrict',
    });
  }

  return {
    tables: outTables,
    relationships: outRels,
    enums: [],
    title: 'DevHub Export',
    database: 'Postgres',
  };
}
