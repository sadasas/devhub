import { describe, expect, it } from 'vitest';
import { serializeERD } from './erd-export';
import type { Column, Relation, Table } from '../../lib/types';

const NOW = '2026-08-01T00:00:00.000Z';

function makeColumn(over: Partial<Column> = {}): Column {
  return {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
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
    fromTableId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    fromColumnId: '22222222-2222-4222-8222-222222222222',
    toTableId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    toColumnId: '11111111-1111-4111-8111-111111111111',
    cardinality: '1:N',
    onDelete: 'cascade',
    ...over,
  };
}

const USERS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORDERS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_USER_ID = '22222222-2222-4222-8222-222222222222';

describe('serializeERD', () => {
  it('serializes an empty schema to a minimal standalone SVG (bounds 0 + margin 32)', () => {
    const svg = serializeERD([], []);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="-32 -32 64 64"');
    expect(svg).toContain('width="64"');
    expect(svg).toContain('height="64"');
    expect(svg).toContain('font-family=');
    expect(svg).not.toContain('<polyline');
    expect(svg).not.toContain('<circle');
  });

  it('serializes one table with ERD-faithful geometry (TABLE_W 208, HEADER_H 30, ROW_H 20, margin 32)', () => {
    const users = makeTable(USERS, 'users', {
      columns: [
        makeColumn({ id: USER_ID, name: 'id', type: 'UUID', primaryKey: true, nullable: false }),
        makeColumn({
          id: 'aaaaaaaa-0000-4aaa-8aaa-aaaaaaaaaaa1',
          name: 'email',
          type: 'TEXT',
          primaryKey: false,
          nullable: false,
        }),
      ],
    });
    const svg = serializeERD([users], []);
    // h = 30 + 2*20 + 14 = 84 → bounds (16,16,208,84) → viewBox (-16,-16,272,148)
    expect(svg).toContain('viewBox="-16 -16 272 148"');
    expect(svg).toContain('width="272"');
    expect(svg).toContain('height="148"');
    // title + columns name/type, PK dot only for the PK column
    expect(svg).toContain('<title>users</title>');
    expect(svg).toContain('>users</text>');
    expect(svg).toContain('>email</text>');
    expect(svg).toContain('>UUID</text>');
    expect(svg).toContain('>TEXT</text>');
    const circles = svg.match(/<circle/g) ?? [];
    expect(circles.length).toBe(1);
    expect(svg).toContain('transform="translate(16,16)"');
  });

  it('renders relations as orthogonal polylines with cardinality and skips orphans', () => {
    const users = makeTable(USERS, 'users', {
      columns: [makeColumn({ id: USER_ID, name: 'id', type: 'UUID' })],
    });
    const orders = makeTable(ORDERS, 'orders', {
      columns: [
        makeColumn({ id: ORDER_USER_ID, name: 'user_id', type: 'UUID', primaryKey: false, nullable: true }),
      ],
    });
    const orphan = makeRelation({
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      fromTableId: 'missing-table',
      fromColumnId: 'missing-col',
    });
    const svg = serializeERD([users, orders], [makeRelation(), orphan]);
    // valid relation only: from orders (x=16+208+48=272 edge) col 0 → fy=16+10+30=56? colY=30+0*20+10=40 → fy=16+40=56
    // to users (x=16) col 0 → ty=56; mx=(480+16)/2=248
    expect(svg).toContain('<polyline points="480,56 248,56 248,56 16,56"');
    expect(svg).toContain('>1:N</text>');
    expect(svg.match(/<polyline/g)?.length).toBe(1);
  });

  it('honors snapshots: serializes exactly the tables/relations passed (no global state)', () => {
    const live = makeTable(USERS, 'live_orders');
    const snap = makeTable('99999999-9999-4999-8999-999999999999', 'snap_users');
    const svg = serializeERD([snap], []);
    expect(svg).toContain('snap_users');
    expect(svg).not.toContain('live_orders');
    expect(live.name).toBe('live_orders');
  });

  it('truncates long names like ERD.tsx and escapes XML entities', () => {
    const nasty = makeTable(USERS, 'a_very_long_table_name_over_24_chars&<>"\'', {
      columns: [
        makeColumn({
          id: USER_ID,
          name: 'a_very_long_column_name_over_20',
          type: 'A_VERY_LONG_COLUMN_TYPE_OVER_16&<>',
        }),
      ],
    });
    const svg = serializeERD([nasty], []);
    expect(svg).toContain('…');
    expect(svg).not.toContain('&<>"');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&lt;');
    expect(svg).toContain('&gt;');
    expect(svg).toContain('&quot;');
  });

  it('lays out 5 tables in a 4+1 grid honoring row heights', () => {
    const tables = [0, 1, 2, 3, 4].map((i) =>
      makeTable(`00000000-0000-4000-8000-00000000000${i}`, `t${i}`, {
        columns:
          i === 0
            ? [
                makeColumn({ id: `10000000-0000-4000-8000-00000000000${i}`, name: 'id', type: 'UUID' }),
                makeColumn({
                  id: `20000000-0000-4000-8000-00000000000${i}`,
                  name: 'extra',
                  type: 'TEXT',
                  primaryKey: false,
                  nullable: true,
                }),
                makeColumn({
                  id: `30000000-0000-4000-8000-00000000000${i}`,
                  name: 'more',
                  type: 'TEXT',
                  primaryKey: false,
                  nullable: true,
                }),
              ]
            : [makeColumn({ id: `10000000-0000-4000-8000-00000000000${i}`, name: 'id', type: 'UUID' })],
      }),
    );
    const svg = serializeERD(tables, []);
    // row 0 height = max(30+3*20+14=104, 30+1*20+14=64) = 104; row 1 starts at 16+104+48=168
    expect(svg).toContain('transform="translate(16,16)"');
    expect(svg).toContain('transform="translate(784,16)"');
    expect(svg).toContain('transform="translate(16,168)"');
  });

  it('renders area boundaries (dashed + label) behind nodes; empty groups skipped', () => {
    const users = makeTable(USERS, 'users');
    const orders = makeTable(ORDERS, 'orders');
    const groups = [
      {
        id: 'gggggggg-gggg-4ggg-8ggg-gggggggggggg',
        createdAt: NOW,
        updatedAt: NOW,
        name: 'Billing',
        color: '#e8b955',
        tableIds: [USERS, ORDERS],
      },
      {
        id: 'hhhhhhhh-hhhh-4hhh-8hhh-hhhhhhhhhhhh',
        createdAt: NOW,
        updatedAt: NOW,
        name: 'Empty',
        color: null,
        tableIds: [],
      },
    ];
    const svg = serializeERD([users, orders], [], groups);
    expect(svg).toContain('stroke-dasharray="8 6"');
    expect(svg).toContain('fill="#e8b955"');
    expect(svg).toContain('>Billing</text>');
    expect(svg).toContain('paint-order="stroke"');
    expect(svg).not.toContain('>Empty</text>');
    // Tanpa groups: tidak ada boundary.
    expect(serializeERD([users, orders], [])).not.toContain('stroke-dasharray="8 6"');
  });
});
