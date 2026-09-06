import { describe, expect, it } from 'vitest';
import { fromDDL } from './ddl-import';
import { toPostgresDDL } from './ddl-export';
import type { Column, Relation, Table } from '../../lib/types';

const NOW = '2026-08-01T00:00:00.000Z';

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

function tbl(idNum: number, name: string, columns: Column[], over: Partial<Table> = {}): Table {
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

function tableByName(tables: Table[], name: string): Table {
  const t = tables.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!t) throw new Error(`table ${name} not found`);
  return t;
}

function columnByName(t: Table, name: string): Column {
  const c = t.columns.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!c) throw new Error(`column ${t.name}.${name} not found`);
  return c;
}

function relName(
  r: Relation,
  tables: Table[],
): { fromTable: string; fromCol: string; toTable: string; toCol: string } {
  const ft = tables.find((t) => t.id === r.fromTableId);
  const tt = tables.find((t) => t.id === r.toTableId);
  const fc = ft?.columns.find((c) => c.id === r.fromColumnId);
  const tc = tt?.columns.find((c) => c.id === r.toColumnId);
  return {
    fromTable: ft?.name ?? '?',
    fromCol: fc?.name ?? '?',
    toTable: tt?.name ?? '?',
    toCol: tc?.name ?? '?',
  };
}

/** Extract enum('a','b') labels (handles '' escape). */
function enumLabels(t: string): string[] | null {
  const m = t.trim().match(/^enum\s*\(([\s\S]*)\)$/i);
  if (!m) return null;
  const labels: string[] = [];
  const re = /'((?:''|[^'])*)'/g;
  let x: RegExpExecArray | null;
  const inner = m[1] ?? '';
  while ((x = re.exec(inner)) !== null) labels.push((x[1] ?? '').replace(/''/g, "'"));
  return labels;
}

