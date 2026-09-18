/* DevHub DBML exporter (client-side, pure, zero-dep).
   Table[] + Relation[] -> DBML subset string.
   Subset: Enum { "a" "b" }, Table { col type [pk | not null | default | note] },
   Table indexes { col [unique] }, Ref: a.b > c.d.
   Urutan stabil: Enum (sort by name) -> Table (sort by name) -> Ref (sort by key).
   Kolom di dalam tabel mempertahankan urutan input (urutan kolom bermakna).
   Tidak pernah throw — input rusak di-skip, kegagalan tak terduga -> ''. */

import type { Relation, Table } from '../../lib/types';

function cmpStr(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sanitizeFragment(value: string): string {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s.slice(0, 40) || 'col';
}

function truncateIdent(name: string, max = 63): string {
  return name.length > max ? name.slice(0, max) : name;
}

/** Quote identifier DBML dengan `"` hanya bila perlu (spasi/dash/dll).
    Escape: backslash -> `\\`, double-quote -> `\"` (gaya JS-string,
    cocok untuk parser DBML berbasis JS). */
function dbmlIdent(name: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return name;
  return `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Escape isi string single-quote DBML: backslash, kutip, newline -> `\n`. */
function escapeSingle(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

/** Escape isi string double-quote DBML (nilai Enum). */
function escapeDouble(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

/** Parse tipe kolom enum -> daftar label, atau null bila bukan enum.
    Mendukung `enum('a','b')`, `ENUM("a", "b")`, dan `enum: a, b`.
    Ditulis ulang minimal di sini (ddl-export tidak boleh diubah). */
function parseEnumValues(rawType: string): string[] | null {
  const trimmed = (rawType ?? '').trim();
  if (trimmed === '') return null;
  const paren = trimmed.match(/^enum\s*\(([\s\S]*)\)$/i);
  if (paren) {
    const inner = (paren[1] ?? '').trim();
    if (inner === '') return null;
    const quoted: string[] = [];
    const re = /'((?:''|[^'])*)'|"((?:""|[^"])*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(inner)) !== null) {
      const single = m[1];
      const dbl = m[2];
      if (single !== undefined) quoted.push(single.replace(/''/g, "'"));
      else if (dbl !== undefined) quoted.push(dbl.replace(/""/g, '"'));
    }
    if (quoted.length > 0) return quoted;
    const bare = inner
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter((s) => s !== '');
    return bare.length > 0 ? bare : null;
  }
  const colon = trimmed.match(/^enum\s*:\s*(.+)$/i);
  if (colon) {
    const labels = (colon[1] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter((s) => s !== '');
    return labels.length > 0 ? labels : null;
  }
  return null;
}

/** Pecah string index DevHub -> { unique, expr }.
    Mendukung `unique:email` dan `unique email` (case-insensitive). */
function parseUniqueIndex(raw: string): { unique: boolean; expr: string } {
  const colon = raw.match(/^unique\s*:\s*(.+)$/i);
  if (colon) return { unique: true, expr: (colon[1] ?? '').trim() };
  const space = raw.match(/^unique\s+(.+)$/i);
  if (space) return { unique: true, expr: (space[1] ?? '').trim() };
  return { unique: false, expr: raw.trim() };
}

/** Format expression DEFAULT ke sintaks DBML.
    Keputusan quoting: numerik/boolean/NULL/fungsi (::/()/CURRENT_*) -> backtick
    expression; selain itu string single-quote dengan escape. Bare word seperti
    `active` diklasifikasikan sebagai string (bukan fungsi) agar tidak salah
    menjadi expression. Nilai yang sudah berquote (`...` / '...') dipertahankan. */
function formatDefaultExpr(raw: string): string {
  const t = (raw ?? '').trim();
  if (t === '') return '';
  if (t.startsWith('`') && t.endsWith('`') && t.length >= 2) return t;
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) return t;
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
    return `'${escapeSingle(t.slice(1, -1))}'`;
  }
  if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(t)) return `\`${t}\``;
  if (/^(true|false|null)$/i.test(t)) return `\`${t}\``;
  if (/[()]/.test(t)) return `\`${t.replace(/`/g, '')}\``;
  if (/::/.test(t)) return `\`${t.replace(/`/g, '')}\``;
  if (/^(current_timestamp|current_date|current_time|now|uuid_generate_v[14]|gen_random_uuid)\b/i.test(t)) {
    return `\`${t.replace(/`/g, '')}\``;
  }
  return `'${escapeSingle(t)}'`;
}

/** Format satu entri index DevHub ke expression DBML, atau null bila invalid.
    Single ident -> bare/quote; list koma semua-ident -> `(a, b)`; selain itu
    expression backtick. Menolak `;{}newline` agar output tak pernah rusak. */
function formatIndexExpr(expr: string): string | null {
  const t = (expr ?? '').trim();
  if (t === '') return null;
  if (t.includes(';') || t.includes('\n') || t.includes('\r') || t.includes('{') || t.includes('}')) {
    return null;
  }
  if (t.startsWith('`') && t.endsWith('`') && t.length >= 2) return t;
  if (t.includes(',')) {
    const parts = t
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (parts.length === 0) return null;
    if (parts.every((p) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(p))) {
      return `(${parts.map((p) => dbmlIdent(p)).join(', ')})`;
    }
    return `\`${t.replace(/`/g, '')}\``;
  }
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) return dbmlIdent(t);
  return `\`${t.replace(/`/g, '')}\``;
}

function sanitizeColumnType(raw: string): string {
  const t = (raw ?? '').trim();
  if (t === '') return 'text';
  if (t.includes(';') || t.includes('\n') || t.includes('\r') || t.includes('{') || t.includes('}')) {
    return 'text';
  }
  return t;
}

