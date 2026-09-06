import { describe, expect, it } from 'vitest';
import { columnLabel, diffSnapshots, diffSummary } from './schema-diff';
import type { Column, Relation, SchemaSnapshot, Table } from '../../lib/types';

const TABLE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TABLE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COL_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const REL_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function makeColumn(over: Partial<Column> = {}): Column {
  return {
    id: COL_ID,
    name: 'id',
    type: 'uuid',
    nullable: false,
    primaryKey: true,
    default: null,
    comment: '',
    ...over,
  };
}

function makeTable(id = TABLE_A, over: Partial<Table> = {}): Table {
  return {
    id,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    name: 'users',
    comment: '',
    columns: [makeColumn()],
    indexes: [],
    ...over,
  };
}

function makeRelation(over: Partial<Relation> = {}): Relation {
  return {
    id: REL_ID,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    fromTableId: TABLE_A,
    fromColumnId: COL_ID,
    toTableId: TABLE_B,
    toColumnId: COL_ID,
    cardinality: '1:N',
    onDelete: 'cascade',
    ...over,
  };
}

function makeSnapshot(tables: Table[] = [], relations: Relation[] = []): SchemaSnapshot {
  return { tables, relations };
}

describe('diffSnapshots', () => {
  it('returns an empty diff for identical snapshots', () => {
    const snap = makeSnapshot([makeTable()], [makeRelation()]);
    const diff = diffSnapshots(snap, snap);
    expect(diff.tablesAdded).toEqual([]);
    expect(diff.tablesRemoved).toEqual([]);
    expect(diff.columnsAdded).toEqual([]);
    expect(diff.columnsRemoved).toEqual([]);
    expect(diff.relationsAdded).toEqual([]);
    expect(diff.relationsRemoved).toEqual([]);
  });

  it('detects an added table', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([makeTable(), makeTable(TABLE_B, { name: 'teams' })]);
    const diff = diffSnapshots(from, to);
    expect(diff.tablesAdded.map((t) => t.name)).toEqual(['teams']);
    expect(diff.tablesRemoved).toEqual([]);
  });

  it('detects a removed table', () => {
    const from = makeSnapshot([makeTable(), makeTable(TABLE_B, { name: 'teams' })]);
    const to = makeSnapshot([makeTable()]);
    const diff = diffSnapshots(from, to);
    expect(diff.tablesRemoved.map((t) => t.name)).toEqual(['teams']);
    expect(diff.tablesAdded).toEqual([]);
  });

  it('detects an added column on a shared table', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([makeTable(undefined, { columns: [makeColumn(), makeColumn({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'email', type: 'text', primaryKey: false })] })]);
    const diff = diffSnapshots(from, to);
    expect(diff.columnsAdded.map((c) => c.column.name)).toEqual(['email']);
    expect(diff.columnsRemoved).toEqual([]);
  });

  it('detects a removed column on a shared table', () => {
    const from = makeSnapshot([makeTable(undefined, { columns: [makeColumn(), makeColumn({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'email', type: 'text', primaryKey: false })] })]);
    const to = makeSnapshot([makeTable()]);
    const diff = diffSnapshots(from, to);
    expect(diff.columnsRemoved.map((c) => c.column.name)).toEqual(['email']);
    expect(diff.columnsAdded).toEqual([]);
  });

  it('does not treat a whole removed table as column changes', () => {
    const from = makeSnapshot([makeTable(), makeTable(TABLE_B, { name: 'teams', columns: [makeColumn({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'team_id' })] })]);
    const to = makeSnapshot([makeTable(TABLE_B, { name: 'teams', columns: [makeColumn({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'team_id' })] })]);
    const diff = diffSnapshots(from, to);
    expect(diff.tablesRemoved.map((t) => t.name)).toEqual(['users']);
    expect(diff.columnsRemoved).toEqual([]);
  });

  it('detects added and removed relations', () => {
    const from = makeSnapshot([], [makeRelation()]);
    const to = makeSnapshot([], [makeRelation({ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', cardinality: 'N:M' })]);
    const diff = diffSnapshots(from, to);
    expect(diff.relationsAdded.length).toBe(1);
    expect(diff.relationsRemoved.length).toBe(1);
  });

  it('handles undefined snapshots as empty', () => {
    const diff = diffSnapshots(undefined, makeSnapshot([makeTable()]));
    expect(diff.tablesAdded.length).toBe(1);
  });
});

describe('diffSummary', () => {
  it('returns No differences for empty diff', () => {
    const diff = diffSnapshots(makeSnapshot(), makeSnapshot());
    expect(diffSummary(diff)).toBe('No differences');
  });

  it('joins change counts', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([makeTable(TABLE_B, { name: 'teams' })]);
    const diff = diffSnapshots(from, to);
    const summary = diffSummary(diff);
    expect(summary).toContain('1 table(s) added');
    expect(summary).toContain('1 table(s) removed');
  });

  it('reports column changes', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([makeTable(undefined, { columns: [makeColumn(), makeColumn({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'email', type: 'text', primaryKey: false })] })]);
    const diff = diffSnapshots(from, to);
    expect(diffSummary(diff)).toContain('column');
  });
});