describe('fromDDL basics', () => {
  it('empty/whitespace input yields empty result with zero warnings and never throws', () => {
    expect(fromDDL('')).toEqual({ tables: [], relations: [], warnings: [] });
    expect(fromDDL('   \n\t  \n')).toEqual({ tables: [], relations: [], warnings: [] });
    expect(fromDDL('-- only a comment\n/* block */')).toEqual({
      tables: [],
      relations: [],
      warnings: [],
    });
    expect(() => fromDDL(';;; ((())) ;;; garbage (((')).not.toThrow();
    const garbage = fromDDL(';;; ((())) ;;;');
    expect(garbage.tables).toEqual([]);
    expect(garbage.relations).toEqual([]);
  });

  it('parses a basic CREATE TABLE with types, nullability, defaults and single PK', () => {
    const got = fromDDL(
      `CREATE TABLE users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL,
        nickname TEXT NULL,
        age INTEGER DEFAULT 18,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
    );
    expect(got.warnings).toEqual([]);
    expect(got.tables).toHaveLength(1);
    const users = got.tables[0]!;
    expect(users.name).toBe('users');
    expect(users.columns.map((c) => c.name)).toEqual(['id', 'email', 'nickname', 'age', 'created_at']);
    expect(columnByName(users, 'id').primaryKey).toBe(true);
    expect(columnByName(users, 'id').nullable).toBe(false);
    expect(columnByName(users, 'email').nullable).toBe(false);
    expect(columnByName(users, 'nickname').nullable).toBe(true);
    expect(columnByName(users, 'age').default).toBe('18');
    expect(columnByName(users, 'created_at').default).toBe('now()');
    expect(columnByName(users, 'created_at').type).toBe('TIMESTAMPTZ');
    // Fresh ids + timestamps.
    const ids = new Set([users.id, ...users.columns.map((c) => c.id)]);
    expect(ids.size).toBe(6);
    expect(typeof users.createdAt).toBe('string');
  });

  it('is case-insensitive and supports IF NOT EXISTS, composite PK, schema qualification', () => {
    const got = fromDDL(
      `create table if not exists public.memberships (
        USER_ID uuid not null,
        team_id UUID NOT NULL,
        primary key (user_id, TEAM_ID)
      );`,
    );
    expect(got.warnings).toEqual([]);
    expect(got.tables).toHaveLength(1);
    const t = got.tables[0]!;
    expect(t.name).toBe('memberships');
    expect(columnByName(t, 'user_id').primaryKey).toBe(true);
    expect(columnByName(t, 'team_id').primaryKey).toBe(true);
    expect(columnByName(t, 'user_id').nullable).toBe(false);
  });

  it('parses parameterized and multi-word types without splitting them', () => {
    const got = fromDDL(
      `CREATE TABLE demo (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price NUMERIC(10, 2) NOT NULL DEFAULT 0,
        window TIMESTAMP WITH TIME ZONE NULL,
        score DOUBLE PRECISION DEFAULT 1.5,
        tags TEXT[] NULL
      );`,
    );
    expect(got.warnings).toEqual([]);
    const t = got.tables[0]!;
    expect(columnByName(t, 'name').type).toBe('VARCHAR(255)');
    expect(columnByName(t, 'price').type).toBe('NUMERIC(10, 2)');
    expect(columnByName(t, 'price').default).toBe('0');
    expect(columnByName(t, 'window').type).toBe('TIMESTAMP WITH TIME ZONE');
    expect(columnByName(t, 'window').nullable).toBe(true);
    expect(columnByName(t, 'score').type).toBe('DOUBLE PRECISION');
    expect(columnByName(t, 'tags').type).toBe('TEXT[]');
  });
});

describe('fromDDL foreign keys', () => {
  it('supports inline FOREIGN KEY, column-level REFERENCES and ON DELETE variants', () => {
    const got = fromDDL(
      `CREATE TABLE users (id UUID PRIMARY KEY);
       CREATE TABLE posts (
         id UUID PRIMARY KEY,
         author_id UUID REFERENCES users (id) ON DELETE CASCADE,
         editor_id UUID REFERENCES users (id) ON DELETE SET NULL,
         FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE RESTRICT
       );
       CREATE TABLE likes (
         id UUID PRIMARY KEY,
         post_id UUID REFERENCES posts (id) ON DELETE NO ACTION,
         user_id UUID REFERENCES users (id)
       );`,
    );
    expect(got.warnings).toEqual([]);
    expect(got.relations).toHaveLength(5);
    const actions = got.relations.map((r) => r.onDelete).sort();
    expect(actions).toEqual(['cascade', 'restrict', 'restrict', 'restrict', 'setNull']);
    for (const r of got.relations) expect(r.cardinality).toBe('1:N');
  });

  it('maps unknown ON DELETE to restrict plus a warning', () => {
    const got = fromDDL(
      `CREATE TABLE a (id UUID PRIMARY KEY);
       CREATE TABLE b (id UUID PRIMARY KEY, a_id UUID REFERENCES a (id) ON DELETE SET DEFAULT);`,
    );
    expect(got.relations).toHaveLength(1);
    expect(got.relations[0]!.onDelete).toBe('restrict');
    expect(got.warnings).toHaveLength(1);
    expect(got.warnings[0]!.message).toMatch(/ON DELETE/i);
  });

  it('supports ALTER TABLE ADD CONSTRAINT FOREIGN KEY with and without a constraint name', () => {
    const got = fromDDL(
      `CREATE TABLE users (id UUID PRIMARY KEY);
       CREATE TABLE orders (id UUID PRIMARY KEY, user_id UUID NULL);
       ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
       ALTER TABLE orders ADD FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL;`,
    );
    // Two ALTERs on the same pair intentionally yield two relations (no dedup).
    expect(got.relations).toHaveLength(2);
    expect(got.relations.map((r) => r.onDelete).sort()).toEqual(['cascade', 'setNull']);
    expect(got.warnings).toEqual([]);
  });

  it('skips orphan foreign keys (unknown table/column) with warnings', () => {
    const inline = fromDDL(
      `CREATE TABLE posts (id UUID PRIMARY KEY, user_id UUID REFERENCES users (id));`,
    );
    expect(inline.relations).toEqual([]);
    expect(inline.warnings).toHaveLength(1);
    expect(inline.warnings[0]!.message).toMatch(/skipped/);

    const alter = fromDDL(
      `CREATE TABLE posts (id UUID PRIMARY KEY, user_id UUID NULL);
       ALTER TABLE posts ADD FOREIGN KEY (user_id) REFERENCES users (missing_col);`,
    );
    expect(alter.relations).toEqual([]);
    expect(alter.warnings).toHaveLength(1);

    const alterUnknownTable = fromDDL(
      `ALTER TABLE ghost ADD FOREIGN KEY (a) REFERENCES also_ghost (b);`,
    );
    expect(alterUnknownTable.relations).toEqual([]);
    expect(alterUnknownTable.warnings).toHaveLength(1);
  });
});

describe('fromDDL enums, indexes, comments', () => {
  it('resolves CREATE TYPE AS ENUM for columns using the type name (either order)', () => {
    const before = fromDDL(
      `CREATE TYPE mood AS ENUM ('happy', 'sad');
       CREATE TABLE t (id UUID PRIMARY KEY, m mood NOT NULL);`,
    );
    expect(before.warnings).toEqual([]);
    expect(enumLabels(columnByName(before.tables[0]!, 'm').type)).toEqual(['happy', 'sad']);

    const after = fromDDL(
      `CREATE TABLE t (id UUID PRIMARY KEY, m mood NOT NULL);
       CREATE TYPE IF NOT EXISTS mood AS ENUM ('happy', 'sad');`,
    );
    expect(after.warnings).toEqual([]);
    expect(enumLabels(columnByName(after.tables[0]!, 'm').type)).toEqual(['happy', 'sad']);
  });

  it('accepts double-quoted enum labels and inline ENUM(...) column types', () => {
    const got = fromDDL(
      `CREATE TYPE t2 AS ENUM ("a", "b");
       CREATE TABLE m (id UUID PRIMARY KEY, s ENUM('x','y') NOT NULL, k t2 NULL);`,
    );
    expect(got.warnings).toEqual([]);
    const t = got.tables[0]!;
    expect(enumLabels(columnByName(t, 's').type)).toEqual(['x', 'y']);
    expect(enumLabels(columnByName(t, 'k').type)).toEqual(['a', 'b']);
  });

  it('maps inline UNIQUE (column + composite table) to table.indexes', () => {
    const got = fromDDL(
      `CREATE TABLE users (id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE);
       CREATE TABLE memberships (
         user_id UUID NOT NULL,
         team_id UUID NOT NULL,
         PRIMARY KEY (user_id, team_id),
         UNIQUE (user_id, team_id)
       );`,
    );
    expect(got.warnings).toEqual([]);
    expect(tableByName(got.tables, 'users').indexes).toEqual(['unique:email']);
    expect(tableByName(got.tables, 'memberships').indexes).toEqual(['unique:user_id, team_id']);
  });

  it('parses CREATE [UNIQUE] INDEX incl. IF NOT EXISTS, USING, composite and nameless', () => {
    const got = fromDDL(
      `CREATE TABLE users (id UUID PRIMARY KEY, email TEXT NOT NULL, age INTEGER NULL);
       CREATE INDEX idx_users_email ON users (email);
       CREATE UNIQUE INDEX IF NOT EXISTS uq ON users (email);
       CREATE INDEX comp ON users USING btree (email, age);
       CREATE INDEX ON users (age);`,
    );
    expect(got.warnings).toEqual([]);
    expect(tableByName(got.tables, 'users').indexes).toEqual([
      'email',
      'unique:email',
      'email, age',
      'age',
    ]);
  });

  it('applies COMMENT ON TABLE/COLUMN with quote-escape and IS NULL support', () => {
    const got = fromDDL(
      `CREATE TABLE users (id UUID PRIMARY KEY, email TEXT NOT NULL);
       COMMENT ON TABLE users IS 'Customer registry';
       COMMENT ON COLUMN users.email IS 'Primary contact';
       COMMENT ON TABLE users IS 'O''Brien team';
       CREATE TABLE t2 (id UUID PRIMARY KEY);
       COMMENT ON TABLE t2 IS NULL;`,
    );
    expect(got.warnings).toEqual([]);
    expect(tableByName(got.tables, 'users').comment).toBe("O'Brien team");
    expect(columnByName(tableByName(got.tables, 'users'), 'email').comment).toBe('Primary contact');
    expect(tableByName(got.tables, 't2').comment).toBe('');
  });

  it('warns on COMMENT for unknown tables/columns and skips them', () => {
    const got = fromDDL(
      `CREATE TABLE t (id UUID PRIMARY KEY);
       COMMENT ON TABLE ghost IS 'x';
       COMMENT ON COLUMN t.missing IS 'y';`,
    );
    expect(got.tables).toHaveLength(1);
    expect(got.warnings).toHaveLength(2);
    for (const w of got.warnings) expect(w.message).toMatch(/skipped/);
  });

  it('ignores inline COMMENT honestly with a warning and keeps the column', () => {
    const got = fromDDL(
      `CREATE TABLE t (id UUID PRIMARY KEY, name TEXT COMMENT 'hello');`,
    );
    expect(got.tables).toHaveLength(1);
    expect(got.tables[0]!.columns).toHaveLength(2);
    expect(columnByName(got.tables[0]!, 'name').comment).toBe('');
    expect(got.warnings).toHaveLength(1);
    expect(got.warnings[0]!.message).toMatch(/COMMENT/i);
  });
});

describe('fromDDL identifiers and strings', () => {
  it('supports double-quoted, backtick and bracket identifiers', () => {
    const got = fromDDL(
      `CREATE TABLE "my table" ("id" UUID PRIMARY KEY, "weird-col" TEXT NOT NULL);
       CREATE TABLE \`t2\` (\`c\` TEXT);
       CREATE TABLE [t3] ([c c] TEXT);
       ALTER TABLE "my table" ADD CONSTRAINT "fk x" FOREIGN KEY ("weird-col") REFERENCES "my table" ("id") ON DELETE CASCADE;`,
    );
    expect(got.warnings).toEqual([]);
    expect(got.tables.map((t) => t.name).sort()).toEqual(['my table', 't2', 't3']);
    expect(tableByName(got.tables, 'my table').columns.map((c) => c.name).sort()).toEqual([
      'id',
      'weird-col',
    ]);
    expect(tableByName(got.tables, 't3').columns[0]!.name).toBe('c c');
    expect(got.relations).toHaveLength(1);
    expect(got.relations[0]!.onDelete).toBe('cascade');
  });

  it('never splits inside string literals: escapes, semicolons and E-strings', () => {
    const got = fromDDL(
      `CREATE TABLE t (
        id UUID PRIMARY KEY,
        nick TEXT NOT NULL DEFAULT 'O''Brien',
        s TEXT NOT NULL DEFAULT 'a;b',
        e TEXT NOT NULL DEFAULT E'c\\;d'
      );`,
    );
    expect(got.warnings).toEqual([]);
    const t = got.tables[0]!;
    expect(columnByName(t, 'nick').default).toBe("'O''Brien'");
    expect(columnByName(t, 's').default).toBe("'a;b'");
    expect(columnByName(t, 'e').default).toBe("E'c\\;d'");

    const en = fromDDL(`CREATE TYPE mood AS ENUM ('hap''py', 'sad');`);
    expect(en.warnings).toEqual([]);
  });
});