export function toDBML(tables: Table[], relations: Relation[]): string {
  try {
    const sorted = [...(tables ?? [])]
      .filter((t) => t && typeof t.name === 'string' && t.name.trim() !== '')
      .sort((a, b) => cmpStr(a.name, b.name) || cmpStr(a.id, b.id));

    const tableById = new Map(sorted.map((t) => [t.id, t]));
    const colsByTable = new Map<string, Map<string, string>>();
    for (const t of sorted) {
      const m = new Map<string, string>();
      for (const c of t.columns ?? []) {
        if (c && typeof c.name === 'string' && c.name.trim() !== '') m.set(c.id, c.name);
      }
      colsByTable.set(t.id, m);
    }

    // -- Enum registry (deterministik mengikuti urutan tabel/kolom) --
    const enums = new Map<string, string[]>();
    const colEnumType = new Map<string, string>();
    for (const t of sorted) {
      for (const c of t.columns ?? []) {
        if (!c || c.name.trim() === '' || !c.type) continue;
        const labels = parseEnumValues(c.type);
        if (!labels) continue;
        let base = `${sanitizeFragment(t.name)}_${sanitizeFragment(c.name)}_enum`;
        base = truncateIdent(base);
        let candidate = base;
        let n = 1;
        while (enums.has(candidate) && enums.get(candidate)?.join('\0') !== labels.join('\0')) {
          n += 1;
          const suffix = `_${n}`;
          candidate = base.slice(0, 63 - suffix.length) + suffix;
        }
        if (!enums.has(candidate)) enums.set(candidate, labels);
        colEnumType.set(`${t.id}.${c.id}`, candidate);
      }
    }

    const blocks: string[] = [];

    // -- Enum lebih dulu (dipakai oleh Table) --
    const enumNames = [...enums.keys()].sort(cmpStr);
    for (const name of enumNames) {
      const labels = enums.get(name) ?? [];
      const lines = [`Enum ${dbmlIdent(name)} {`];
      for (const label of labels) lines.push(`  "${escapeDouble(label)}"`);
      lines.push('}');
      blocks.push(lines.join('\n'));
    }

    // -- Table (kolom mempertahankan urutan input) --
    const validTables = sorted.filter((t) =>
      (t.columns ?? []).some((c) => c && c.name.trim() !== ''),
    );
    for (const t of validTables) {
      const lines: string[] = [`Table ${dbmlIdent(t.name)} {`];
      for (const c of t.columns ?? []) {
        if (!c || c.name.trim() === '') continue;
        const enumType = colEnumType.get(`${t.id}.${c.id}`);
        const dataType = enumType ? dbmlIdent(enumType) : sanitizeColumnType(c.type);
        const settings: string[] = [];
        // PK implisit not null di DBML — tulis [pk] saja, tanpa dobel [not null].
        if (c.primaryKey) {
          settings.push('pk');
        } else if (!c.nullable) {
          settings.push('not null');
        }
        if (c.autoincrement === true) settings.push('increment');
        // DevHub tak punya flag unique per kolom — uniqueness via indexes block.
        if (c.default != null && c.default.trim() !== '') {
          const expr = formatDefaultExpr(c.default);
          if (expr !== '') settings.push(`default: ${expr}`);
        }
        if (c.comment.trim() !== '') settings.push(`note: '${escapeSingle(c.comment.trim())}'`);
        lines.push(
          settings.length > 0
            ? `  ${dbmlIdent(c.name)} ${dataType} [${settings.join(', ')}]`
            : `  ${dbmlIdent(c.name)} ${dataType}`,
        );
      }
      if (t.comment.trim() !== '') {
        lines.push(`  Note: '${escapeSingle(t.comment.trim())}'`);
      }
      const idxEntries: string[] = [];
      for (const raw of t.indexes ?? []) {
        if (typeof raw !== 'string' || raw.trim() === '') continue;
        const { unique, expr } = parseUniqueIndex(raw);
        const formatted = formatIndexExpr(expr);
        if (!formatted) continue;
        idxEntries.push(unique ? `${formatted} [unique]` : formatted);
      }
      idxEntries.sort(cmpStr);
      if (idxEntries.length > 0) {
        lines.push('  indexes {');
        for (const entry of idxEntries) lines.push(`    ${entry}`);
        lines.push('  }');
      }
      lines.push('}');
      blocks.push(lines.join('\n'));
    }

    // -- Ref dasar saja (orphan di-skip), sort deterministik --
    const refRows: { key: string; line: string }[] = [];
    const rels = [...(relations ?? [])].sort((a, b) => cmpStr(a.id, b.id));
    for (const r of rels) {
      if (!r) continue;
      const fromTable = tableById.get(r.fromTableId);
      const toTable = tableById.get(r.toTableId);
      if (!fromTable || !toTable) continue;
      const fromCol = colsByTable.get(fromTable.id)?.get(r.fromColumnId);
      const toCol = colsByTable.get(toTable.id)?.get(r.toColumnId);
      if (!fromCol || !toCol) continue;
      if (fromTable.name.trim() === '' || toTable.name.trim() === '') continue;
      refRows.push({
        key: `${fromTable.name}\0${fromCol}\0${toTable.name}\0${toCol}\0${r.id}`,
        line: `Ref: ${dbmlIdent(fromTable.name)}.${dbmlIdent(fromCol)} > ${dbmlIdent(toTable.name)}.${dbmlIdent(toCol)}`,
      });
    }
    refRows.sort((a, b) => cmpStr(a.key, b.key));
    for (const row of refRows) blocks.push(row.line);

    if (blocks.length === 0) return '';
    return `${blocks.join('\n\n')}\n`;
  } catch {
    return '';
  }
}
