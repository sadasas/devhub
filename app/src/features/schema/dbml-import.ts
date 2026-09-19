/* DevHub DBML import parser (client-side, pure, zero-dep, hand-rolled).
   Clean-room line/block parser — no DBML parser dependency (zero-dep proprietary).

   SUBSET DIDUKUNG:
   - Enum name { "a" "b" } (label double/single-quoted atau bare; trailing
     `[...]` per label diabaikan). Kolom bertipe nama enum -> `enum('a','b')`
     (round-trip dengan dbml-export).
   - Table name [as alias] { col type [settings], ... } + `Note: '...'` tabel.
     Settings kolom: pk / primary key, not null / null, unique (-> indexes
     `unique:<col>`), increment (integer saja, selain itu warn + abaikan),
     default: <bare | 'quoted' | `expr`>, note: '...', ref: <op> table.col
     [delete: x] (inline relation).
   - indexes { col [unique] / (a, b) [unique] / `expr` [unique] } di dalam Table
     (-> indexes[] DevHub: `col` / `unique:col` / `a, b` / `unique:a, b`).
   - Ref: a.b > c.d (satu baris) dan blok `Ref [name] { a.b > c.d }`.
     Operator: `>` / `<` -> 1:N (endpoint apa adanya; re-export menormalkan
     ke `>`), `-` -> 1:1, `<>` -> N:M. Setting `[delete: cascade|set null|
     restrict|no action]` didukung; unknown -> restrict + warning.
   - Komentar `//` dan block comment dihormati (quote-aware).

   EKSPLISIT-TIDAK-DIDUKUNG (warning `unsupported ... skipped` + skip):
   - TableGroup (DevHub memakai Areas sendiri), Project, Note top-level,
     table trailing settings (`Table t { ... } [headercolor: ...]`),
     non-unique index settings ([name]/[type] diabaikan diam-diam).
   - Ref/block tak-terparse -> warning `unparsable ... skipped` + skip.
   - TIDAK PERNAH throw (input kosong -> kosong + 0 warning).

   Catatan lexer: keyword case-insensitive; identifier `"quoted"` (escape `\"`
   dan `""`), dan unquoted didukung; string `'...'` dengan `\'` escape tidak
   pernah memecah block/line (penting untuk note/default). Backtick = ekspresi
   mentah (default/index). */

import { FE_LIMITS } from '../../lib/limits';
import type { OnDelete, Relation, RelationCardinality, Table } from '../../lib/types';
import { newId, nowIso } from '../../lib/utils';
import { canAutoincrement } from './column-helpers';

export interface DBMLWarning {
  line: number;
  message: string;
}

export interface DBMLImport {
  tables: Table[];
  relations: Relation[];
  warnings: DBMLWarning[];
}

// ---------------------------------------------------------------------------
// Small scanning helpers (all pure, no-throw by contract of callers)
// ---------------------------------------------------------------------------

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch);
}

/** Hapus komentar line (`//`) dan blok yang quote-aware.
    Newline dipertahankan agar nomor baris stabil. */
function stripComments(src: string): string {
  try {
    let out = '';
    let i = 0;
    let quote: "'" | '"' | '`' | null = null;
    while (i < src.length) {
      const ch = src[i]!;
      if (quote !== null) {
        out += ch;
        if (ch === '\\' && i + 1 < src.length) {
          out += src[i + 1];
          i += 2;
          continue;
        }
        if (ch === quote) quote = null;
        i += 1;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch;
        out += ch;
        i += 1;
        continue;
      }
      if (ch === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i += 1;
        continue;
      }
      if (ch === '/' && src[i + 1] === '*') {
        i += 2;
        while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') out += '\n';
          i += 1;
        }
        i += 2;
        continue;
      }
      out += ch;
      i += 1;
    }
    return out;
  } catch {
    return src;
  }
}

function skipWs(s: string, pos: number): number {
  let i = pos;
  while (i < s.length && /\s/.test(s[i]!)) i += 1;
  return i;
}

/** Baca word (letters/digits/_/$) di pos; null bila tak ada. */
function peekWord(s: string, pos: number): string | null {
  const i = skipWs(s, pos);
  let j = i;
  while (j < s.length && isWordChar(s[j]!)) j += 1;
  return j > i ? s.slice(i, j) : null;
}

/** Match keyword case-insensitive pada batas word; return posisi akhir atau null. */
function matchWordAt(s: string, pos: number, word: string): number | null {
  const i = skipWs(s, pos);
  if (s.slice(i, i + word.length).toLowerCase() !== word.toLowerCase()) return null;
  const after = i + word.length;
  if (after < s.length && isWordChar(s[after]!)) return null;
  return after;
}

