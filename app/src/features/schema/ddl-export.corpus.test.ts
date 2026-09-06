import { describe, expect, it } from 'vitest';
import { toPostgresDDL } from './ddl-export';
import type { Column, Relation, Table } from '../../lib/types';

const NOW = '2026-08-01T00:00:00.000Z';

/* Deterministic UUID helper: uid(101) -> 00000000-0000-4000-8000-000000000101 */
function uid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function col(idNum: number, name: string, type: string, over: Partial<Column> = {}): Column {
  return {
    id: uid(idNum),
    name,
    type,
    nullable: false,
    primaryKey: false,
    default: null,
    comment: '',
    ...over,
  };
}

function tbl(
  idNum: number,
  name: string,
  columns: Column[],
  over: Partial<Table> = {},
): Table {
  return {
    id: uid(idNum),
    createdAt: NOW,
    updatedAt: NOW,
    name,
    comment: '',
    columns,
    indexes: [],
    ...over,
  };
}

function rel(
  idNum: number,
  fromTableNum: number,
  fromColNum: number,
  toTableNum: number,
  toColNum: number,
  onDelete: Relation['onDelete'],
  cardinality: Relation['cardinality'] = '1:N',
): Relation {
  return {
    id: uid(idNum),
    createdAt: NOW,
    updatedAt: NOW,
    fromTableId: uid(fromTableNum),
    fromColumnId: uid(fromColNum),
    toTableId: uid(toTableNum),
    toColumnId: uid(toColNum),
    cardinality,
    onDelete,
  };
}

function statementsOf(ddl: string): string[] {
  return ddl
    .split('\n\n')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

interface DdlCounts {
  tables: number;
  types: number;
  indexes: number;
  fks: number;
  comments: number;
  statements: number;
}

/* Parse manual sederhana: hitung statement prefix (tanpa parser SQL penuh). */
function parseDDLCounts(ddl: string): DdlCounts {
  return {
    tables: (ddl.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length,
    types: (ddl.match(/CREATE TYPE IF NOT EXISTS/g) ?? []).length,
    indexes: (ddl.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS/g) ?? []).length,
    fks: (ddl.match(/ADD CONSTRAINT/g) ?? []).length,
    comments: (ddl.match(/COMMENT ON/g) ?? []).length,
    statements: statementsOf(ddl).length,
  };
}

/* Assert struktural bersama: tiap statement diakhiri `;`, tanpa bocoran
   `undefined`/lowercase-`null`, tanpa identifier kosong, tanpa `()` PK/FK kosong. */
function assertStructural(ddl: string): void {
  const stmts = statementsOf(ddl);
  expect(stmts.length).toBeGreaterThan(0);
  for (const s of stmts) {
    expect(s.endsWith(';')).toBe(true);
    expect(s).not.toMatch(/\bundefined\b/);
  }
  expect(ddl).not.toMatch(/\bnull\b/);
  expect(ddl).not.toContain('""');
  expect(ddl).not.toMatch(/PRIMARY KEY \(\s*\)/);
  expect(ddl).not.toMatch(/FOREIGN KEY \(\s*\)/);
}

function indexNamesOf(ddl: string): string[] {
  const out: string[] = [];
  const re = /CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (\S+) ON/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ddl)) !== null) {
    const raw = m[1] ?? '';
    out.push(raw.replace(/^"|"$/g, ''));
  }
  return out;
}

