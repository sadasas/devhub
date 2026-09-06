import { describe, expect, it } from 'vitest';
import { fromDrawDB, toDrawDB } from './drawdb-compat';
import { FE_LIMITS } from '../../lib/limits';
import type { Relation, Table } from '../../lib/types';

const NOW = '2026-08-01T00:00:00.000Z';

function makeDrawDiagram() {
  return {
    title: 'Self-made fixture',
    database: 'Postgres',
    tables: [
      {
        id: 't-users',
        name: 'users',
        comment: 'Users table',
        fields: [
          { id: 'f-u-id', name: 'id', type: 'UUID', primaryKey: true, nullable: false, default: null },
          { id: 'f-u-email', name: 'email', type: 'VARCHAR(255)', primaryKey: false, nullable: false },
        ],
      },
      {
        id: 't-posts',
        name: 'posts',
        fields: [
          { id: 'f-p-id', name: 'id', type: 'UUID', primaryKey: true, notNull: true },
          { id: 'f-p-author', name: 'author_id', type: 'UUID', nullable: true, default: null },
        ],
      },
    ],
    relationships: [
      {
        startTableId: 't-posts',
        startFieldId: 'f-p-author',
        endTableId: 't-users',
        endFieldId: 'f-u-id',
        cardinality: '1:N',
        onDelete: 'cascade',
      },
    ],
    enums: [],
    notes: [],
  };
}

function makeDevTable(id: string, name: string, cols: Array<Partial<Table['columns'][number]> & { name: string }>): Table {
  return {
    id,
    createdAt: NOW,
    updatedAt: NOW,
    name,
    comment: '',
    columns: cols.map((c, i) => ({
      id: `${id}-c${i}`,
      name: c.name,
      type: c.type ?? 'TEXT',
      nullable: c.nullable ?? true,
      primaryKey: c.primaryKey ?? false,
      default: c.default ?? null,
      comment: '',
    })),
    indexes: [],
  };
}