describe('columnLabel', () => {
  it('formats name type plus constraints', () => {
    expect(columnLabel(makeColumn())).toContain('id');
    expect(columnLabel(makeColumn())).toContain('uuid');
  });
});

describe('diffSnapshots modified columns', () => {
  const COL2 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  it('detects a column type change with field: before → after format', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([makeTable(undefined, { columns: [makeColumn({ type: 'text' })] })]);
    const diff = diffSnapshots(from, to);
    expect(diff.columnsModified).toHaveLength(1);
    expect(diff.columnsModified[0]?.tableName).toBe('users');
    expect(diff.columnsModified[0]?.column.type).toBe('text');
    expect(diff.columnsModified[0]?.changes).toEqual(['type: uuid → text']);
    expect(diff.columnsAdded).toEqual([]);
    expect(diff.columnsRemoved).toEqual([]);
  });

  it('detects a column name change', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([makeTable(undefined, { columns: [makeColumn({ name: 'user_id' })] })]);
    const diff = diffSnapshots(from, to);
    expect(diff.columnsModified).toHaveLength(1);
    expect(diff.columnsModified[0]?.changes).toEqual(['name: id → user_id']);
  });

  it('detects a column nullable change', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([
      makeTable(undefined, { columns: [makeColumn({ nullable: true, primaryKey: false })] }),
    ]);
    const diff = diffSnapshots(from, to);
    // nullable + primaryKey both flip here; assert nullable entry exists with exact format
    expect(diff.columnsModified).toHaveLength(1);
    expect(diff.columnsModified[0]?.changes).toContain('nullable: false → true');
  });

  it('detects a column primaryKey change', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([makeTable(undefined, { columns: [makeColumn({ primaryKey: false })] })]);
    const diff = diffSnapshots(from, to);
    expect(diff.columnsModified[0]?.changes).toContain('primaryKey: true → false');
  });

  it('detects a column default change', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([makeTable(undefined, { columns: [makeColumn({ default: 'now()' })] })]);
    const diff = diffSnapshots(from, to);
    expect(diff.columnsModified).toHaveLength(1);
    expect(diff.columnsModified[0]?.changes).toEqual(['default: (empty) → now()']);
  });

  it('treats null vs empty-string default as equal (ddl-export normalization)', () => {
    const from = makeSnapshot([makeTable(undefined, { columns: [makeColumn({ default: null })] })]);
    const to = makeSnapshot([makeTable(undefined, { columns: [makeColumn({ default: '' })] })]);
    const diff = diffSnapshots(from, to);
    expect(diff.columnsModified).toEqual([]);
  });

  it('treats whitespace-only default as equal to null', () => {
    const from = makeSnapshot([makeTable(undefined, { columns: [makeColumn({ default: null })] })]);
    const to = makeSnapshot([makeTable(undefined, { columns: [makeColumn({ default: '   ' })] })]);
    const diff = diffSnapshots(from, to);
    expect(diff.columnsModified).toEqual([]);
  });

  it('detects a column comment change', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([makeTable(undefined, { columns: [makeColumn({ comment: 'primary key' })] })]);
    const diff = diffSnapshots(from, to);
    expect(diff.columnsModified[0]?.changes).toEqual(['comment: (empty) → primary key']);
  });

  it('reports multiple field changes in stable field order', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([
      makeTable(undefined, { columns: [makeColumn({ name: 'uid', type: 'text' })] }),
    ]);
    const diff = diffSnapshots(from, to);
    expect(diff.columnsModified[0]?.changes).toEqual(['name: id → uid', 'type: uuid → text']);
  });

  it('does not report modified for a column on an added table', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([
      makeTable(),
      makeTable(TABLE_B, { name: 'teams', columns: [makeColumn({ type: 'text' })] }),
    ]);
    const diff = diffSnapshots(from, to);
    expect(diff.tablesAdded.map((t) => t.name)).toEqual(['teams']);
    expect(diff.columnsModified).toEqual([]);
  });

  it('uses the new table name for modified columns after a table rename', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([
      makeTable(undefined, {
        name: 'people',
        columns: [makeColumn({ type: 'text' })],
      }),
    ]);
    const diff = diffSnapshots(from, to);
    expect(diff.columnsModified[0]?.tableName).toBe('people');
    expect(diff.tablesModified).toHaveLength(1);
  });

  it('sorts columnsModified deterministically by tableName then column id', () => {
    const colB = makeColumn({ id: COL2, name: 'email', type: 'text', nullable: true, primaryKey: false });
    const from = makeSnapshot([
      makeTable(TABLE_A, { name: 'zzz', columns: [makeColumn({ type: 'uuid' })] }),
      makeTable(TABLE_B, { name: 'aaa', columns: [colB] }),
    ]);
    const to = makeSnapshot([
      // input order reversed on purpose: zzz first, aaa second
      makeTable(TABLE_A, { name: 'zzz', columns: [makeColumn({ type: 'text' })] }),
      makeTable(TABLE_B, { name: 'aaa', columns: [{ ...colB, type: 'varchar' }] }),
    ]);
    const diff = diffSnapshots(from, to);
    expect(diff.columnsModified.map((m) => m.tableName)).toEqual(['aaa', 'zzz']);
  });
});

