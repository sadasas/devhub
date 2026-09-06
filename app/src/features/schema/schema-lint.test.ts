import { describe, expect, it } from 'vitest';
import { lintSchema } from './schema-lint';
import type { Column, Relation, Table } from '../../lib/types';

const NOW = '2026-08-01T00:00:00.000Z';
const TABLE_USERS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TABLE_ORDERS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COL_USER_ID = '11111111-1111-4111-8111-111111111111';
const COL_ORDER_ID = '22222222-2222-4222-8222-222222222222';
const COL_ORDER_USER = '33333333-3333-4333-8333-333333333333';
const REL_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function makeColumn(over: Partial<Column> = {}): Column {
  return {
    id: COL_USER_ID,
    name: 'id',
    type: 'uuid',
    nullable: false,
    primaryKey: true,
    default: null,
    comment: '',
    ...over,
  };
}

function makeTable(id: string, name: string, over: Partial<Table> = {}): Table {
  return {
    id,
    createdAt: NOW,
    updatedAt: NOW,
    name,
    comment: '',
    columns: [makeColumn()],
    indexes: [],
    ...over,
  };
}

function makeRelation(over: Partial<Relation> = {}): Relation {
  return {
    id: REL_ID,
    createdAt: NOW,
    updatedAt: NOW,
    fromTableId: TABLE_ORDERS,
    fromColumnId: COL_ORDER_USER,
    toTableId: TABLE_USERS,
    toColumnId: COL_USER_ID,
    cardinality: '1:N',
    onDelete: 'cascade',
    ...over,
  };
}

function validSchema(): { tables: Table[]; relations: Relation[] } {
  const users = makeTable(TABLE_USERS, 'users', {
    columns: [makeColumn({ id: COL_USER_ID, name: 'id', type: 'uuid' })],
    indexes: ['id'],
  });
  const orders = makeTable(TABLE_ORDERS, 'orders', {
    columns: [
      makeColumn({ id: COL_ORDER_ID, name: 'id', type: 'uuid' }),
      makeColumn({ id: COL_ORDER_USER, name: 'user_id', type: 'uuid', primaryKey: false }),
    ],
  });
  return { tables: [users, orders], relations: [makeRelation()] };
}