describe('ddl-export corpus (anomaly/edge)', () => {
  it('(1) 10-tabel realistic: users/orders/products/payments + enum status + composite PK memberships', () => {
    const users = tbl(101, 'users', [
      col(1001, 'id', 'UUID', { primaryKey: true }),
      col(1002, 'email', 'TEXT'),
      col(1003, 'created_at', 'TIMESTAMPTZ', { default: 'now()' }),
    ]);
    const teams = tbl(102, 'teams', [
      col(1101, 'id', 'UUID', { primaryKey: true }),
      col(1102, 'name', 'TEXT'),
    ]);
    const memberships = tbl(103, 'memberships', [
      col(1201, 'user_id', 'UUID', { primaryKey: true }),
      col(1202, 'team_id', 'UUID', { primaryKey: true }),
    ]);
    const categories = tbl(104, 'categories', [
      col(1301, 'id', 'UUID', { primaryKey: true }),
      col(1302, 'name', 'TEXT'),
    ]);
    const products = tbl(105, 'products', [
      col(1401, 'id', 'UUID', { primaryKey: true }),
      col(1402, 'category_id', 'UUID', { nullable: true }),
      col(1403, 'name', 'TEXT'),
      col(1404, 'price', 'NUMERIC(10,2)'),
      col(1405, 'status', "enum('active','archived')"),
    ]);
    const orders = tbl(106, 'orders', [
      col(1501, 'id', 'UUID', { primaryKey: true }),
      col(1502, 'user_id', 'UUID', { nullable: true }),
      col(1503, 'status', "enum('pending','paid','shipped','cancelled')"),
      col(1504, 'created_at', 'TIMESTAMPTZ', { default: 'now()' }),
    ]);
    const orderItems = tbl(107, 'order_items', [
      col(1601, 'id', 'UUID', { primaryKey: true }),
      col(1602, 'order_id', 'UUID', { nullable: true }),
      col(1603, 'product_id', 'UUID', { nullable: true }),
      col(1604, 'qty', 'INTEGER', { default: '1' }),
    ]);
    const payments = tbl(108, 'payments', [
      col(1701, 'id', 'UUID', { primaryKey: true }),
      col(1702, 'order_id', 'UUID', { nullable: true }),
      col(1703, 'status', "enum('pending','succeeded','failed')"),
      col(1704, 'amount', 'NUMERIC(12,2)'),
    ]);
    const shipments = tbl(109, 'shipments', [
      col(1801, 'id', 'UUID', { primaryKey: true }),
      col(1802, 'order_id', 'UUID', { nullable: true }),
      col(1803, 'tracking', 'TEXT', { nullable: true }),
    ]);
    const auditLogs = tbl(110, 'audit_logs', [
      col(1901, 'id', 'UUID', { primaryKey: true }),
      col(1902, 'actor_id', 'UUID', { nullable: true }),
      col(1903, 'action', 'TEXT'),
    ]);
    const tables = [
      users,
      teams,
      memberships,
      categories,
      products,
      orders,
      orderItems,
      payments,
      shipments,
      auditLogs,
    ];
    const relations = [
      rel(2001, 103, 1201, 101, 1001, 'cascade'),
      rel(2002, 103, 1202, 102, 1101, 'cascade'),
      rel(2003, 105, 1402, 104, 1301, 'restrict'),
      rel(2004, 106, 1502, 101, 1001, 'cascade'),
      rel(2005, 107, 1602, 106, 1501, 'cascade'),
      rel(2006, 107, 1603, 105, 1401, 'restrict'),
      rel(2007, 108, 1702, 106, 1501, 'cascade'),
      rel(2008, 109, 1802, 106, 1501, 'setNull'),
      rel(2009, 110, 1902, 101, 1001, 'setNull'),
    ];
    const ddl = toPostgresDDL(tables, relations);
    const counts = parseDDLCounts(ddl);
    expect(counts.tables).toBe(10);
    expect(counts.types).toBe(3);
    expect(counts.fks).toBe(9);
    expect(ddl).toContain('PRIMARY KEY (user_id, team_id)');
    expect(ddl).toContain("AS ENUM ('active', 'archived')");
    expect(ddl).toContain("AS ENUM ('pending', 'paid', 'shipped', 'cancelled')");
    expect(ddl).toContain("AS ENUM ('pending', 'succeeded', 'failed')");
    assertStructural(ddl);
  });

  it('(2) semua onDelete actions + N:M via join table', () => {
    const users = tbl(201, 'users', [col(2101, 'id', 'UUID', { primaryKey: true })]);
    const roles = tbl(202, 'roles', [
      col(2201, 'id', 'UUID', { primaryKey: true }),
      col(2202, 'name', 'TEXT'),
    ]);
    const userRoles = tbl(203, 'user_roles', [
      col(2301, 'user_id', 'UUID', { primaryKey: true }),
      col(2302, 'role_id', 'UUID', { primaryKey: true }),
    ]);
    const posts = tbl(204, 'posts', [
      col(2401, 'id', 'UUID', { primaryKey: true }),
      col(2402, 'author_id', 'UUID', { nullable: true }),
    ]);
    const ddl = toPostgresDDL(
      [users, roles, userRoles, posts],
      [
        rel(2501, 203, 2301, 201, 2101, 'cascade', 'N:M'),
        rel(2502, 203, 2302, 202, 2201, 'restrict', 'N:M'),
        rel(2503, 204, 2402, 201, 2101, 'setNull', '1:N'),
      ],
    );
    expect(ddl).toContain('ON DELETE CASCADE');
    expect(ddl).toContain('ON DELETE RESTRICT');
    expect(ddl).toContain('ON DELETE SET NULL');
    expect(ddl).toContain('PRIMARY KEY (user_id, role_id)');
    expect(parseDDLCounts(ddl).fks).toBe(3);
    expect(ddl).toContain('FOREIGN KEY (user_id) REFERENCES users (id)');
    expect(ddl).toContain('FOREIGN KEY (role_id) REFERENCES roles (id)');
    assertStructural(ddl);
  });

  it('(3) COMMENT ON table+column dipertahankan (termasuk escape kutip)', () => {
    const users = tbl(
      301,
      'users',
      [
        col(3101, 'id', 'UUID', { primaryKey: true }),
        col(3102, 'email', 'TEXT', { comment: 'Primary contact address' }),
      ],
      { comment: "Customer registry maintained by O'Brien team", indexes: ['email'] },
    );
    const orders = tbl(
      302,
      'orders',
      [
        col(3201, 'id', 'UUID', { primaryKey: true }),
        col(3202, 'total', 'INTEGER', { comment: 'Grand total in cents' }),
      ],
      { comment: 'Purchase header' },
    );
    const ddl = toPostgresDDL([users, orders], []);
    expect(ddl).toContain('COMMENT ON TABLE users IS');
    expect(ddl).toContain('COMMENT ON TABLE orders IS');
    expect(ddl).toContain('COMMENT ON COLUMN users.email IS');
    expect(ddl).toContain('COMMENT ON COLUMN orders.total IS');
    expect(ddl).toContain("O''Brien");
    expect(parseDDLCounts(ddl).comments).toBe(4);
    expect(ddl.indexOf('CREATE TABLE')).toBeLessThan(ddl.indexOf('COMMENT ON'));
    expect(ddl.indexOf('COMMENT ON')).toBeLessThan(ddl.indexOf('CREATE INDEX'));
    assertStructural(ddl);
  });

  it('(4) index unique: prefix vs plain + nama panjang >63 char di-truncate stabil', () => {
    const longTable = `t_${'a'.repeat(50)}`;
    const longCol = `e_${'b'.repeat(50)}`;
    expect(longTable.length).toBeLessThanOrEqual(63);
    const t = tbl(
      401,
      longTable,
      [
        col(4101, 'id', 'UUID', { primaryKey: true }),
        col(4102, 'email', 'TEXT'),
        col(4103, 'created_at', 'TIMESTAMPTZ', { nullable: true }),
        col(4104, longCol, 'TEXT', { nullable: true }),
      ],
      {
        indexes: [
          'created_at',
          'unique:email',
          `unique:${longCol}`,
          longCol,
          'email; DROP TABLE users',
          '',
          '   ',
        ],
      },
    );
    const ddl = toPostgresDDL([t], []);
    const uniqueCount = (ddl.match(/CREATE UNIQUE INDEX IF NOT EXISTS/g) ?? []).length;
    const plainCount = (ddl.match(/^CREATE INDEX IF NOT EXISTS/gm) ?? []).length;
    expect(uniqueCount).toBe(2);
    expect(plainCount).toBe(2);
    expect(parseDDLCounts(ddl).indexes).toBe(4);
    expect(ddl).not.toContain('DROP TABLE');
    const names = indexNamesOf(ddl);
    expect(names).toHaveLength(4);
    for (const n of names) expect(n.length).toBeLessThanOrEqual(63);
    expect(names.some((n) => n.length === 63)).toBe(true);
    const again = toPostgresDDL([t], []);
    expect(again).toBe(ddl);
    assertStructural(ddl);
  });

  it("(5) kolom default: now() / 'active' / NULL handling", () => {
    const t = tbl(501, 'users', [
      col(5101, 'id', 'UUID', { primaryKey: true }),
      col(5102, 'created_at', 'TIMESTAMPTZ', { default: 'now()' }),
      col(5103, 'status', 'TEXT', { default: "'active'" }),
      col(5104, 'nickname', 'TEXT', { nullable: true, default: null }),
      col(5105, 'bio', 'TEXT', { nullable: true, default: '' }),
      col(5106, 'note', 'TEXT', { nullable: true, default: '   ' }),
    ]);
    const ddl = toPostgresDDL([t], []);
    expect(ddl).toContain('created_at TIMESTAMPTZ NOT NULL DEFAULT now()');
    expect(ddl).toContain("DEFAULT 'active'");
    const lineFor = (name: string): string =>
      ddl.split('\n').find((l) => l.includes(name)) ?? '';
    expect(lineFor('nickname')).not.toContain('DEFAULT');
    expect(lineFor('bio')).not.toContain('DEFAULT');
    expect(lineFor('note')).not.toContain('DEFAULT');
    assertStructural(ddl);
  });

  it('(6) round-trip stabil + deterministik: count parser, 2x byte-identik, input acak tetap sort-by-name, yatim di-skip', () => {
    const alpha = tbl(601, 'alpha', [col(6101, 'id', 'UUID', { primaryKey: true })]);
    const beta = tbl(
      602,
      'beta',
      [
        col(6201, 'id', 'UUID', { primaryKey: true }),
        col(6202, 'alpha_id', 'UUID', { nullable: true }),
      ],
      { indexes: ['alpha_id'] },
    );
    const gamma = tbl(
      603,
      'gamma',
      [
        col(6301, 'id', 'UUID', { primaryKey: true }),
        col(6302, 'beta_id', 'UUID', { nullable: true }),
      ],
      { indexes: ['unique:beta_id'] },
    );
    const relations = [
      rel(6401, 602, 6202, 601, 6101, 'cascade'),
      rel(6402, 603, 6302, 602, 6201, 'restrict'),
    ];
    const orphan: Relation = {
      id: uid(6403),
      createdAt: NOW,
      updatedAt: NOW,
      fromTableId: uid(999001),
      fromColumnId: uid(999002),
      toTableId: uid(999003),
      toColumnId: uid(999004),
      cardinality: '1:N',
      onDelete: 'cascade',
    };
    const first = toPostgresDDL([alpha, beta, gamma], [...relations, orphan]);
    const counts = parseDDLCounts(first);
    expect(counts.tables).toBe(3);
    expect(counts.indexes).toBe(2);
    expect(counts.fks).toBe(2);
    expect(counts.statements).toBe(counts.tables + counts.types + counts.indexes + counts.comments + counts.fks);
    const second = toPostgresDDL([alpha, beta, gamma], [...relations, orphan]);
    expect(second).toBe(first);
    const shuffled = toPostgresDDL([gamma, alpha, beta], [relations[1]!, relations[0]!, orphan]);
    expect(shuffled).toBe(first);
    expect(first.indexOf('alpha')).toBeLessThan(first.indexOf('beta'));
    expect(first.indexOf('beta')).toBeLessThan(first.indexOf('gamma'));
    assertStructural(first);
  });
});