describe('diffSnapshots modified tables', () => {
  it('detects a table name change', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([makeTable(undefined, { name: 'people' })]);
    const diff = diffSnapshots(from, to);
    expect(diff.tablesModified).toHaveLength(1);
    expect(diff.tablesModified[0]?.changes).toEqual(['name: users → people']);
    expect(diff.tablesAdded).toEqual([]);
    expect(diff.tablesRemoved).toEqual([]);
  });

  it('detects a table comment change', () => {
    const from = makeSnapshot([makeTable()]);
    const to = makeSnapshot([makeTable(undefined, { comment: 'core table' })]);
    const diff = diffSnapshots(from, to);
    expect(diff.tablesModified[0]?.changes).toEqual(['comment: (empty) → core table']);
  });

  it('treats empty vs whitespace-only table comment as equal', () => {
    const from = makeSnapshot([makeTable(undefined, { comment: '' })]);
    const to = makeSnapshot([makeTable(undefined, { comment: '   ' })]);
    const diff = diffSnapshots(from, to);
    expect(diff.tablesModified).toEqual([]);
  });

  it('detects an indexes change as a joined set string', () => {
    const from = makeSnapshot([makeTable(undefined, { indexes: [] })]);
    const to = makeSnapshot([makeTable(undefined, { indexes: ['email'] })]);
    const diff = diffSnapshots(from, to);
    expect(diff.tablesModified).toHaveLength(1);
    expect(diff.tablesModified[0]?.changes).toEqual(['indexes: (empty) → email']);
  });

  it('ignores index order, duplicates and blank entries (set semantics)', () => {
    const from = makeSnapshot([makeTable(undefined, { indexes: ['b', 'a', 'a', '  '] })]);
    const to = makeSnapshot([makeTable(undefined, { indexes: ['a', 'b'] })]);
    const diff = diffSnapshots(from, to);
    expect(diff.tablesModified).toEqual([]);
  });
});

describe('diffSnapshots changed relations', () => {
  const REL2 = 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee';

  it('detects a cardinality change', () => {
    const from = makeSnapshot([], [makeRelation()]);
    const to = makeSnapshot([], [makeRelation({ cardinality: 'N:M' })]);
    const diff = diffSnapshots(from, to);
    expect(diff.relationsChanged).toHaveLength(1);
    expect(diff.relationsChanged[0]?.changes).toEqual(['cardinality: 1:N → N:M']);
    expect(diff.relationsAdded).toEqual([]);
    expect(diff.relationsRemoved).toEqual([]);
  });

  it('detects an onDelete change', () => {
    const from = makeSnapshot([], [makeRelation()]);
    const to = makeSnapshot([], [makeRelation({ onDelete: 'restrict' })]);
    const diff = diffSnapshots(from, to);
    expect(diff.relationsChanged[0]?.changes).toEqual(['onDelete: cascade → restrict']);
  });

  it('treats an endpoint change as changed, not added/removed', () => {
    const from = makeSnapshot([], [makeRelation()]);
    const to = makeSnapshot([], [makeRelation({ fromColumnId: REL2 })]);
    const diff = diffSnapshots(from, to);
    expect(diff.relationsChanged).toHaveLength(1);
    expect(diff.relationsChanged[0]?.changes).toEqual([
      `fromColumnId: ${COL_ID} → ${REL2}`,
    ]);
    expect(diff.relationsAdded).toEqual([]);
    expect(diff.relationsRemoved).toEqual([]);
  });

  it('sorts relationsChanged deterministically by id', () => {
    const r1 = makeRelation({ id: 'aaaaaaaa-0000-4000-8000-000000000001', cardinality: '1:N' });
    const r2 = makeRelation({ id: 'aaaaaaaa-0000-4000-8000-000000000002', cardinality: '1:N' });
    const from = makeSnapshot([], [r1, r2]);
    const to = makeSnapshot([], [
      { ...r2, cardinality: 'N:M' },
      { ...r1, cardinality: 'N:M' },
    ]);
    const diff = diffSnapshots(from, to);
    expect(diff.relationsChanged.map((r) => r.relation.id)).toEqual([r1.id, r2.id]);
  });
});