describe('fromDDL unsupported, unparsable, duplicates, limits', () => {
  it('warns once per unsupported statement and skips it', () => {
    const got = fromDDL(
      `CREATE TABLE t (id UUID PRIMARY KEY);
       CREATE VIEW v AS SELECT 1;
       CREATE TRIGGER trg BEFORE INSERT ON t FOR EACH ROW EXECUTE FUNCTION f();
       DROP TABLE t;
       INSERT INTO t VALUES (1);
       GRANT SELECT ON t TO PUBLIC;
       CREATE POLICY p ON t FOR SELECT USING (true);
       ALTER TABLE t ENABLE ROW LEVEL SECURITY;
       CREATE FUNCTION f() RETURNS void AS $$ BEGIN RAISE NOTICE 'a;b'; END; $$ LANGUAGE plpgsql;`,
    );
    expect(got.tables).toHaveLength(1);
    expect(got.relations).toEqual([]);
    // 8 unsupported statements (the dollar-quoted function body counts as ONE).
    expect(got.warnings).toHaveLength(8);
    for (const w of got.warnings) {
      expect(w.message).toMatch(/unsupported/i);
      expect(w.message).toMatch(/skipped/);
    }
  });

  it('warns and skips partition children; warns-but-keeps PARTITION BY tables', () => {
    const child = fromDDL(
      `CREATE TABLE parent (id UUID PRIMARY KEY);
       CREATE TABLE child PARTITION OF parent FOR VALUES FROM (1) TO (10);`,
    );
    expect(child.tables).toHaveLength(1);
    expect(child.warnings).toHaveLength(1);
    expect(child.warnings[0]!.message).toMatch(/partition/i);

    const by = fromDDL(`CREATE TABLE p (id UUID PRIMARY KEY) PARTITION BY RANGE (id);`);
    expect(by.tables).toHaveLength(1);
    expect(by.warnings).toHaveLength(1);
    expect(by.warnings[0]!.message).toMatch(/partition/i);
  });

  it('warns and skips unparsable statements without throwing', () => {
    const got = fromDDL(`CREATE TABLE;`);
    expect(got.tables).toEqual([]);
    expect(got.warnings).toHaveLength(1);
    expect(got.warnings[0]!.message).toMatch(/unparsable/i);

    const badParen = fromDDL(`CREATE TABLE t (((;`);
    expect(badParen.tables).toEqual([]);
    expect(badParen.warnings).toHaveLength(1);

    const badIndex = fromDDL(`CREATE INDEX;`);
    expect(badIndex.tables).toEqual([]);
    expect(badIndex.warnings).toHaveLength(1);
  });

  it('skips tables without valid columns with a warning', () => {
    const empty = fromDDL(`CREATE TABLE empty ();`);
    expect(empty.tables).toEqual([]);
    expect(empty.warnings).toHaveLength(1);
    expect(empty.warnings[0]!.message).toMatch(/no valid columns/);

    const noBody = fromDDL(`CREATE TABLE nobody;`);
    expect(noBody.tables).toEqual([]);
    expect(noBody.warnings).toHaveLength(1);
  });

  it('skips duplicate table names case-insensitively with a warning', () => {
    const got = fromDDL(
      `CREATE TABLE users (id UUID PRIMARY KEY);
       CREATE TABLE USERS (id UUID PRIMARY KEY, extra TEXT);`,
    );
    expect(got.tables).toHaveLength(1);
    expect(got.tables[0]!.columns).toHaveLength(1);
    expect(got.warnings).toHaveLength(1);
    expect(got.warnings[0]!.message).toMatch(/duplicate/i);
  });

  it('reports the starting line of each statement', () => {
    const got = fromDDL(
      `-- leading comment
CREATE TABLE users (
  id UUID PRIMARY KEY
);
CREATE VIEW v AS SELECT 1;`,
    );
    expect(got.tables).toHaveLength(1);
    expect(got.warnings).toHaveLength(1);
    expect(got.warnings[0]!.line).toBe(5);
  });

  it('truncates over-limit values and warns honestly', () => {
    const long = 'x'.repeat(2500);
    const got = fromDDL(
      `CREATE TABLE users (id UUID PRIMARY KEY);
       COMMENT ON TABLE users IS '${long}';`,
    );
    expect(tableByName(got.tables, 'users').comment).toHaveLength(2000);
    expect(got.warnings).toHaveLength(1);
    expect(got.warnings[0]!.message).toMatch(/truncated/);
  });
});

