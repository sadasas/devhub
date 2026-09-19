import { describe, expect, it } from 'vitest';
import { fromDBML } from './dbml-import';
import { toDBML } from './dbml-export';
import type { Relation, Table } from '../../lib/types';

function colNames(t: Table): string[] {
  return t.columns.map((c) => c.name);
}

describe('fromDBML basics', () => {
  it('empty/garbage never throws, returns empty', () => {
    expect(fromDBML('')).toEqual({ tables: [], relations: [], warnings: [] });
    expect(fromDBML('   \n\t  \n')).toEqual({ tables: [], relations: [], warnings: [] });
    expect(() => fromDBML(';;; ((())) {{{ garbage')).not.toThrow();
    const garbage = fromDBML(';;; ((())) {{{');
    expect(garbage.tables).toEqual([]);
    expect(garbage.relations).toEqual([]);
    expect(() => fromDBML(null as never)).not.toThrow();
  });

  it('parses Table with pk/not null/default/note/increment', () => {
    const got = fromDBML(`Table users {
  id int [pk, increment]
  email varchar(255) [not null, unique]
  name text [default: 'anon', note: 'display name']
}`);
    expect(got.warnings).toEqual([]);
    expect(got.tables).toHaveLength(1);
    const t = got.tables[0]!;
    expect(t.name).toBe('users');
    expect(colNames(t)).toEqual(['id', 'email', 'name']);
    const [id, email, name] = t.columns;
    expect(id).toMatchObject({ type: 'int', primaryKey: true, nullable: false, autoincrement: true });
    expect(email).toMatchObject({ type: 'varchar(255)', nullable: false });
    expect(t.indexes).toContain('unique:email');
    expect(name).toMatchObject({ type: 'text', nullable: true, default: 'anon', comment: 'display name' });
  });

  it('honors comments and skips TableGroup/Project with warnings', () => {
    const got = fromDBML(`// a comment
/* block
   comment */
Table a {
  id int [pk] // trailing
}
TableGroup g {
  a
}
Project p {
}`);
    expect(got.tables).toHaveLength(1);
    expect(got.tables[0]!.name).toBe('a');
    expect(got.warnings.map((w) => w.message)).toEqual([
      'unsupported TableGroup skipped',
      'unsupported Project skipped',
    ]);
    expect(got.warnings[0]!.line).toBeGreaterThan(1);
  });

  it('duplicate tables and columns are skipped with warnings', () => {
    const got = fromDBML(`Table users {
  id int [pk]
  id text
}
Table USERS {
  x int
}`);
    expect(got.tables).toHaveLength(1);
    expect(colNames(got.tables[0]!)).toEqual(['id']);
    expect(got.warnings.map((w) => w.message)).toEqual([
      'duplicate column "id" skipped',
      'duplicate table "USERS" skipped',
    ]);
  });

  it('quoted identifiers and escapes work', () => {
    const got = fromDBML(`Table "my table" {
  "weird-col" text [note: 'it\\'s ok']
}`);
    expect(got.warnings).toEqual([]);
    expect(got.tables[0]!.name).toBe('my table');
    expect(got.tables[0]!.columns[0]).toMatchObject({ name: 'weird-col', comment: "it's ok" });
  });
});

describe('fromDBML enums', () => {
  it('resolves enum-typed columns including forward references', () => {
    const got = fromDBML(`Table orders {
  id int [pk]
  status order_status
}
Enum order_status {
  "pending"
  "paid"
}`);
    expect(got.warnings).toEqual([]);
    const status = got.tables[0]!.columns.find((c) => c.name === 'status')!;
    expect(status.type).toBe(`enum('pending', 'paid')`);
  });

  it('skips empty and duplicate enums with warnings', () => {
    const got = fromDBML(`Enum empty {
}
Enum dup {
  "a"
}
Enum DUP {
  "b"
}`);
    expect(got.tables).toEqual([]);
    expect(got.warnings.map((w) => w.message)).toEqual([
      'enum "empty" has no values skipped',
      'duplicate enum "DUP" skipped',
    ]);
  });
});

describe('fromDBML refs', () => {
  const base = `Table users {
  id int [pk]
}
Table posts {
  id int [pk]
  user_id int
}`;

  it('parses > Ref with delete action', () => {
    const got = fromDBML(`${base}
Ref: posts.user_id > users.id [delete: cascade]`);
    expect(got.warnings).toEqual([]);
    expect(got.relations).toHaveLength(1);
    const r = got.relations[0]!;
    expect(r.cardinality).toBe('1:N');
    expect(r.onDelete).toBe('cascade');
    const byName = new Map(got.tables.map((t) => [t.name, t] as const));
    const posts = byName.get('posts')!;
    const users = byName.get('users')!;
    expect(r.fromTableId).toBe(posts.id);
    expect(r.toTableId).toBe(users.id);
    expect(posts.columns.find((c) => c.id === r.fromColumnId)?.name).toBe('user_id');
    expect(users.columns.find((c) => c.id === r.toColumnId)?.name).toBe('id');
  });

  it('maps < to 1:N, - to 1:1, <> to N:M; unknown endpoints skipped', () => {
    const got = fromDBML(`${base}
Ref: users.id < posts.user_id
Ref: users.id - posts.id
Ref pair {
  posts.id <> users.id
}
Ref: posts.nope > users.id
Ref: ghost.id > users.id`);
    expect(got.relations.map((r) => r.cardinality)).toEqual(['1:N', '1:1', 'N:M']);
    expect(got.warnings.map((w) => w.message)).toEqual([
      'ref "posts.nope" skipped (unknown column)',
      'ref "ghost.id" skipped (unknown table)',
    ]);
  });

  it('supports Ref blocks and inline column refs', () => {
    const got = fromDBML(`Table users {
  id int [pk]
}
Table posts {
  id int [pk]
  user_id int [ref: > users.id]
}
Ref fk_posts {
  posts.user_id > users.id
}`);
    expect(got.warnings).toEqual([]);
    expect(got.relations).toHaveLength(2);
  });

  it('unknown delete action defaults to restrict with warning', () => {
    const got = fromDBML(`${base}
Ref: posts.user_id > users.id [delete: explode]`);
    expect(got.relations[0]!.onDelete).toBe('restrict');
    expect(got.warnings.map((w) => w.message)).toEqual([
      'unknown delete action "explode" defaulted to restrict',
    ]);
  });
});