describe('diffSnapshots modified negative/combined/edge', () => {
  const TABLE_C = '33333333-3333-4333-8333-333333333333';
  const REL2 = 'aaaaaaaa-0000-4000-8000-000000000009';

  it('returns empty modified arrays for identical snapshots', () => {
    const snap = makeSnapshot([makeTable()], [makeRelation()]);
    const diff = diffSnapshots(snap, structuredClone(snap));
    expect(diff.columnsModified).toEqual([]);
    expect(diff.tablesModified).toEqual([]);
    expect(diff.relationsChanged).toEqual([]);
    expect(diffSummary(diff)).toBe('No differences');
  });

  it('combines added/removed/modified in one diff', () => {
    const from = makeSnapshot(
      [
        makeTable(),
        makeTable(TABLE_C, { name: 'legacy', columns: [makeColumn()] }),
      ],
      [makeRelation()],
    );
    const to = makeSnapshot(
      [
        makeTable(undefined, {
          columns: [
            makeColumn({ type: 'text' }),
            makeColumn({
              id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              name: 'email',
              type: 'text',
              nullable: true,
              primaryKey: false,
            }),
          ],
        }),
        makeTable(TABLE_B, { name: 'teams' }),
      ],
      [
        makeRelation({ cardinality: 'N:M' }),
        makeRelation({ id: REL2, cardinality: '1:1' }),
      ],
    );
    const diff = diffSnapshots(from, to);
    expect(diff.tablesAdded.map((t) => t.name)).toEqual(['teams']);
    expect(diff.tablesRemoved.map((t) => t.name)).toEqual(['legacy']);
    expect(diff.columnsAdded.map((c) => c.column.name)).toEqual(['email']);
    expect(diff.columnsModified.map((c) => c.changes)).toEqual([['type: uuid → text']]);
    expect(diff.relationsChanged).toHaveLength(1);
    expect(diff.relationsAdded).toHaveLength(1);
    const summary = diffSummary(diff);
    expect(summary).toContain('1 table(s) added');
    expect(summary).toContain('1 table(s) removed');
    expect(summary).toContain('1 column(s) added');
    expect(summary).toContain('1 column(s) modified');
    expect(summary).toContain('1 relation(s) added');
    expect(summary).toContain('1 relation(s) changed');
  });

  it('never throws for undefined or empty snapshots', () => {
    expect(() => diffSnapshots(undefined, undefined)).not.toThrow();
    expect(() => diffSnapshots(undefined, makeSnapshot())).not.toThrow();
    expect(() => diffSnapshots(makeSnapshot(), undefined)).not.toThrow();
    const bothEmpty = diffSnapshots(undefined, undefined);
    expect(bothEmpty.columnsModified).toEqual([]);
    expect(bothEmpty.tablesModified).toEqual([]);
    expect(bothEmpty.relationsChanged).toEqual([]);
    expect(diffSummary(bothEmpty)).toBe('No differences');
    const toOnly = diffSnapshots(undefined, makeSnapshot([makeTable()]));
    expect(toOnly.columnsModified).toEqual([]);
    expect(toOnly.tablesModified).toEqual([]);
  });

  it('summarizes modified/changed counts', () => {
    const from = makeSnapshot([makeTable(undefined, { comment: '' })], [makeRelation()]);
    const to = makeSnapshot(
      [makeTable(undefined, { comment: 'v2', columns: [makeColumn({ type: 'text' })] })],
      [makeRelation({ onDelete: 'restrict' })],
    );
    const summary = diffSummary(diffSnapshots(from, to));
    expect(summary).toContain('1 table(s) modified');
    expect(summary).toContain('1 column(s) modified');
    expect(summary).toContain('1 relation(s) changed');
  });
});