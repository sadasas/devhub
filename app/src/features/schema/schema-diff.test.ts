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