describe('fromDrawDB', () => {
  it('maps tables and fields to DevHub tables and columns', () => {
    const { tables, relations, warnings } = fromDrawDB(makeDrawDiagram());
    expect(warnings).toEqual([]);
    expect(tables).toHaveLength(2);
    const users = tables.find((t) => t.name === 'users');
    expect(users).toBeDefined();
    expect(users?.columns).toHaveLength(2);
    expect(users?.columns.find((c) => c.name === 'id')?.primaryKey).toBe(true);
    expect(users?.columns.find((c) => c.name === 'id')?.nullable).toBe(false);
    expect(users?.comment).toBe('Users table');
    const posts = tables.find((t) => t.name === 'posts');
    // notNull:true -> nullable:false via inverse mapping
    expect(posts?.columns.find((c) => c.name === 'id')?.nullable).toBe(false);
    expect(relations).toHaveLength(1);
    expect(relations[0]?.cardinality).toBe('1:N');
    expect(relations[0]?.onDelete).toBe('cascade');
  });

  it('generates fresh ids instead of reusing DrawDB ids', () => {
    const { tables, relations } = fromDrawDB(makeDrawDiagram());
    const ids = [...tables.map((t) => t.id), ...tables.flatMap((t) => t.columns.map((c) => c.id)), ...relations.map((r) => r.id)];
    expect(ids).not.toContain('t-users');
    expect(ids).not.toContain('f-u-id');
    expect(new Set(ids).size).toBe(ids.length);
    // Relations still resolve to the fresh column ids.
    const users = tables.find((t) => t.name === 'users');
    const posts = tables.find((t) => t.name === 'posts');
    const rel = relations[0];
    expect(users?.columns.some((c) => c.id === rel?.toColumnId)).toBe(true);
    expect(posts?.columns.some((c) => c.id === rel?.fromColumnId)).toBe(true);
  });

  it('accepts a JSON string input', () => {
    const raw = JSON.stringify(makeDrawDiagram());
    const { tables, relations, warnings } = fromDrawDB(raw);
    expect(warnings).toEqual([]);
    expect(tables).toHaveLength(2);
    expect(relations).toHaveLength(1);
  });

  it('returns empty with warning for an invalid JSON string', () => {
    expect(() => fromDrawDB('not json {')).not.toThrow();
    const result = fromDrawDB('not json {');
    expect(result.tables).toEqual([]);
    expect(result.relations).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('returns empty with warning for non-object input', () => {
    for (const bad of [null, 42, true]) {
      const res = fromDrawDB(bad);
      expect(res.tables).toEqual([]);
      expect(res.relations).toEqual([]);
      expect(res.warnings.length).toBeGreaterThan(0);
    }
  });

  it('ignores unknown fields without throwing', () => {
    const diagram = {
      title: 'x',
      database: 'Postgres',
      enums: [{ name: 'mood', values: ['a'] }],
      notes: [{ text: 'hello' }],
      tables: [
        {
          id: 't1',
          name: 'users',
          x: 100,
          y: 200,
          color: '#ff0000',
          width: 300,
          fields: [
            { id: 'f1', name: 'id', type: 'UUID', primaryKey: true, unique: true, increment: true, check: 'x' },
          ],
        },
      ],
      relationships: [],
    };
    expect(() => fromDrawDB(diagram)).not.toThrow();
    const res = fromDrawDB(diagram);
    expect(res.tables).toHaveLength(1);
    expect(res.tables[0]?.name).toBe('users');
  });

  it('skips corrupt table and column entries with warnings', () => {
    const res = fromDrawDB({
      tables: [
        null,
        { id: 'bad-no-name', fields: [] },
        {
          id: 't-ok',
          name: 'ok',
          fields: [null, { id: 'f-noname', type: 'TEXT' }, { id: 'f-good', name: 'good', type: 'TEXT' }],
        },
      ],
      relationships: [null],
    });
    expect(res.tables).toHaveLength(1);
    expect(res.tables[0]?.columns).toHaveLength(1);
    expect(res.tables[0]?.columns[0]?.name).toBe('good');
    expect(res.warnings.length).toBeGreaterThanOrEqual(4);
  });

  it('truncates over-limit names, types and defaults with warnings', () => {
    const res = fromDrawDB({
      tables: [
        {
          id: 't1',
          name: 'a'.repeat(400),
          fields: [
            { id: 'f1', name: 'b'.repeat(350), type: 'c'.repeat(150), default: 'd'.repeat(600) },
          ],
        },
      ],
      relationships: [],
    });
    expect(res.tables).toHaveLength(1);
    expect(res.tables[0]?.name.length).toBe(FE_LIMITS.TABLE_NAME);
    expect(res.tables[0]?.columns[0]?.name.length).toBe(FE_LIMITS.COLUMN_NAME);
    expect(res.tables[0]?.columns[0]?.type.length).toBe(FE_LIMITS.COLUMN_TYPE);
    expect(res.tables[0]?.columns[0]?.default?.length).toBe(FE_LIMITS.COLUMN_DEFAULT);
    expect(res.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('defaults missing/unknown cardinality to 1:N', () => {
    const res = fromDrawDB({
      tables: [
        { id: 't1', name: 'a', fields: [{ id: 'f1', name: 'id', type: 'UUID' }] },
        { id: 't2', name: 'b', fields: [{ id: 'f2', name: 'a_id', type: 'UUID' }] },
      ],
      relationships: [
        { startTableId: 't2', startFieldId: 'f2', endTableId: 't1', endFieldId: 'f1' },
        { startTableId: 't2', startFieldId: 'f2', endTableId: 't1', endFieldId: 'f1', cardinality: '1:1' },
        { startTableId: 't2', startFieldId: 'f2', endTableId: 't1', endFieldId: 'f1', cardinality: 'N:M' },
        { startTableId: 't2', startFieldId: 'f2', endTableId: 't1', endFieldId: 'f1', cardinality: 'weird-value' },
      ],
    });
    expect(res.relations.map((r) => r.cardinality)).toEqual(['1:N', '1:1', 'N:M', '1:N']);
  });

  it('defaults onDelete to restrict unless clearly cascade/setNull', () => {
    const res = fromDrawDB({
      tables: [
        { id: 't1', name: 'a', fields: [{ id: 'f1', name: 'id', type: 'UUID' }] },
        { id: 't2', name: 'b', fields: [{ id: 'f2', name: 'a_id', type: 'UUID' }] },
      ],
      relationships: [
        { startTableId: 't2', startFieldId: 'f2', endTableId: 't1', endFieldId: 'f1' },
        { startTableId: 't2', startFieldId: 'f2', endTableId: 't1', endFieldId: 'f1', onDelete: 'cascade' },
        { startTableId: 't2', startFieldId: 'f2', endTableId: 't1', endFieldId: 'f1', deleteConstraint: 'SET NULL' },
        { startTableId: 't2', startFieldId: 'f2', endTableId: 't1', endFieldId: 'f1', onDelete: 'no action' },
      ],
    });
    expect(res.relations.map((r) => r.onDelete)).toEqual(['restrict', 'cascade', 'setNull', 'restrict']);
  });

  it('skips orphan refs with a warning but keeps valid ones', () => {
    const res = fromDrawDB({
      tables: [
        { id: 't1', name: 'a', fields: [{ id: 'f1', name: 'id', type: 'UUID' }] },
        { id: 't2', name: 'b', fields: [{ id: 'f2', name: 'a_id', type: 'UUID' }] },
      ],
      relationships: [
        { startTableId: 't2', startFieldId: 'f2', endTableId: 't1', endFieldId: 'f1', cardinality: '1:N' },
        { startTableId: 'missing', startFieldId: 'nope', endTableId: 't1', endFieldId: 'f1' },
        { startTableId: 't2', startFieldId: 'ghost', endTableId: 't1', endFieldId: 'f1' },
      ],
    });
    expect(res.relations).toHaveLength(1);
    expect(res.warnings.some((w) => w.toLowerCase().includes('orphan'))).toBe(true);
  });

  it('supports both relationships and refs arrays', () => {
    const res = fromDrawDB({
      tables: [
        { id: 't1', name: 'a', fields: [{ id: 'f1', name: 'id', type: 'UUID' }] },
        { id: 't2', name: 'b', fields: [{ id: 'f2', name: 'a_id', type: 'UUID' }] },
        { id: 't3', name: 'c', fields: [{ id: 'f3', name: 'a_id', type: 'UUID' }] },
      ],
      relationships: [{ startTableId: 't2', startFieldId: 'f2', endTableId: 't1', endFieldId: 'f1' }],
      refs: [{ startTableId: 't3', startFieldId: 'f3', endTableId: 't1', endFieldId: 'f1', cardinality: '1:1' }],
    });
    expect(res.relations).toHaveLength(2);
    expect(res.warnings).toEqual([]);
  });
});

describe('toDrawDB', () => {
  it('emits a minimal symmetric structure that round-trips the core subset', () => {
    const users = makeDevTable('11111111-1111-4111-8111-111111111111', 'users', [
      { name: 'id', type: 'UUID', nullable: false, primaryKey: true },
      { name: 'email', type: 'TEXT', nullable: false },
    ]);
    const posts = makeDevTable('22222222-2222-4222-8222-222222222222', 'posts', [
      { name: 'id', type: 'UUID', nullable: false, primaryKey: true },
      { name: 'author_id', type: 'UUID', nullable: true },
    ]);
    const rel: Relation = {
      id: '33333333-3333-4333-8333-333333333333',
      createdAt: NOW,
      updatedAt: NOW,
      fromTableId: posts.id,
      fromColumnId: posts.columns[1]?.id ?? '',
      toTableId: users.id,
      toColumnId: users.columns[0]?.id ?? '',
      cardinality: '1:N',
      onDelete: 'cascade',
    };
    const diagram = toDrawDB([users, posts], [rel]);
    expect(Array.isArray(diagram.tables)).toBe(true);
    expect(Array.isArray(diagram.relationships)).toBe(true);

    const back = fromDrawDB(diagram as unknown);
    expect(back.warnings).toEqual([]);
    expect(back.tables).toHaveLength(2);
    expect(back.relations).toHaveLength(1);
    const backUsers = back.tables.find((t) => t.name === 'users');
    expect(backUsers?.columns.find((c) => c.name === 'email')?.type).toBe('TEXT');
    expect(backUsers?.columns.find((c) => c.name === 'id')?.primaryKey).toBe(true);
    const backRel = back.relations[0];
    expect(backRel?.cardinality).toBe('1:N');
    expect(backRel?.onDelete).toBe('cascade');
    // Endpoints still point at the matching columns by name.
    const byName = new Map(back.tables.flatMap((t) => t.columns.map((c) => [`${t.name}.${c.name}`, c.id])));
    expect(backRel?.fromColumnId).toBe(byName.get('posts.author_id'));
    expect(backRel?.toColumnId).toBe(byName.get('users.id'));
  });
});