/** Parse identifier: `"quoted"` (escape `\"` + `""`) atau bare word. */
function parseIdentAt(s: string, pos: number): { name: string; next: number } | null {
  try {
    let i = skipWs(s, pos);
    if (i >= s.length) return null;
    if (s[i] === '"') {
      let out = '';
      i += 1;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\' && i + 1 < s.length) {
          out += s[i + 1];
          i += 2;
          continue;
        }
        out += s[i];
        i += 1;
      }
      if (i >= s.length) return null;
      i += 1; // closing quote
      return { name: out.replace(/""/g, '"'), next: i };
    }
    let j = i;
    while (j < s.length && isWordChar(s[j]!)) j += 1;
    if (j === i) return null;
    return { name: s.slice(i, j), next: j };
  } catch {
    return null;
  }
}

/** Parse `a.b.c` (tiap part quoted/bare). */
function parseDottedIdents(s: string, pos: number): { parts: string[]; next: number } | null {
  try {
    const first = parseIdentAt(s, pos);
    if (!first || first.name === '') return null;
    const parts = [first.name];
    let i = skipWs(s, first.next);
    for (;;) {
      if (s[i] !== '.') break;
      const nxt = parseIdentAt(s, i + 1);
      if (!nxt || nxt.name === '') break;
      parts.push(nxt.name);
      i = skipWs(s, nxt.next);
    }
    return { parts, next: i };
  } catch {
    return null;
  }
}

/** Parse string `'...'` (escape `\'`, `\\`, `\n`, `\r`, `\t`) atau `"..."`. */
function parseQuotedAt(s: string, pos: number): { value: string; next: number } | null {
  try {
    let i = skipWs(s, pos);
    if (i >= s.length) return null;
    const q = s[i];
    if (q !== "'" && q !== '"') return null;
    i += 1;
    let out = '';
    while (i < s.length && s[i] !== q) {
      if (s[i] === '\\' && i + 1 < s.length) {
        const e = s[i + 1]!;
        if (e === 'n') out += '\n';
        else if (e === 'r') out += '\r';
        else if (e === 't') out += '\t';
        else out += e;
        i += 2;
        continue;
      }
      out += s[i];
      i += 1;
    }
    if (i >= s.length) return null;
    return { value: out, next: i + 1 };
  } catch {
    return null;
  }
}

/** Parse ekspresi backtick `` `...` `` (tanpa escape; tutup di backtick pertama). */
function parseBacktickAt(s: string, pos: number): { value: string; next: number } | null {
  try {
    let i = skipWs(s, pos);
    if (s[i] !== '`') return null;
    i += 1;
    const end = s.indexOf('`', i);
    if (end === -1) return null;
    return { value: s.slice(i, end), next: end + 1 };
  } catch {
    return null;
  }
}

/** Cari `{` penutup yang sepadan, quote-aware. -1 bila tak ada. */
function findMatchingBrace(s: string, openPos: number): number {
  try {
    let depth = 0;
    let quote: "'" | '"' | '`' | null = null;
    for (let i = openPos; i < s.length; i += 1) {
      const ch = s[i]!;
      if (quote !== null) {
        if (ch === '\\') {
          i += 1;
          continue;
        }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  } catch {
    return -1;
  }
}

/** Split isi blok indexes jadi baris: newline pada depth 0 (quote-aware).
    Entri DBML umumnya satu per baris; baris lalu di-split koma top-level
    (mendukung `indexes { a, b }` satu-baris). */
function splitIndexRows(s: string): string[] {
  const rows: string[] = [];
  try {
    let depth = 0;
    let quote: "'" | '"' | '`' | null = null;
    let cur = '';
    const flush = () => {
      if (cur.trim() !== '') rows.push(cur);
      cur = '';
    };
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i]!;
      if (quote !== null) {
        cur += ch;
        if (ch === '\\') {
          if (i + 1 < s.length) {
            cur += s[i + 1];
            i += 1;
          }
          continue;
        }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch;
        cur += ch;
        continue;
      }
      if (ch === '(' || ch === '[') depth += 1;
      else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
      if (ch === '\n' && depth === 0) {
        flush();
        continue;
      }
      cur += ch;
    }
    flush();
    return rows;
  } catch {
    return [s];
  }
}

/** Split top-level (kedalaman paren/bracket/brace 0, quote-aware) dengan koma. */
function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  try {
    let depth = 0;
    let quote: "'" | '"' | '`' | null = null;
    let cur = '';
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i]!;
      if (quote !== null) {
        cur += ch;
        if (ch === '\\') {
          if (i + 1 < s.length) {
            cur += s[i + 1];
            i += 1;
          }
          continue;
        }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch;
        cur += ch;
        continue;
      }
      if (ch === '(' || ch === '[' || ch === '{') depth += 1;
      else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) {
        out.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out;
  } catch {
    return [s];
  }
}

// ---------------------------------------------------------------------------
// Block splitter: teks bersih -> item top-level (blok ber-brace / one-liner)
// ---------------------------------------------------------------------------

interface RawItem {
  kind: 'block' | 'line';
  /** Keyword lower-case (table/enum/ref/tablegroup/project/note/lainnya). */
  word: string;
  /** Teks header setelah keyword s/d `{` (block) atau seluruh baris (line). */
  head: string;
  /** Isi dalam brace (block saja). */
  body: string;
  /** Nomor baris 1-indexed awal item. */
  line: number;
  /** Trailing `[...]` setelah `}` (block saja). */
  trail: string;
}

