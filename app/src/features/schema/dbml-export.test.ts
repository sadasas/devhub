import { describe, expect, it } from 'vitest';
import { toDBML } from './dbml-export';
import type { Column, Relation, Table } from '../../lib/types';

const NOW = '2026-08-01T00:00:00.000Z';
const TABLE_USERS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TABLE_ORDERS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
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

describe('toDBML', () => {
  it('menulis [pk] tanpa dobel not null, [not null], dan kolom nullable polos', () => {
    const users = makeTable(TABLE_USERS, 'users', {
      columns: [
        makeColumn({ id: COL_USER_ID, name: 'id', type: 'UUID' }),
        makeColumn({
          id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
          name: 'email',
          type: 'TEXT',
          nullable: false,
          primaryKey: false,
        }),
        makeColumn({
          id: 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
          name: 'nick',
          type: 'TEXT',
          nullable: true,
          primaryKey: false,
        }),
      ],
    });
    const out = toDBML([users], []);
    expect(out).toContain('Table users {');
    expect(out).toContain('id UUID [pk]');
    expect(out).not.toContain('[pk, not null]');
    expect(out).toContain('email TEXT [not null]');
    // kolom nullable tanpa setting -> tanpa kurung siku
    expect(out).toMatch(/nick TEXT(\s*\n|\s*\r?\n)/);
  });

  it('mengutip default: numerik/bool/fungsi backtick, string single-quote', () => {
    const t = makeTable(TABLE_USERS, 'users', {
      columns: [
        makeColumn({ id: COL_USER_ID, name: 'id', type: 'UUID' }),
        makeColumn({
          id: 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
          name: 'age',
          type: 'INTEGER',
          nullable: true,
          primaryKey: false,
          default: '0',
        }),
        makeColumn({
          id: 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
          name: 'active',
          type: 'BOOLEAN',
          nullable: true,
          primaryKey: false,
          default: 'true',
        }),
        makeColumn({
          id: 'bbbbbbb3-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
          name: 'created_at',
          type: 'TIMESTAMPTZ',
          nullable: true,
          primaryKey: false,
          default: 'now()',
        }),
        makeColumn({
          id: 'bbbbbbb4-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
          name: 'status',
          type: 'TEXT',
          nullable: true,
          primaryKey: false,
          default: 'pending',
        }),
      ],
    });
    const out = toDBML([t], []);
    expect(out).toContain('age INTEGER [default: `0`]');
    expect(out).toContain('active BOOLEAN [default: `true`]');
    expect(out).toContain('created_at TIMESTAMPTZ [default: `now()`]');
    expect(out).toContain("status TEXT [default: 'pending']");
  });

  it('menulis note kolom dengan escape single-quote', () => {
    const t = makeTable(TABLE_USERS, 'users', {
      columns: [
        makeColumn({ id: COL_USER_ID, name: 'id', type: 'UUID' }),
        makeColumn({
          id: 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1',
          name: 'email',
          type: 'TEXT',
          nullable: false,
          primaryKey: false,
          comment: "pemilik's email",
        }),
      ],
    });
    const out = toDBML([t], []);
    expect(out).toContain("note: 'pemilik\\'s email'");
  });

  it('memancarkan Enum sebelum Table untuk kolom enum(...)', () => {
    const users = makeTable(TABLE_USERS, 'users', {
      columns: [
        makeColumn({ id: COL_USER_ID, name: 'id', type: 'UUID' }),
        makeColumn({
          id: 'eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1',
          name: 'status',
          type: "enum('active','archived')",
          nullable: false,
          primaryKey: false,
        }),
      ],
    });
    const out = toDBML([users], []);
    expect(out).toContain('Enum users_status_enum {');
    expect(out).toContain('"active"');
    expect(out).toContain('"archived"');
    expect(out.indexOf('Enum users_status_enum')).toBeLessThan(out.indexOf('Table users'));
    expect(out).toContain('status users_status_enum [not null]');
  });

  it('mendukung varian enum: ENUM("a") dan enum: a, b', () => {
    const t1 = makeTable(TABLE_USERS, 'users', {
      columns: [
        makeColumn({ id: COL_USER_ID, name: 'id', type: 'UUID' }),
        makeColumn({
          id: 'eeeeeee2-eeee-4eee-8eee-eeeeeeeeeee2',
          name: 'role',
          type: 'ENUM("admin", "member")',
          nullable: true,
          primaryKey: false,
        }),
      ],
    });
    const out1 = toDBML([t1], []);
    expect(out1).toContain('Enum users_role_enum {');

    const t2 = makeTable(TABLE_USERS, 'users', {
      columns: [
        makeColumn({ id: COL_USER_ID, name: 'id', type: 'UUID' }),
        makeColumn({
          id: 'eeeeeee3-eeee-4eee-8eee-eeeeeeeeeee3',
          name: 'kind',
          type: 'enum: a, b',
          nullable: true,
          primaryKey: false,
        }),
      ],
    });
    const out2 = toDBML([t2], []);
    expect(out2).toContain('Enum users_kind_enum {');
  });

  it('menulis Ref dasar dan me-skip relasi yatim tanpa throw', () => {
    const users = makeTable(TABLE_USERS, 'users');
    const orders = makeTable(TABLE_ORDERS, 'orders', {
      columns: [
        makeColumn({ id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0', name: 'id', type: 'UUID' }),
        makeColumn({
          id: COL_ORDER_USER,
          name: 'user_id',
          type: 'UUID',
          nullable: true,
          primaryKey: false,
        }),
      ],
    });
    const orphan = makeRelation({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      fromTableId: 'ffffffff-ffff-4fff-8fff-fffffffffffe',
      fromColumnId: 'ffffffff-ffff-4fff-8fff-fffffffffffd',
      toTableId: 'ffffffff-ffff-4fff-8fff-fffffffffff0',
      toColumnId: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
    });
    let out = '';
    expect(() => {
      out = toDBML([users, orders], [makeRelation(), orphan]);
    }).not.toThrow();
    expect(out).toContain('Ref: orders.user_id > users.id');
    expect(out).not.toContain('ffffffff');
  });

  it('menulis indexes block dengan [unique] hanya untuk index unique', () => {
    const users = makeTable(TABLE_USERS, 'users', {
      columns: [
        makeColumn({ id: COL_USER_ID, name: 'id', type: 'UUID' }),
        makeColumn({
          id: 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
          name: 'email',
          type: 'TEXT',
          nullable: false,
          primaryKey: false,
        }),
      ],
      indexes: ['created_at', 'unique:email'],
    });
    const out = toDBML([users], []);
    expect(out).toContain('indexes {');
    expect(out).toContain('email [unique]');
    // created_at polos tanpa [unique]
    expect(out).toMatch(/^\s+created_at$/m);
  });

  it('deterministik: sort by name dan stabil lintas run', () => {
    const aaa = makeTable(TABLE_USERS, 'aaa', {
      columns: [makeColumn({ id: COL_USER_ID, name: 'id', type: 'UUID' })],
    });
    const zzz = makeTable(TABLE_ORDERS, 'zzz', {
      columns: [makeColumn({ id: COL_ORDER_USER, name: 'id', type: 'UUID' })],
    });
    const first = toDBML([zzz, aaa], []);
    const second = toDBML([zzz, aaa], []);
    expect(second).toBe(first);
    expect(toDBML([aaa, zzz], [])).toBe(first);
    expect(first.indexOf('Table aaa')).toBeLessThan(first.indexOf('Table zzz'));
  });

  it('mengutip identifier ber-spasi/dash dan tak pernah throw untuk input rusak', () => {
    const weird = makeTable(TABLE_USERS, 'my table', {
      columns: [makeColumn({ id: COL_USER_ID, name: 'weird-col', type: 'TEXT', nullable: true, primaryKey: false })],
    });
    let out = '';
    expect(() => {
      out = toDBML([weird], []);
    }).not.toThrow();
    expect(out).toContain('Table "my table" {');
    expect(out).toContain('"weird-col" TEXT');
    expect(() => toDBML([], [])).not.toThrow();
    expect(toDBML([], [])).toBe('');
  });
});