describe('lintSchema', () => {
  it('returns no issues for empty input', () => {
    expect(lintSchema([], [])).toEqual([]);
  });

  it('returns no issues for a valid schema', () => {
    const { tables, relations } = validSchema();
    expect(lintSchema(tables, relations)).toEqual([]);
  });

  it('flags missing-fk-target when a table is gone', () => {
    const { tables, relations } = validSchema();
    const issues = lintSchema([tables[0]!], relations);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('missing-fk-target');
    expect(issues[0]!.relationId).toBe(REL_ID);
  });

  it('flags missing-fk-target when a column is gone', () => {
    const users = makeTable(TABLE_USERS, 'users');
    const orders = makeTable(TABLE_ORDERS, 'orders', {
      columns: [makeColumn({ id: COL_ORDER_ID, name: 'id', type: 'uuid' })],
    });
    const issues = lintSchema([users, orders], [makeRelation()]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('missing-fk-target');
    expect(issues[0]!.tableId).toBe(TABLE_ORDERS);
    expect(issues[0]!.columnId).toBe(COL_ORDER_USER);
  });

  it('does not double-report orphan/type-mismatch for a broken relation', () => {
    const issues = lintSchema([], [makeRelation()]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe('missing-fk-target');
  });

  it('flags orphan-relation when a side has no PK', () => {
    const users = makeTable(TABLE_USERS, 'users', {
      columns: [makeColumn({ name: 'email', type: 'text', primaryKey: false })],
    });
    const orders = makeTable(TABLE_ORDERS, 'orders', {
      columns: [
        makeColumn({ id: COL_ORDER_ID, name: 'id', type: 'uuid' }),
        makeColumn({ id: COL_ORDER_USER, name: 'user_id', type: 'uuid', primaryKey: false }),
      ],
    });
    const issues = lintSchema([users, orders], [makeRelation()]);
    const orphans = issues.filter((i) => i.code === 'orphan-relation');
    expect(orphans).toHaveLength(1);
    expect(orphans[0]!.tableId).toBe(TABLE_USERS);
    expect(orphans[0]!.relationId).toBe(REL_ID);
  });

  it('passes orphan check when both sides have a PK', () => {
    const { tables, relations } = validSchema();
    const issues = lintSchema(tables, relations);
    expect(issues.filter((i) => i.code === 'orphan-relation')).toEqual([]);
  });

  it('flags pk-null per nullable PK column', () => {
    const bad = makeTable(TABLE_USERS, 'users', {
      columns: [makeColumn({ nullable: true, primaryKey: true })],
    });
    const issues = lintSchema([bad], []);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'pk-null',
      tableId: TABLE_USERS,
      columnId: COL_USER_ID,
    });
  });

  it('passes pk-null for non-nullable PK and nullable non-PK', () => {
    const ok = makeTable(TABLE_USERS, 'users', {
      columns: [
        makeColumn({ nullable: false, primaryKey: true }),
        makeColumn({ id: COL_ORDER_USER, name: 'nick', type: 'text', nullable: true, primaryKey: false }),
      ],
    });
    expect(lintSchema([ok], []).filter((i) => i.code === 'pk-null')).toEqual([]);
  });

  it('flags index-typo for unknown index names', () => {
    const t = makeTable(TABLE_USERS, 'users', { indexes: ['emial'] });
    const issues = lintSchema([t], []);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'index-typo', tableId: TABLE_USERS });
  });

  it('accepts valid, case-insensitive, and unique:-prefixed indexes; skips expressions', () => {
    const t = makeTable(TABLE_USERS, 'users', {
      columns: [
        makeColumn({ name: 'id', type: 'uuid' }),
        makeColumn({ id: COL_ORDER_USER, name: 'email', type: 'text', primaryKey: false }),
      ],
      indexes: ['ID', 'unique:email', 'unique email', 'lower(email)', 'email, id', 'email DESC', ''],
    });
    expect(lintSchema([t], []).filter((i) => i.code === 'index-typo')).toEqual([]);
  });

  it('flags type-mismatch for genuinely different types', () => {
    const users = makeTable(TABLE_USERS, 'users', {
      columns: [makeColumn({ type: 'text' })],
    });
    const orders = makeTable(TABLE_ORDERS, 'orders', {
      columns: [
        makeColumn({ id: COL_ORDER_ID, name: 'id', type: 'uuid' }),
        makeColumn({ id: COL_ORDER_USER, name: 'user_id', type: 'integer', primaryKey: false }),
      ],
    });
    const issues = lintSchema([users, orders], [makeRelation()]);
    expect(issues.some((i) => i.code === 'type-mismatch')).toBe(true);
  });

  it('treats known aliases as matching (no type-mismatch)', () => {
    const pairs: [string, string][] = [
      ['int', 'integer'],
      ['BOOL', 'boolean'],
      ['varchar(255)', 'text'],
      ['VARCHAR', 'TEXT'],
      ['character varying(100)', 'varchar(10)'],
      ['timestamptz', 'timestamp with time zone'],
      ['TIMESTAMPTZ', '  Timestamp   With Time Zone '],
      ['UUID', 'uuid'],
    ];
    for (const [fromType, toType] of pairs) {
      const users = makeTable(TABLE_USERS, 'users', {
        columns: [makeColumn({ type: toType })],
      });
      const orders = makeTable(TABLE_ORDERS, 'orders', {
        columns: [
          makeColumn({ id: COL_ORDER_ID, name: 'id', type: 'uuid' }),
          makeColumn({ id: COL_ORDER_USER, name: 'ref', type: fromType, primaryKey: false }),
        ],
      });
      const issues = lintSchema([users, orders], [makeRelation()]);
      expect(issues.filter((i) => i.code === 'type-mismatch')).toEqual([]);
    }
  });

  it('reports combined issues sorted deterministically', () => {
    const badTable = makeTable(TABLE_USERS, 'users', {
      columns: [makeColumn({ nullable: true, primaryKey: true, type: 'integer' })],
      indexes: ['nope'],
    });
    const orders = makeTable(TABLE_ORDERS, 'orders', {
      columns: [
        makeColumn({ id: COL_ORDER_ID, name: 'id', type: 'uuid' }),
        makeColumn({ id: COL_ORDER_USER, name: 'user_id', type: 'text', primaryKey: false }),
      ],
    });
    const first = lintSchema([badTable, orders], [makeRelation()]);
    const second = lintSchema([orders, badTable], [makeRelation()]);
    expect(first.length).toBeGreaterThan(1);
    expect(second).toEqual(first);
    const keys = first.map((i) => `${i.code}|${i.tableId}|${i.columnId ?? ''}|${i.relationId ?? ''}`);
    expect([...keys].sort()).toEqual(keys);
  });

  it('never throws for null/weird input', () => {
    expect(() =>
      lintSchema(null as never, undefined as never),
    ).not.toThrow();
    expect(lintSchema(null as never, undefined as never)).toEqual([]);
    const weird = makeTable(TABLE_USERS, 'users', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      columns: [null, { nope: 1 }] as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      indexes: [null, 42, ''] as any,
    });
    expect(() => lintSchema([weird], [null as never, {} as never])).not.toThrow();
  });
});