describe('fromDDL round-trip', () => {
  it('round-trips toPostgresDDL output on 6 tables with enums, comments, indexes and all FK actions', () => {
    const users = tbl(
      101,
      'users',
      [
        col(1001, 'id', 'UUID', { primaryKey: true }),
        col(1002, 'email', 'TEXT'),
        col(1003, 'status', "enum('active','archived')"),
        col(1004, 'created_at', 'TIMESTAMPTZ', { default: 'now()' }),
      ],
      {
        comment: "Customer registry maintained by O'Brien team",
        indexes: ['created_at', 'unique:email'],
      },
    );
    // Column comment survives the trip.
    users.columns[1]!.comment = 'Primary contact address';
    const teams = tbl(102, 'teams', [
      col(1101, 'id', 'UUID', { primaryKey: true }),
      col(1102, 'name', 'TEXT'),
    ]);
    const memberships = tbl(103, 'memberships', [
      col(1201, 'user_id', 'UUID', { primaryKey: true }),
      col(1202, 'team_id', 'UUID', { primaryKey: true }),
    ]);
    const products = tbl(105, 'products', [
      col(1401, 'id', 'UUID', { primaryKey: true }),
      col(1403, 'name', 'TEXT'),
      col(1404, 'price', 'NUMERIC(10,2)'),
      col(1405, 'status', "enum('draft','live')"),
    ]);
    const orders = tbl(106, 'orders', [
      col(1501, 'id', 'UUID', { primaryKey: true }),
      col(1502, 'user_id', 'UUID', { nullable: true }),
      col(1503, 'status', "enum('pending','paid')"),
    ]);
    const orderItems = tbl(107, 'order_items', [
      col(1601, 'id', 'UUID', { primaryKey: true }),
      col(1602, 'order_id', 'UUID', { nullable: true }),
      col(1603, 'product_id', 'UUID', { nullable: true }),
      col(1604, 'qty', 'INTEGER', { default: '1' }),
    ]);
    const tables = [users, teams, memberships, products, orders, orderItems];
    const mkRel = (
      n: number,
      fromT: number,
      fromC: number,
      toT: number,
      toC: number,
      onDelete: Relation['onDelete'],
    ): Relation => ({
      id: uid(n),
      createdAt: NOW,
      updatedAt: NOW,
      fromTableId: uid(fromT),
      fromColumnId: uid(fromC),
      toTableId: uid(toT),
      toColumnId: uid(toC),
      cardinality: '1:N',
      onDelete,
    });
    const relations = [
      mkRel(2001, 103, 1201, 101, 1001, 'cascade'),
      mkRel(2002, 103, 1202, 102, 1101, 'cascade'),
      mkRel(2003, 106, 1502, 101, 1001, 'setNull'),
      mkRel(2004, 107, 1602, 106, 1501, 'cascade'),
      mkRel(2005, 107, 1603, 105, 1401, 'restrict'),
    ];

    const ddl = toPostgresDDL(tables, relations);
    expect(ddl).toContain('CREATE TABLE');
    const got = fromDDL(ddl);

    // The exporter output is fully inside the supported subset: no warnings.
    expect(got.warnings).toEqual([]);
    expect(got.tables.map((t) => t.name).sort()).toEqual(
      tables.map((t) => t.name).sort(),
    );

    for (const want of tables) {
      const have = tableByName(got.tables, want.name);
      expect(have.columns.map((c) => c.name).sort()).toEqual(
        want.columns.map((c) => c.name).sort(),
      );
      expect(have.columns.filter((c) => c.primaryKey).map((c) => c.name).sort()).toEqual(
        want.columns.filter((c) => c.primaryKey).map((c) => c.name).sort(),
      );
      expect(have.comment).toBe(want.comment);
      for (const wc of want.columns) {
        const hc = columnByName(have, wc.name);
        // Exporter forces PK columns to NOT NULL (`!nullable || primaryKey`).
        expect(hc.nullable).toBe(wc.primaryKey ? false : wc.nullable);
        expect(hc.default ?? null).toBe(wc.default ?? null);
        expect(hc.comment).toBe(wc.comment);
        const wantEnum = enumLabels(wc.type);
        const haveEnum = enumLabels(hc.type);
        if (wantEnum) expect(haveEnum).toEqual(wantEnum);
        else expect(hc.type).toBe(wc.type);
      }
      expect([...have.indexes].sort()).toEqual([...want.indexes].sort());
    }

    expect(got.relations).toHaveLength(relations.length);
    const sig = (t: Table[], r: Relation): string => {
      const n = relName(r, t);
      return `${n.fromTable}.${n.fromCol}->${n.toTable}.${n.toCol}:${r.onDelete}`;
    };
    expect(got.relations.map((r) => sig(got.tables, r)).sort()).toEqual(
      relations
        .map((r) => {
          const ft = tables.find((t) => t.id === r.fromTableId)!;
          const tt = tables.find((t) => t.id === r.toTableId)!;
          const fc = ft.columns.find((c) => c.id === r.fromColumnId)!;
          const tc = tt.columns.find((c) => c.id === r.toColumnId)!;
          return `${ft.name}.${fc.name}->${tt.name}.${tc.name}:${r.onDelete}`;
        })
        .sort(),
    );

    // Re-exporting the import is stable (byte-identical on second pass).
    const ddl2 = toPostgresDDL(got.tables, got.relations);
    const got2 = fromDDL(ddl2);
    expect(got2.warnings).toEqual([]);
    expect(got2.tables.map((t) => t.name).sort()).toEqual(
      got.tables.map((t) => t.name).sort(),
    );
    expect(got2.relations).toHaveLength(got.relations.length);
  });
});