function lineOf(lineStarts: number[], pos: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  let ans = 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lineStarts[mid]! <= pos) {
      ans = mid + 1;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

function splitTopLevel(src: string): RawItem[] {
  const items: RawItem[] = [];
  try {
    const lineStarts: number[] = [0];
    for (let i = 0; i < src.length; i += 1) {
      if (src[i] === '\n') lineStarts.push(i + 1);
    }
    let i = skipWs(src, 0);
    while (i < src.length) {
      const startLine = lineOf(lineStarts, i);
      const word = peekWord(src, i);
      if (!word) {
        i += 1;
        continue;
      }
      const afterWord = skipWs(src, i) + word.length;
      // One-liner Ref:/Note: (baca s/d akhir baris — string tak mengandung newline literal).
      if ((word.toLowerCase() === 'ref' || word.toLowerCase() === 'note') && src[afterWord] === ':') {
        let eol = src.indexOf('\n', afterWord);
        if (eol === -1) eol = src.length;
        items.push({ kind: 'line', word: word.toLowerCase(), head: src.slice(afterWord + 1, eol), body: '', line: startLine, trail: '' });
        i = skipWs(src, eol + 1);
        continue;
      }
      // Blok: cari `{` di baris logis yang sama (sebelum newline berikutnya).
      let eol = src.indexOf('\n', afterWord);
      if (eol === -1) eol = src.length;
      const brace = src.indexOf('{', afterWord);
      if (brace !== -1 && brace < eol) {
        const close = findMatchingBrace(src, brace);
        if (close === -1) {
          items.push({ kind: 'block', word: word.toLowerCase(), head: src.slice(afterWord, brace), body: '', line: startLine, trail: '' });
          // Blok tak tertutup: sisa file dianggap bagian blok -> berhenti.
          break;
        }
        let t = skipWs(src, close + 1);
        let trail = '';
        if (src[t] === '[') {
          const tend = src.indexOf(']', t);
          trail = tend === -1 ? src.slice(t) : src.slice(t, tend + 1);
          t = tend === -1 ? src.length : tend + 1;
        }
        items.push({
          kind: 'block',
          word: word.toLowerCase(),
          head: src.slice(afterWord, brace),
          body: src.slice(brace + 1, close),
          line: startLine,
          trail: trail.trim(),
        });
        i = skipWs(src, t);
        continue;
      }
      // Baris tak dikenal: skip s/d EOL.
      items.push({ kind: 'line', word: word.toLowerCase(), head: src.slice(afterWord, eol), body: '', line: startLine, trail: '' });
      i = skipWs(src, eol + 1);
    }
    return items;
  } catch {
    return items;
  }
}

// ---------------------------------------------------------------------------
// Context + small builders (mirror ddl-import conventions)
// ---------------------------------------------------------------------------

interface PendingFk {
  fromTable: string;
  fromCol: string;
  toTable: string;
  toCol: string;
  cardinality: RelationCardinality;
  onDeleteRaw: string | null;
  line: number;
}

interface Ctx {
  now: string;
  warnings: DBMLWarning[];
  enums: Map<string, string[]>; // lower(name) -> labels
  tables: Table[];
  byLower: Map<string, Table>;
  tableLines: Map<string, number>; // tableId -> line
  pendingFks: PendingFk[];
}

function warn(ctx: Ctx, line: number, message: string): void {
  ctx.warnings.push({ line, message });
}

function truncateWithWarning(
  ctx: Ctx,
  line: number,
  value: string,
  max: number,
  what: string,
): { value: string; truncated: boolean } {
  if (value.length <= max) return { value, truncated: false };
  warn(ctx, line, `${what} truncated to ${max} chars`);
  return { value: value.slice(0, max), truncated: true };
}

function normalizeOnDelete(raw: string | null): { value: OnDelete; unknown: boolean } {
  if (raw === null) return { value: 'restrict', unknown: false };
  const t = raw.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (t === 'cascade') return { value: 'cascade', unknown: false };
  if (t === 'set null') return { value: 'setNull', unknown: false };
  if (t === 'restrict' || t === 'no action') return { value: 'restrict', unknown: false };
  return { value: 'restrict', unknown: true };
}

function escapeEnumLabel(label: string): string {
  return `'${label.replace(/'/g, "''")}'`;
}

function enumTypeString(labels: string[]): string {
  return `enum(${labels.map(escapeEnumLabel).join(', ')})`;
}

/** Parse sisi `table.col` (ambil 2 part terakhir; dukung quoted). */
function parseRefSide(s: string, pos: number): { table: string; col: string; next: number } | null {
  try {
    const dotted = parseDottedIdents(s, pos);
    if (!dotted || dotted.parts.length < 2) return null;
    const col = dotted.parts[dotted.parts.length - 1]!;
    const table = dotted.parts[dotted.parts.length - 2]!;
    if (table.trim() === '' || col.trim() === '') return null;
    return { table, col, next: dotted.next };
  } catch {
    return null;
  }
}

/** Parse isi Ref `kiri OP kanan [settings]`; null bila tak-terparse. */
function parseRefCore(
  text: string,
): { fromTable: string; fromCol: string; toTable: string; toCol: string; cardinality: RelationCardinality; onDeleteRaw: string | null } | null {
  try {
    let i = skipWs(text, 0);
    const left = parseRefSide(text, i);
    if (!left) return null;
    i = skipWs(text, left.next);
    let op = '';
    if (text.startsWith('<>', i)) op = '<>';
    else if (text[i] === '>' || text[i] === '<' || text[i] === '-') op = text[i]!;
    else return null;
    i = skipWs(text, i + op.length);
    const right = parseRefSide(text, i);
    if (!right) return null;
    i = skipWs(text, right.next);
    let onDeleteRaw: string | null = null;
    if (i < text.length) {
      const rest = text.slice(i).trim();
      // Setting `[delete: x, ...]` opsional; abaikan setting lain diam-diam.
      if (rest.startsWith('[') && rest.endsWith(']')) {
        for (const part of splitTopLevelCommas(rest.slice(1, -1))) {
          const kv = part.split(':');
          if (kv.length >= 2 && (kv[0] ?? '').trim().toLowerCase() === 'delete') {
            onDeleteRaw = kv.slice(1).join(':').trim();
          }
        }
      } else if (rest !== '') {
        return null;
      }
    }
    const cardinality: RelationCardinality = op === '-' ? '1:1' : op === '<>' ? 'N:M' : '1:N';
    return {
      fromTable: left.table,
      fromCol: left.col,
      toTable: right.table,
      toCol: right.col,
      cardinality,
      onDeleteRaw,
    };
  } catch {
    return null;
  }
}

/** Parse nilai `default:`: backtick -> mentah; quoted -> isi; bare -> token. */
function parseDefaultValue(s: string, pos: number): { value: string; next: number } | null {
  try {
    let i = skipWs(s, pos);
    if (i >= s.length) return null;
    if (s[i] === '`') return parseBacktickAt(s, i);
    if (s[i] === "'" || s[i] === '"') return parseQuotedAt(s, i);
    let j = i;
    while (j < s.length && !/\s/.test(s[j]!)) j += 1;
    if (j === i) return null;
    return { value: s.slice(i, j), next: j };
  } catch {
    return null;
  }
}

interface ParsedColumnDraft {
  name: string;
  rawType: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  increment: boolean;
  default: string | null;
  comment: string;
  inlineFk: { op: string; table: string; col: string; onDeleteRaw: string | null } | null;
}

/** Parse satu baris kolom `name type [settings]`. Null = baris khusus (Note/indexes) atau kosong. */
function parseColumnLine(line: string): ParsedColumnDraft | 'special' | null {
  try {
    const t = line.trim();
    if (t === '') return null;
    const lw = (peekWord(t, 0) ?? '').toLowerCase();
    if (lw === 'note' || lw === 'indexes') return 'special';
    // Nama kolom.
    let name = '';
    let i = 0;
    if (t[0] === '"') {
      const id = parseIdentAt(t, 0);
      if (!id) return null;
      name = id.name;
      i = id.next;
    } else {
      const m = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(t);
      if (!m) return null;
      name = m[0];
      i = m[0].length;
    }
    if (name.trim() === '') return null;
    i = skipWs(t, i);
    // Tipe: s/d `[` settings atau akhir baris.
    let typeEnd = t.length;
    {
      let quote: "'" | '"' | '`' | null = null;
      let depth = 0;
      for (let k = i; k < t.length; k += 1) {
        const ch = t[k]!;
        if (quote !== null) {
          if (ch === '\\') {
            k += 1;
            continue;
          }
          if (ch === quote) quote = null;
          continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') {
          quote = ch;
          continue;
        }
        if (ch === '(') depth += 1;
        else if (ch === ')') depth = Math.max(0, depth - 1);
        if (ch === '[' && depth === 0) {
          typeEnd = k;
          break;
        }
      }
    }
    const rawType = t.slice(i, typeEnd).trim();
    const draft: ParsedColumnDraft = {
      name,
      rawType,
      nullable: true,
      primaryKey: false,
      unique: false,
      increment: false,
      default: null,
      comment: '',
      inlineFk: null,
    };
    // Settings `[...]`.
    const rest = t.slice(typeEnd).trim();
    if (rest !== '') {
      if (!rest.startsWith('[') || !rest.endsWith(']')) return null;
      for (const raw of splitTopLevelCommas(rest.slice(1, -1))) {
        const part = raw.trim();
        if (part === '') continue;
        const keyM = /^([A-Za-z][A-Za-z ]*)\s*:?/.exec(part);
        const key = (keyM?.[1] ?? part).trim().toLowerCase().replace(/\s+/g, ' ');
        if (key === 'pk' || key === 'primary key') {
          draft.primaryKey = true;
          continue;
        }
        if (key === 'not null') {
          draft.nullable = false;
          continue;
        }
        if (key === 'null') {
          draft.nullable = true;
          continue;
        }
        if (key === 'unique') {
          draft.unique = true;
          continue;
        }
        if (key === 'increment') {
          draft.increment = true;
          continue;
        }
        if (key === 'default') {
          const dv = parseDefaultValue(part, keyM?.[0]?.length ?? part.length);
          if (dv) draft.default = dv.value;
          continue;
        }
        if (key === 'note') {
          const q = parseQuotedAt(part, keyM?.[0]?.length ?? part.length);
          draft.comment = q ? q.value : part.slice(keyM?.[0]?.length ?? part.length).trim();
          continue;
        }
        if (key === 'ref') {
          const rt = part.slice(keyM?.[0]?.length ?? part.length).trim();
          const opM = /^(<>|>|<|-)\s*/.exec(rt);
          if (!opM) {
            draft.inlineFk = { op: '', table: '', col: '', onDeleteRaw: null };
            continue;
          }
          const side = parseRefSide(rt, opM[0].length);
          if (!side) {
            draft.inlineFk = { op: '', table: '', col: '', onDeleteRaw: null };
            continue;
          }
          let onDeleteRaw: string | null = null;
          const tail = rt.slice(skipWs(rt, side.next)).trim();
          if (tail !== '') {
            if (tail.startsWith('[') && tail.endsWith(']')) {
              for (const p of splitTopLevelCommas(tail.slice(1, -1))) {
                const kv = p.split(':');
                if (kv.length >= 2 && (kv[0] ?? '').trim().toLowerCase() === 'delete') {
                  onDeleteRaw = kv.slice(1).join(':').trim();
                }
              }
            }
          }
          draft.inlineFk = { op: opM[1]!, table: side.table, col: side.col, onDeleteRaw };
          continue;
        }
        // Sampai sini = setting tak dikenal (yang dikenal semuanya `continue`).
        (draft as { unknownSetting?: string }).unknownSetting = part;
      }
    }
    return draft;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Block parsers
// ---------------------------------------------------------------------------

function parseEnumBlock(item: RawItem, ctx: Ctx): void {
  try {
    const head = item.head.trim();
    const id = parseIdentAt(head, 0);
    const name = id ? id.name : head.split(/\s+/)[0] ?? '';
    if (!name || name.trim() === '') {
      warn(ctx, item.line, 'unparsable Enum block skipped');
      return;
    }
    if (ctx.enums.has(name.toLowerCase())) {
      warn(ctx, item.line, `duplicate enum "${name}" skipped`);
      return;
    }
    const labels: string[] = [];
    const lines = item.body.split('\n');
    for (const raw of lines) {
      let t = raw.trim();
      if (t === '' || t.startsWith('//')) continue;
      // Setting per label `[note: ...]` — potong sebelum parse label.
      const lb = t.lastIndexOf('[');
      const rb = t.lastIndexOf(']');
      if (lb !== -1 && rb === t.length - 1) t = t.slice(0, lb).trim();
      if (t === '') continue;
      if (t.startsWith('`')) {
        const b = parseBacktickAt(t, 0);
        if (b && b.value.trim() !== '') labels.push(b.value.trim());
        continue;
      }
      const q = parseQuotedAt(t, 0);
      if (q) {
        if (q.value !== '') labels.push(q.value);
        continue;
      }
      const bare = t.split(/\s+/)[0] ?? '';
      if (bare !== '') labels.push(bare.replace(/^['"]|['"]$/g, ''));
    }
    const clean = labels.filter((l) => l !== '');
    if (clean.length === 0) {
      warn(ctx, item.line, `enum "${name}" has no values skipped`);
      return;
    }
    ctx.enums.set(name.toLowerCase(), clean);
  } catch {
    warn(ctx, item.line, 'unparsable Enum block skipped');
  }
}

function parseIndexEntry(
  entry: string,
  colsLower: Map<string, string>,
  line: number,
  ctx: Ctx,
): string | null {
  try {
    let t = entry.trim();
    if (t === '') return null;
    // Setting `[unique]` / `[name: ..., unique]` opsional di akhir.
    let unique = false;
    const lb = t.lastIndexOf('[');
    const rb = t.lastIndexOf(']');
    if (lb !== -1 && rb === t.length - 1) {
      const inner = t.slice(lb + 1, -1);
      for (const p of splitTopLevelCommas(inner)) {
        if (p.trim().toLowerCase() === 'unique') unique = true;
      }
      t = t.slice(0, lb).trim();
      if (t === '') return null;
    }
    // Ekspresi backtick -> mentah (tak tervalidasi kolom).
    if (t.startsWith('`') && t.endsWith('`') && t.length >= 2) {
      const expr = t.slice(1, -1).trim();
      if (expr === '' || /[;\n\r{}]/.test(expr)) return null;
      return unique ? `unique:${expr}` : expr;
    }
    // Komposit `(a, b)`.
    if (t.startsWith('(') && t.endsWith(')')) {
      const parts = splitTopLevelCommas(t.slice(1, -1))
        .map((s) => s.trim().replace(/^"|"$/g, ''))
        .filter((s) => s !== '');
      if (parts.length === 0) return null;
      const unknown = parts.filter((p) => !colsLower.has(p.toLowerCase()));
      if (unknown.length > 0) {
        warn(ctx, line, `index (${parts.join(', ')}) skipped (unknown column)`);
        return null;
      }
      const resolved = parts.map((p) => colsLower.get(p.toLowerCase())!);
      return unique ? `unique:${resolved.join(', ')}` : resolved.join(', ');
    }
    // Kolom tunggal.
    const bare = t.replace(/^"|"$/g, '');
    if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(bare)) {
      warn(ctx, line, `index "${t.slice(0, 30)}" skipped (invalid expression)`);
      return null;
    }
    const resolved = colsLower.get(bare.toLowerCase());
    if (!resolved) {
      warn(ctx, line, `index "${bare}" skipped (unknown column)`);
      return null;
    }
    return unique ? `unique:${resolved}` : resolved;
  } catch {
    return null;
  }
}

function parseTableBlock(item: RawItem, ctx: Ctx): void {
  try {
    // Header: `name [as alias]` (+ trailing `[...]` = table settings).
    const head = item.head.trim();
    const id = parseIdentAt(head, 0);
    if (!id || id.name.trim() === '') {
      warn(ctx, item.line, 'unparsable Table block skipped');
      return;
    }
    const rawTableName = id.name;
    let rest = head.slice(id.next).trim();
    if (rest !== '') {
      const asM = matchWordAt(head, id.next, 'as');
      if (asM !== null) {
        const alias = parseIdentAt(head, asM);
        rest = alias ? head.slice(alias.next).trim() : head.slice(asM).trim();
      }
      if (rest !== '') {
        warn(ctx, item.line, `unsupported table header "${rest.slice(0, 30)}" ignored`);
      }
    }
    if (item.trail !== '') {
      warn(ctx, item.line, `unsupported table settings ${item.trail.slice(0, 40)} skipped`);
    }
    if (ctx.byLower.has(rawTableName.toLowerCase())) {
      warn(ctx, item.line, `duplicate table "${rawTableName}" skipped`);
      return;
    }
    const tNameCapped = truncateWithWarning(ctx, item.line, rawTableName, FE_LIMITS.TABLE_NAME, `table "${rawTableName.slice(0, 30)}" name`);

    const table: Table = {
      id: newId(),
      createdAt: ctx.now,
      updatedAt: ctx.now,
      name: tNameCapped.value,
      comment: '',
      columns: [],
      indexes: [],
    };
    const colLower = new Map<string, string>(); // lower(name) -> name (capped)
    const inlineFks: Array<{ fromCol: string; op: string; table: string; col: string; onDeleteRaw: string | null; line: number }> = [];
    const bodyLines = item.body.split('\n');
    let row = 0;
    while (row < bodyLines.length) {
      const rawLine = bodyLines[row]!;
      const lineNo = item.line + 1 + row;
      const t = rawLine.trim();
      row += 1;
      if (t === '') continue;
      // Blok `indexes { ... }` (satu baris atau multi-baris).
      const idxWord = (peekWord(t, 0) ?? '').toLowerCase();
      if (idxWord === 'indexes') {
        const openRel = t.indexOf('{');
        if (openRel === -1) {
          warn(ctx, lineNo, 'unparsable indexes block skipped');
          continue;
        }
        let inner = t.slice(openRel + 1);
        let closed = inner.includes('}');
        while (!closed && row < bodyLines.length) {
          inner += `\n${bodyLines[row]}`;
          closed = (bodyLines[row] ?? '').includes('}');
          row += 1;
        }
        if (!closed) {
          warn(ctx, lineNo, 'unparsable indexes block skipped');
          continue;
        }
        inner = inner.slice(0, inner.lastIndexOf('}'));
        for (const row of splitIndexRows(inner)) {
          for (const part of splitTopLevelCommas(row)) {
            if (part.trim() === '') continue;
            const entry = parseIndexEntry(part, colLower, lineNo, ctx);
            if (entry === null) continue;
            const capped = truncateWithWarning(ctx, lineNo, entry, FE_LIMITS.INDEX, 'index');
            table.indexes.push(capped.value);
          }
        }
        continue;
      }
      // `Note: '...'` tabel.
      if (idxWord === 'note') {
        const afterNote = skipWs(t, (peekWord(t, 0) ?? '').length);
        if (t[afterNote] === ':') {
          const q = parseQuotedAt(t, afterNote + 1);
          const noteVal = q ? q.value : t.slice(afterNote + 1).trim();
          const capped = truncateWithWarning(ctx, lineNo, noteVal, FE_LIMITS.TABLE_COMMENT, `table "${tNameCapped.value}" comment`);
          table.comment = capped.value;
          table.updatedAt = ctx.now;
          continue;
        }
      }
      const draft = parseColumnLine(t);
      if (draft === null) {
        warn(ctx, lineNo, `unparsable column "${t.slice(0, 30)}" skipped`);
        continue;
      }
      if (draft === 'special') continue;
      const unk = (draft as { unknownSetting?: string }).unknownSetting;
      if (unk !== undefined) {
        warn(ctx, lineNo, `unknown column setting "${unk.slice(0, 40)}" ignored`);
      }
      if (colLower.has(draft.name.toLowerCase())) {
        warn(ctx, lineNo, `duplicate column "${draft.name}" skipped`);
        continue;
      }
      const nameCapped = truncateWithWarning(ctx, lineNo, draft.name, FE_LIMITS.COLUMN_NAME, `column "${draft.name.slice(0, 30)}" name`);
      let typeStr = draft.rawType === '' ? 'TEXT' : draft.rawType;
      const typeCapped = truncateWithWarning(ctx, lineNo, typeStr, FE_LIMITS.COLUMN_TYPE, `column "${nameCapped.value}" type`);
      let defCapped: string | null = null;
      if (draft.default !== null && draft.default !== '') {
        defCapped = truncateWithWarning(ctx, lineNo, draft.default, FE_LIMITS.COLUMN_DEFAULT, `column "${nameCapped.value}" default`).value;
      }
      const isPk = draft.primaryKey;
      // SERIAL -> basis integer + flag autoincrement (sama seperti ddl-import).
      const serialMatch = typeCapped.value.trim().match(/^(smallserial|serial|bigserial)(\s*\(.*\))?$/i);
      const serialBase =
        serialMatch != null
          ? ({ smallserial: 'SMALLINT', serial: 'INTEGER', bigserial: 'BIGINT' } as Record<string, string>)[
              serialMatch[1]!.toLowerCase()
            ]!
          : null;
      let autoincrement = serialBase != null;
      if (draft.increment && serialBase === null) {
        if (canAutoincrement(typeCapped.value)) {
          autoincrement = true;
        } else {
          warn(ctx, lineNo, `increment on non-integer column "${nameCapped.value}" ignored`);
        }
      }
      if (draft.increment && serialBase !== null) autoincrement = true;
      table.columns.push({
        id: newId(),
        name: nameCapped.value,
        type: serialBase ?? typeCapped.value,
        nullable: isPk ? false : draft.nullable,
        primaryKey: isPk,
        autoincrement,
        default: defCapped,
        comment:
          draft.comment !== ''
            ? truncateWithWarning(ctx, lineNo, draft.comment, FE_LIMITS.COLUMN_COMMENT, `column "${nameCapped.value}" comment`).value
            : '',
      });
      colLower.set(nameCapped.value.toLowerCase(), nameCapped.value);
      if (draft.unique) {
        const expr = `unique:${nameCapped.value}`;
        const capped = truncateWithWarning(ctx, lineNo, expr, FE_LIMITS.INDEX, 'index');
        table.indexes.push(capped.value);
      }
      if (draft.inlineFk) {
        const fk = draft.inlineFk;
        if (fk.op === '' || fk.table === '' || fk.col === '') {
          warn(ctx, lineNo, `unparsable ref on column "${nameCapped.value}" skipped`);
        } else {
          inlineFks.push({ fromCol: nameCapped.value, op: fk.op, table: fk.table, col: fk.col, onDeleteRaw: fk.onDeleteRaw, line: lineNo });
        }
      }
    }

    if (table.columns.length === 0) {
      warn(ctx, item.line, `table "${tNameCapped.value}" has no valid columns skipped`);
      return;
    }
    ctx.tables.push(table);
    ctx.byLower.set(table.name.toLowerCase(), table);
    ctx.tableLines.set(table.id, item.line);
    for (const fk of inlineFks) {
      ctx.pendingFks.push({
        fromTable: table.name,
        fromCol: fk.fromCol,
        toTable: fk.table,
        toCol: fk.col,
        cardinality: fk.op === '-' ? '1:1' : fk.op === '<>' ? 'N:M' : '1:N',
        onDeleteRaw: fk.onDeleteRaw,
        line: fk.line,
      });
    }
  } catch {
    warn(ctx, item.line, 'unparsable Table block skipped');
  }
}

function parseRefBlock(item: RawItem, ctx: Ctx): void {
  try {
    // `Ref [name] { kiri OP kanan }` — nama opsional, isi satu relasi.
    const refs = item.body
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (refs.length === 0) {
      warn(ctx, item.line, 'empty Ref block skipped');
      return;
    }
    if (refs.length > 1) {
      warn(ctx, item.line, `Ref block with ${refs.length} lines: only the first is imported`);
    }
    const core = parseRefCore(refs[0]!);
    if (!core) {
      warn(ctx, item.line, 'unparsable Ref block skipped');
      return;
    }
    ctx.pendingFks.push({ ...core, line: item.line });
  } catch {
    warn(ctx, item.line, 'unparsable Ref block skipped');
  }
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function fromDBML(input: string): DBMLImport {
  const warnings: DBMLWarning[] = [];
  try {
    if (typeof input !== 'string' || input.trim() === '') {
      return { tables: [], relations: [], warnings: [] };
    }
    const now = nowIso();
    const ctx: Ctx = {
      now,
      warnings,
      enums: new Map(),
      tables: [],
      byLower: new Map(),
      tableLines: new Map(),
      pendingFks: [],
    };

    let items: RawItem[];
    try {
      items = splitTopLevel(stripComments(input));
    } catch {
      return { tables: [], relations: [], warnings: [] };
    }
    if (items.length === 0) return { tables: [], relations: [], warnings: [] };

    for (const item of items) {
      try {
        if (item.kind === 'line' && (item.word === 'ref' || item.word === 'note')) {
          if (item.word === 'note') {
            warn(ctx, item.line, 'unsupported top-level Note skipped');
            continue;
          }
          const core = parseRefCore(item.head);
          if (!core) {
            warn(ctx, item.line, 'unparsable Ref skipped');
            continue;
          }
          ctx.pendingFks.push({ ...core, line: item.line });
          continue;
        }
        if (item.kind === 'block' && item.word === 'enum') {
          parseEnumBlock(item, ctx);
          continue;
        }
        if (item.kind === 'block' && item.word === 'table') {
          parseTableBlock(item, ctx);
          continue;
        }
        if (item.kind === 'block' && item.word === 'ref') {
          parseRefBlock(item, ctx);
          continue;
        }
        if (item.kind === 'block' && (item.word === 'tablegroup' || item.word === 'project')) {
          const label = item.word === 'tablegroup' ? 'TableGroup' : 'Project';
          warn(ctx, item.line, `unsupported ${label} skipped`);
          continue;
        }
        const label = item.word !== '' ? item.word : 'statement';
        warn(ctx, item.line, `unsupported ${label} skipped`);
      } catch {
        warn(ctx, item.line, 'unparsable statement skipped');
      }
    }

    // -- Phase 2: resolve enum-typed columns (mirror ddl-import) --
    try {
      for (const t of ctx.tables) {
        for (const c of t.columns) {
          const head = c.type.trim().split(/\s+/)[0] ?? '';
          const last = head.split('.').pop() ?? '';
          let unquoted = last;
          if (unquoted.length >= 2 && unquoted.startsWith('"') && unquoted.endsWith('"')) {
            unquoted = unquoted.slice(1, -1);
          }
          const key = unquoted.toLowerCase();
          if (key === '') continue;
          if (c.type.trim().toLowerCase().startsWith('enum(')) continue;
          const labels = ctx.enums.get(key);
          if (labels) {
            const expanded = enumTypeString(labels);
            const ownerLine = ctx.tableLines.get(t.id) ?? 1;
            c.type = truncateWithWarning(ctx, ownerLine, expanded, FE_LIMITS.COLUMN_TYPE, `column "${c.name}" type`).value;
          }
        }
      }
    } catch {
      // ignore enum resolution errors — keep raw types
    }

    // -- Phase 3: FK -> Relation resolution (mirror ddl-import phase 5) --
    const relations: Relation[] = [];
    const colMaps = new Map<string, Map<string, string>>(); // tableId -> lower(colName) -> colId
    for (const t of ctx.tables) {
      const m = new Map<string, string>();
      for (const c of t.columns) {
        const lk = c.name.toLowerCase();
        if (!m.has(lk)) m.set(lk, c.id);
      }
      colMaps.set(t.id, m);
    }
    for (const fk of ctx.pendingFks) {
      const fromT = ctx.byLower.get(fk.fromTable.toLowerCase());
      const toT = ctx.byLower.get(fk.toTable.toLowerCase());
      if (!fromT || !toT) {
        warn(ctx, fk.line, `ref "${fk.fromTable}.${fk.fromCol}" skipped (unknown table)`);
        continue;
      }
      const fromId = colMaps.get(fromT.id)?.get(fk.fromCol.toLowerCase());
      const toId = colMaps.get(toT.id)?.get(fk.toCol.toLowerCase());
      if (!fromId || !toId) {
        warn(ctx, fk.line, `ref "${fk.fromTable}.${fk.fromCol}" skipped (unknown column)`);
        continue;
      }
      const norm = normalizeOnDelete(fk.onDeleteRaw);
      if (norm.unknown) {
        warn(ctx, fk.line, `unknown delete action "${fk.onDeleteRaw}" defaulted to restrict`);
      }
      relations.push({
        id: newId(),
        createdAt: ctx.now,
        updatedAt: ctx.now,
        fromTableId: fromT.id,
        fromColumnId: fromId,
        toTableId: toT.id,
        toColumnId: toId,
        cardinality: fk.cardinality,
        onDelete: norm.value,
      });
    }

    return { tables: ctx.tables, relations, warnings: ctx.warnings };
  } catch {
    try {
      return { tables: [], relations: [], warnings };
    } catch {
      return { tables: [], relations: [], warnings: [] };
    }
  }
}
