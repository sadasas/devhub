import { describe, expect, it } from 'vitest';
import { safeIdent, toPostgresDDL } from './ddl-export';
import type { Column, Relation, Table } from '../../lib/types';

const NOW = '2026-08-01T00:00:00.000Z';
const TABLE_USERS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TABLE_ORDERS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TABLE_POSTS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const COL_USER_ID = '11111111-1111-4111-8111-111111111111';
const COL_ORDER_USER = '22222222-2222-4222-8222-222222222222';

function makeColumn(over: Partial<Column> = {}): Column {
  return {
    id: COL_USER_ID,
    name: 'id',
    type: 'UUID',
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
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
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

describe('toPostgresDDL', () => {
  it('exports a simple table with IF NOT EXISTS, PK inline, and semicolons', () => {
    const users = makeTable(TABLE_USERS, 'users', {
      columns: [
        makeColumn({ id: COL_USER_ID, name: 'id', type: 'UUID' }),
        makeColumn({ id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', name: 'email', type: 'TEXT', nullable: false, primaryKey: false }),
      ],
    });
    const ddl = toPostgresDDL([users], []);
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS users (');
    expect(ddl).toContain('PRIMARY KEY (id)');
    expect(ddl.trimEnd().endsWith(';')).toBe(true);
    expect(ddl).toContain('  id UUID NOT NULL');
  });

  it('emits composite primary keys inline', () => {
    const t = makeTable(TABLE_POSTS, 'memberships', {
      columns: [
        makeColumn({ id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', name: 'user_id', type: 'UUID' }),
        makeColumn({ id: 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', name: 'team_id', type: 'UUID' }),
      ],
    });
    const ddl = toPostgresDDL([t], []);
    expect(ddl).toContain('PRIMARY KEY (user_id, team_id)');
  });

  it('maps FK onDelete cascade/setNull/restrict', () => {
    const users = makeTable(TABLE_USERS, 'users');
    const mkChild = (id: string, name: string, colId: string): Table =>
      makeTable(id, name, {
        columns: [
          makeColumn({ id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0', name: 'id', type: 'UUID' }),
          makeColumn({ id: colId, name: 'author_id', type: 'UUID', nullable: true, primaryKey: false }),
        ],
      });
    const posts = mkChild(TABLE_ORDERS, 'posts', 'aaaaaaaa-0000-4000-8000-000000000001');
    const comments = mkChild(TABLE_POSTS, 'comments', 'aaaaaaaa-0000-4000-8000-000000000002');
    const likes = makeTable('dddddddd-dddd-4ddd-8ddd-ddddddddddde', 'likes', {
      columns: [
        makeColumn({ id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0', name: 'id', type: 'UUID' }),
        makeColumn({ id: 'aaaaaaaa-0000-4000-8000-000000000003', name: 'author_id', type: 'UUID', nullable: true, primaryKey: false }),
      ],
    });
    const ddl = toPostgresDDL(
      [users, posts, comments, likes],
      [
        makeRelation({ id: '00000000-0000-4000-8000-000000000001', fromTableId: posts.id, fromColumnId: 'aaaaaaaa-0000-4000-8000-000000000001', onDelete: 'cascade' }),
        makeRelation({ id: '00000000-0000-4000-8000-000000000002', fromTableId: comments.id, fromColumnId: 'aaaaaaaa-0000-4000-8000-000000000002', onDelete: 'setNull' }),
        makeRelation({ id: '00000000-0000-4000-8000-000000000003', fromTableId: likes.id, fromColumnId: 'aaaaaaaa-0000-4000-8000-000000000003', onDelete: 'restrict' }),
      ],
    );
    expect(ddl).toContain('ON DELETE CASCADE');
    expect(ddl).toContain('ON DELETE SET NULL');
    expect(ddl).toContain('ON DELETE RESTRICT');
    expect(ddl).toContain('ADD CONSTRAINT');
    expect(ddl).toContain('FOREIGN KEY (author_id) REFERENCES users (id)');
  });

  it('emits unique vs plain indexes and DEFAULT now()', () => {
    const users = makeTable(TABLE_USERS, 'users', {
      columns: [
        makeColumn({ id: COL_USER_ID, name: 'id', type: 'UUID' }),
        makeColumn({ id: 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1', name: 'email', type: 'TEXT', nullable: false, primaryKey: false }),
        makeColumn({ id: 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2', name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, primaryKey: false, default: 'now()' }),
      ],
      indexes: ['created_at', 'unique:email'],
    });
    const ddl = toPostgresDDL([users], []);
    expect(ddl).toContain('DEFAULT now()');
    expect(ddl).toContain('CREATE UNIQUE INDEX IF NOT EXISTS');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS');
    expect(ddl).toMatch(/CREATE TABLE[\s\S]*CREATE INDEX/);
  });

  it('escapes weird identifiers and skips orphan relations without crashing', () => {
    const weird = makeTable(TABLE_USERS, 'my table', {
      columns: [
        makeColumn({ id: COL_USER_ID, name: 'weird-col', type: 'TEXT', nullable: true, primaryKey: true }),
      ],
    });
    const orphan = makeRelation({
      fromTableId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      fromColumnId: 'ffffffff-ffff-4fff-8fff-fffffffffffe',
      toTableId: 'ffffffff-ffff-4fff-8fff-fffffffffff0',
      toColumnId: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
    });
    let ddl = '';
    expect(() => {
      ddl = toPostgresDDL([weird], [orphan]);
    }).not.toThrow();
    expect(ddl).toContain('"my table"');
    expect(ddl).toContain('"weird-col"');
    expect(ddl).not.toContain('ADD CONSTRAINT');
  });

  it('is deterministic across runs and sorts tables by name', () => {
    const aaa = makeTable(TABLE_USERS, 'aaa', {
      columns: [makeColumn({ id: COL_USER_ID, name: 'id', type: 'UUID' })],
    });
    const zzz = makeTable(TABLE_ORDERS, 'zzz', {
      columns: [makeColumn({ id: COL_ORDER_USER, name: 'id', type: 'UUID' })],
    });
    const first = toPostgresDDL([zzz, aaa], []);
    const second = toPostgresDDL([zzz, aaa], []);
    expect(second).toBe(first);
    expect(toPostgresDDL([aaa, zzz], [])).toBe(first);
    expect(first.indexOf('aaa')).toBeLessThan(first.indexOf('zzz'));
  });

  it('emits CREATE TYPE for enum columns before CREATE TABLE', () => {
    const users = makeTable(TABLE_USERS, 'users', {
      columns: [
        makeColumn({ id: COL_USER_ID, name: 'id', type: 'UUID' }),
        makeColumn({ id: 'eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1', name: 'status', type: "enum('active','archived')", nullable: false, primaryKey: false }),
      ],
    });
    const ddl = toPostgresDDL([users], []);
    expect(ddl).toContain('CREATE TYPE IF NOT EXISTS');
    expect(ddl).toContain("AS ENUM ('active', 'archived')");
    expect(ddl.indexOf('CREATE TYPE')).toBeLessThan(ddl.indexOf('CREATE TABLE'));
  });

  it('emits SERIAL family untuk flag autoincrement + gugurkan DEFAULT', () => {
    const users = makeTable(TABLE_USERS, 'users', {
      columns: [
        makeColumn({ id: COL_USER_ID, name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoincrement: true, default: '1' }),
        makeColumn({ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', name: 'seq', type: 'BIGINT', nullable: true, primaryKey: false, autoincrement: true }),
        makeColumn({ id: 'eeeeeee2-eeee-4eee-8eee-eeeeeeeeeee2', name: 'note', type: 'TEXT', nullable: true, primaryKey: false, autoincrement: true }),
      ],
    });
    const ddl = toPostgresDDL([users], []);
    expect(ddl).toContain('id SERIAL NOT NULL');
    expect(ddl).toContain('seq BIGSERIAL');
    expect(ddl).not.toContain('DEFAULT 1');
    // TEXT + flag: flag diabaikan, tipe apa adanya.
    expect(ddl).toContain('note TEXT');
    expect(ddl).not.toContain('note SERIAL');
  });
});

describe('safeIdent', () => {
  it('leaves simple lowercase identifiers bare and quotes the rest', () => {
    expect(safeIdent('users')).toBe('users');
    expect(safeIdent('my table')).toBe('"my table"');
    expect(safeIdent('we"ird')).toBe('"we""ird"');
  });
});