describe('fromDBML indexes + notes', () => {
  it('parses indexes block and table Note', () => {
    const got = fromDBML(`Table users {
  id int [pk]
  email varchar
  age int
  Note: 'app users'
  indexes {
    email [unique]
    (email, age)
  }
}`);
    expect(got.warnings).toEqual([]);
    const t = got.tables[0]!;
    expect(t.comment).toBe('app users');
    expect(t.indexes).toContain('unique:email');
    expect(t.indexes).toContain('email, age');
  });

  it('drops index entries on unknown columns with warnings', () => {
    const got = fromDBML(`Table users {
  id int [pk]
  indexes {
    ghost
    (id, ghost) [unique]
  }
}`);
    expect(got.tables[0]!.indexes).toEqual([]);
    expect(got.warnings.map((w) => w.message)).toEqual([
      'index "ghost" skipped (unknown column)',
      'index (id, ghost) skipped (unknown column)',
    ]);
  });

  it('serial becomes autoincrement; increment on text is ignored with warning', () => {
    const got = fromDBML(`Table t {
  id serial [pk]
  slug text [increment]
}`);
    const cols = got.tables[0]!.columns;
    expect(cols.find((c) => c.name === 'id')).toMatchObject({ type: 'INTEGER', autoincrement: true });
    expect(cols.find((c) => c.name === 'slug')).toMatchObject({ autoincrement: false });
    expect(got.warnings.map((w) => w.message)).toEqual([
      'increment on non-integer column "slug" ignored',
    ]);
  });
});

describe('fromDBML round-trip', () => {
  const now = '2026-01-01T00:00:00.000Z';
  function mkTable(id: string, name: string, cols: Array<Partial<Table['columns'][number]> & { name: string }>): Table {
    return {
      id,
      createdAt: now,
      updatedAt: now,
      name,
      comment: '',
      columns: cols.map((c, i) => ({
        id: `${id}-c${i}`,
        type: 'text',
        nullable: true,
        primaryKey: false,
        default: null,
        comment: '',
        ...c,
      })),
      indexes: [],
    };
  }

  it('toDBML -> fromDBML preserves tables, columns, settings, indexes and refs', () => {
    const users = mkTable('t1', 'users', [
      { name: 'id', type: 'int', nullable: false, primaryKey: true, autoincrement: true },
      { name: 'email', type: 'varchar(255)', nullable: false },
      { name: 'status', type: `enum('active', 'archived')`, default: 'active', comment: 'state' },
    ]);
    users.indexes = ['unique:email'];
    const orders = mkTable('t2', 'orders', [
      { name: 'id', type: 'int', nullable: false, primaryKey: true },
      { name: 'user_id', type: 'int' },
    ]);
    const rel: Relation = {
      id: 'r1',
      createdAt: now,
      updatedAt: now,
      fromTableId: 't2',
      fromColumnId: 't2-c1',
      toTableId: 't1',
      toColumnId: 't1-c0',
      cardinality: '1:N',
      onDelete: 'cascade',
    };
    const dbml = toDBML([users, orders], [rel]);
    expect(dbml).toContain('Table users');
    const back = fromDBML(dbml);
    expect(back.warnings).toEqual([]);
    expect(back.tables.map((t) => t.name).sort()).toEqual(['orders', 'users']);
    const bu = back.tables.find((t) => t.name === 'users')!;
    expect(bu.columns.map((c) => c.name)).toEqual(['id', 'email', 'status']);
    expect(bu.columns[0]).toMatchObject({ type: 'int', primaryKey: true, nullable: false, autoincrement: true });
    expect(bu.columns[1]).toMatchObject({ type: 'varchar(255)', nullable: false });
    expect(bu.columns[2]).toMatchObject({ type: `enum('active', 'archived')`, default: 'active', comment: 'state' });
    expect(bu.indexes).toContain('unique:email');
    expect(back.relations).toHaveLength(1);
    const br = back.relations[0]!;
    const bo = back.tables.find((t) => t.name === 'orders')!;
    expect(br.fromTableId).toBe(bo.id);
    expect(br.toTableId).toBe(bu.id);
    expect(bo.columns.find((c) => c.id === br.fromColumnId)?.name).toBe('user_id');
    expect(bu.columns.find((c) => c.id === br.toColumnId)?.name).toBe('id');
  });

  it('re-exporting the import is stable (byte-identical on second pass)', () => {
    const once = fromDBML(toDBML(
      [mkTable('t1', 'users', [{ name: 'id', type: 'int', nullable: false, primaryKey: true }])],
      [],
    ));
    const dbml1 = toDBML(once.tables, once.relations);
    const twice = fromDBML(dbml1);
    expect(toDBML(twice.tables, twice.relations)).toBe(dbml1);
  });
});
