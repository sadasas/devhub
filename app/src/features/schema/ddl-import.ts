/* DevHub DDL import parser (client-side, pure, zero-dep, hand-rolled).
   Clean-room tokenizer + parser — no SQL parser dependency (zero-dep proprietary).

   SUBSET DIDUKUNG:
   - CREATE TABLE [IF NOT EXISTS] name (col defs, inline PRIMARY KEY (a,b),
     inline FOREIGN KEY (c) REFERENCES t(c) [ON DELETE x], inline UNIQUE,
     col-level REFERENCES t(c), NOT NULL / NULL, DEFAULT expr,
     CONSTRAINT name prefix on table constraints)
   - CREATE TYPE [IF NOT EXISTS] name AS ENUM ('a','b',...) (labels single/double
     quoted; bare labels fallback). Kolom bertipe nama enum → `enum('a','b')`.
     Inline column type ENUM('a','b') (MySQL-style) juga diterima.
   - CREATE [UNIQUE] INDEX [IF NOT EXISTS] name ON table (cols/exprs)
     [USING method] (USING di-skip; WHERE predicate diabaikan)
   - ALTER TABLE t ADD [CONSTRAINT [name]] FOREIGN KEY (c) REFERENCES t2(c2)
     [ON DELETE x] [ON UPDATE y (ignored)]
   - COMMENT ON TABLE t IS '...' / COMMENT ON COLUMN t.c IS '...' (IS NULL → '')

   EKSPLISIT-TIDAK-DIDUKUNG (warning `unsupported ... skipped` + skip, 1 per statement):
   - VIEW (CREATE VIEW / MATERIALIZED VIEW), TRIGGER, FUNCTION / PROCEDURE,
     PL/pgSQL bodies (dollar-quoted $...$ dipertahankan sebagai 1 statement agar
     `;` di dalam body tidak pecah), PARTITION (PARTITION BY / FOR VALUES /
     ATTACH/DETACH), RLS (ROW LEVEL SECURITY / POLICY / ENABLE RLS),
     DROP / INSERT / UPDATE / DELETE / GRANT / REVOKE / COPY / transaction
     (BEGIN/COMMIT), CHECK global, EXCLUDE, DOMAIN, SEQUENCE, EXTENSION,
     SCHEMA/CREATE DATABASE, dan ALTER TABLE non-FK (ADD COLUMN, ADD PRIMARY KEY,
     OWNER TO, dsb).
   - Inline COMMENT ('COMMENT ...' di definisi kolom) diabaikan-jujur + warning
     (Postgres resmi memakai COMMENT ON terpisah; sintaks inline gaya MySQL
     tidak dipertahankan).
   - CHECK (...) / COLLATE / GENERATED ... / DEFERRABLE / constraint lain
     diabaikan diam-diam (SKIP tanpa warning — jangan over-engineer grammar).
   - Composite FOREIGN KEY (N kolom) di-expand pairwise bila jumlah kolom
     from/to sama; bila beda → skip + warning.
   - Statement tak-terparse → warning `unparsable ... skipped` + skip.
   - TIDAK PERNAH throw (input kosong → kosong + 0 warning).

   Catatan tokenizer: keyword case-insensitive; identifier `"quoted"` ("" escape),
   `` `backtick` `` (`` escape), `[bracket]` (]] escape), dan unquoted didukung;
   string literal `'...'` dengan `''` escape tidak pernah memecah statement/
   comma-split (penting untuk DEFAULT/ENUM/COMMENT). Komentar line `--` dan
   komentar blok dihormati saat split maupun parse. */

import { FE_LIMITS } from '../../lib/limits';
import type { OnDelete, Relation, Table } from '../../lib/types';
import { newId, nowIso } from '../../lib/utils';

export interface DDLWarning {
  line: number;
  message: string;
}

export interface DDLImport {
  tables: Table[];
  relations: Relation[];
  warnings: DDLWarning[];
}

// ---------------------------------------------------------------------------
// Small scanning helpers (all pure, no-throw by contract of callers)
// ---------------------------------------------------------------------------

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch);
}

function skipWsAndComments(s: string, pos: number): number {
  let i = pos;
  const n = s.length;
  while (i < n) {
    const ch = s[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === '\f' || ch === '\v') {
      i += 1;
      continue;
    }
    if (ch === '-' && s[i + 1] === '-') {
      i += 2;
      while (i < n && s[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && s[i + 1] === '*') {
      i += 2;
      while (i < n && !(s[i] === '*' && s[i + 1] === '/')) i += 1;
      if (i < n) i += 2;
      continue;
    }
    break;
  }
  return i;
}

/** Match a single keyword word at pos (after optional ws/comments already skipped by caller stays exact). */
function matchWordAt(s: string, pos: number, word: string): number | null {
  if (s.slice(pos, pos + word.length).toLowerCase() !== word.toLowerCase()) return null;
  const after = s[pos + word.length];
  if (after !== undefined && isWordChar(after)) return null;
  return pos + word.length;
}

/** Match phrase like "IF NOT EXISTS" (words separated by ws/comments). Returns end pos or null. */
function matchPhrase(s: string, pos: number, words: string[]): number | null {
  let i = skipWsAndComments(s, pos);
  for (const w of words) {
    const m = matchWordAt(s, i, w);
    if (m === null) return null;
    i = skipWsAndComments(s, m);
  }
  return i;
}

function peekWord(s: string, pos: number): string | null {
  const i = skipWsAndComments(s, pos);
  const m = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(s.slice(i));
  return m ? m[0] : null;
}

interface IdentOut {
  name: string;
  next: number;
}

/** Parse one identifier (quoted/backtick/bracket/unquoted) at pos (skips leading ws/comments). */
function parseIdentAt(s: string, pos: number): IdentOut | null {
  let i = skipWsAndComments(s, pos);
  if (i >= s.length) return null;
  const ch = s[i]!;
  if (ch === '"') {
    let out = '';
    i += 1;
    while (i < s.length) {
      const c = s[i]!;
      if (c === '"') {
        if (s[i + 1] === '"') {
          out += '"';
          i += 2;
          continue;
        }
        i += 1;
        return { name: out, next: i };
      }
      out += c;
      i += 1;
    }
    return null; // unterminated
  }
  if (ch === '`') {
    let out = '';
    i += 1;
    while (i < s.length) {
      const c = s[i]!;
      if (c === '`') {
        if (s[i + 1] === '`') {
          out += '`';
          i += 2;
          continue;
        }
        i += 1;
        return { name: out, next: i };
      }
      out += c;
      i += 1;
    }
    return null;
  }
  if (ch === '[') {
    let out = '';
    i += 1;
    while (i < s.length) {
      const c = s[i]!;
      if (c === ']') {
        if (s[i + 1] === ']') {
          out += ']';
          i += 2;
          continue;
        }
        i += 1;
        return { name: out, next: i };
      }
      out += c;
      i += 1;
    }
    return null;
  }
  const m = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(s.slice(i));
  if (!m) return null;
  return { name: m[0], next: i + m[0].length };
}

/** Parse dotted identifier chain; returns parts. */
function parseDottedIdents(s: string, pos: number): { parts: string[]; next: number } | null {
  const first = parseIdentAt(s, pos);
  if (!first) return null;
  const parts = [first.name];
  let i = first.next;
  for (;;) {
    const j = skipWsAndComments(s, i);
    if (s[j] !== '.') break;
    const k = skipWsAndComments(s, j + 1);
    const nxt = parseIdentAt(s, k);
    if (!nxt) break; // trailing dot — stop, leave dot unconsumed
    parts.push(nxt.name);
    i = nxt.next;
  }
  return { parts, next: i };
}

interface StrOut {
  value: string;
  next: number;
}

/** Parse single-quoted string literal at pos (skips leading ws/comments). Handles '' escape.
    Also accepts E'...' prefix (backslash escapes unescaped: \\ → \, \' → ', '' → '). */
function parseStringLiteralAt(s: string, pos: number): StrOut | null {
  let i = skipWsAndComments(s, pos);
  let escaped = false;
  if ((s[i] === 'E' || s[i] === 'e') && s[i + 1] === "'") {
    if (i > 0 && isWordChar(s[i - 1] ?? '')) {
      // Not an E-string prefix (part of a longer word) — fall through to standard check.
    } else {
      escaped = true;
      i += 1;
    }
  }
  if (s[i] !== "'") return null;
  let out = '';
  let j = i + 1;
  while (j < s.length) {
    const c = s[j] ?? '';
    if (escaped && c === '\\' && j + 1 < s.length) {
      const nxt = s[j + 1] ?? '';
      out += nxt === "'" || nxt === '\\' ? nxt : `\\${nxt}`;
      j += 2;
      continue;
    }
    if (c === "'") {
      if (s[j + 1] === "'") {
        out += "'";
        j += 2;
        continue;
      }
      j += 1;
      return { value: out, next: j };
    }
    out += c;
    j += 1;
  }
  return null; // unterminated
}

/** If s[i] starts an E'...' string (E not part of a longer word), skip it.
    Postgres E-strings allow backslash escapes plus '' escape. Lenient: unterminated consumes to end. */
function skipEStringAt(s: string, i: number): number | null {
  if ((s[i] === 'E' || s[i] === 'e') && s[i + 1] === "'") {
    if (i > 0) {
      const prev = s[i - 1] ?? '';
      if (isWordChar(prev)) return null;
    }
    let j = i + 2;
    const n = s.length;
    while (j < n) {
      const c = s[j] ?? '';
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === "'") {
        if (s[j + 1] === "'") {
          j += 2;
          continue;
        }
        return j + 1;
      }
      j += 1;
    }
    return n;
  }
  return null;
}

/** Find first '(' at or after `from`, ignoring ones inside strings/quotes/comments/E-strings. */
function findFirstParen(s: string, from: number): number {
  let i = from;
  const n = s.length;
  while (i < n) {
    const eEnd = skipEStringAt(s, i);
    if (eEnd !== null) {
      i = eEnd;
      continue;
    }
    const c = s[i] ?? '';
    if (c === "'") {
      i += 1;
      while (i < n) {
        if (s[i] === "'") {
          if (s[i + 1] === "'") {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      i += 1;
      while (i < n) {
        if (s[i] === '"') {
          if (s[i + 1] === '"') {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '`') {
      i += 1;
      while (i < n && s[i] !== '`') i += 1;
      if (i < n) i += 1;
      continue;
    }
    if (c === '-' && s[i + 1] === '-') {
      i += 2;
      while (i < n && s[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && s[i + 1] === '*') {
      i += 2;
      while (i < n && !(s[i] === '*' && s[i + 1] === '/')) i += 1;
      if (i < n) i += 2;
      continue;
    }
    if (c === '(') return i;
    i += 1;
  }
  return -1;
}

/** Find matching ')' for '(' at openPos. String/quote/comment aware. Returns index of ')' or -1. */
function findMatchingParen(s: string, openPos: number): number {
  // openPos must point at '('
  let depth = 0;
  let i = openPos;
  const n = s.length;
  while (i < n) {
    const eEnd = skipEStringAt(s, i);
    if (eEnd !== null) {
      i = eEnd;
      continue;
    }
    const c = s[i]!;
    if (c === "'") {
      i += 1;
      while (i < n) {
        if (s[i] === "'") {
          if (s[i + 1] === "'") {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      i += 1;
      while (i < n) {
        if (s[i] === '"') {
          if (s[i + 1] === '"') {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '`') {
      i += 1;
      while (i < n) {
        if (s[i] === '`') {
          if (s[i + 1] === '`') {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '-' && s[i + 1] === '-') {
      i += 2;
      while (i < n && s[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && s[i + 1] === '*') {
      i += 2;
      while (i < n && !(s[i] === '*' && s[i + 1] === '/')) i += 1;
      if (i < n) i += 2;
      continue;
    }
    if (c === '(') {
      depth += 1;
      i += 1;
      continue;
    }
    if (c === ')') {
      depth -= 1;
      if (depth === 0) return i;
      i += 1;
      continue;
    }
    i += 1;
  }
  return -1;
}

/** Split body by top-level commas (paren-depth 0, outside strings/quotes/comments). */
function splitTopLevelCommas(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  const n = body.length;
  while (i < n) {
    const eEnd = skipEStringAt(body, i);
    if (eEnd !== null) {
      i = eEnd;
      continue;
    }
    const c = body[i]!;
    if (c === "'") {
      i += 1;
      while (i < n) {
        if (body[i] === "'") {
          if (body[i + 1] === "'") {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      i += 1;
      while (i < n) {
        if (body[i] === '"') {
          if (body[i + 1] === '"') {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '`') {
      i += 1;
      while (i < n) {
        if (body[i] === '`') {
          if (body[i + 1] === '`') {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '[') {
      i += 1;
      while (i < n && body[i] !== ']') i += 1;
      if (i < n) i += 1;
      continue;
    }
    if (c === '-' && body[i + 1] === '-') {
      i += 2;
      while (i < n && body[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && body[i + 1] === '*') {
      i += 2;
      while (i < n && !(body[i] === '*' && body[i + 1] === '/')) i += 1;
      if (i < n) i += 2;
      continue;
    }
    if (c === '(') {
      depth += 1;
      i += 1;
      continue;
    }
    if (c === ')') {
      if (depth > 0) depth -= 1;
      i += 1;
      continue;
    }
    if (c === ',' && depth === 0) {
      parts.push(body.slice(start, i));
      i += 1;
      start = i;
      continue;
    }
    i += 1;
  }
  parts.push(body.slice(start));
  return parts;
}

// ---------------------------------------------------------------------------
// Statement splitter (semicolon outside strings/quotes/comments/dollar-quotes)
// ---------------------------------------------------------------------------

interface RawStatement {
  text: string; // without trailing ';'
  line: number; // 1-indexed line of first meaningful token
}

function isDollarTagStart(s: string, i: number): string | null {
  // Matches $tag$ or $$ at i. tag = [A-Za-z_][A-Za-z0-9_]* or empty.
  if (s[i] !== '$') return null;
  let j = i + 1;
  while (j < s.length && /[A-Za-z0-9_]/.test(s[j]!)) j += 1;
  if (j < s.length && s[j] === '$') {
    const tag = s.slice(i, j + 1); // e.g. $$, $body$, $1$? (digits allowed after first? keep simple)
    // Validate tag body: letters/underscore start or empty. "$1$" — Postgres disallows digit-start tags; treat as not-a-tag.
    const inner = s.slice(i + 1, j);
    if (inner === '' || /^[A-Za-z_][A-Za-z0-9_]*$/.test(inner)) return tag;
    return null;
  }
  return null;
}

function lineAt(input: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < input.length; i += 1) {
    if (input[i] === '\n') line += 1;
  }
  return line;
}

function firstMeaningfulIndex(chunk: string): number {
  let i = 0;
  const n = chunk.length;
  while (i < n) {
    const c = chunk[i]!;
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f' || c === '\v' || c === ';') {
      i += 1;
      continue;
    }
    if (c === '-' && chunk[i + 1] === '-') {
      i += 2;
      while (i < n && chunk[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && chunk[i + 1] === '*') {
      i += 2;
      while (i < n && !(chunk[i] === '*' && chunk[i + 1] === '/')) i += 1;
      if (i < n) i += 2;
      continue;
    }
    break;
  }
  return i;
}

function splitStatements(input: string): RawStatement[] {
  const out: RawStatement[] = [];
  const n = input.length;
  let segStart = 0;
  let i = 0;
  let dollarTag: string | null = null;

  const pushSeg = (endExclusive: number): void => {
    const chunk = input.slice(segStart, endExclusive);
    const meaningful = firstMeaningfulIndex(chunk);
    const rest = chunk.slice(meaningful).trim();
    // Strip trailing ';' remnants already excluded; skip empties / comment-only.
    const stripped = rest.replace(/;+\s*$/, '').trim();
    if (stripped !== '') {
      const absIndex = segStart + meaningful;
      out.push({ text: stripped, line: lineAt(input, absIndex) });
    }
  };

  while (i < n) {
    const eEnd = skipEStringAt(input, i);
    if (eEnd !== null) {
      if (dollarTag !== null) {
        i += 1;
        continue;
      }
      i = eEnd;
      continue;
    }
    if (dollarTag !== null) {
      if (input.startsWith(dollarTag, i)) {
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      i += 1;
      continue;
    }
    const c = input[i]!;
    if (c === "'") {
      i += 1;
      while (i < n) {
        if (input[i] === "'") {
          if (input[i + 1] === "'") {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      i += 1;
      while (i < n) {
        if (input[i] === '"') {
          if (input[i + 1] === '"') {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '`') {
      i += 1;
      while (i < n) {
        if (input[i] === '`') {
          if (input[i + 1] === '`') {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '-' && input[i + 1] === '-') {
      i += 2;
      while (i < n && input[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && input[i + 1] === '*') {
      i += 2;
      while (i < n && !(input[i] === '*' && input[i + 1] === '/')) i += 1;
      if (i < n) i += 2;
      continue;
    }
    if (c === '$') {
      const tag = isDollarTagStart(input, i);
      if (tag !== null) {
        dollarTag = tag;
        i += tag.length;
        continue;
      }
      i += 1;
      continue;
    }
    if (c === ';') {
      pushSeg(i);
      i += 1;
      segStart = i;
      continue;
    }
    i += 1;
  }
  // Trailing segment without ';' (lenient: still a statement).
  if (segStart < n) pushSeg(n);
  return out;
}

// ---------------------------------------------------------------------------
// Internal parse context
// ---------------------------------------------------------------------------

interface PendingFk {
  fromTable: string;
  fromCols: string[];
  toTable: string;
  toCols: string[];
  onDeleteRaw: string | null;
  line: number;
}

interface PendingIndex {
  table: string;
  expr: string;
  line: number;
}

interface PendingTableComment {
  table: string;
  comment: string;
  line: number;
}

interface PendingColumnComment {
  table: string;
  column: string;
  comment: string;
  line: number;
}

interface Ctx {
  now: string;
  warnings: DDLWarning[];
  enums: Map<string, string[]>; // lower(name) -> labels
  tables: Table[];
  byLower: Map<string, Table>;
  tableLines: Map<string, number>; // tableId -> CREATE TABLE statement line
  pendingFks: PendingFk[];
  pendingIndexes: PendingIndex[];
  pendingTableComments: PendingTableComment[];
  pendingColumnComments: PendingColumnComment[];
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
  if (t === 'restrict') return { value: 'restrict', unknown: false };
  if (t === 'no action') return { value: 'restrict', unknown: false };
  return { value: 'restrict', unknown: true };
}

/** Normalize a type/ident for enum lookup: last dotted part, strip quotes/brackets, lower. */
function enumLookupKey(rawType: string): string {
  const firstWord = rawType.trim().split(/\s+/)[0] ?? '';
  const dotted = firstWord.split('.');
  const last = dotted[dotted.length - 1] ?? '';
  let unquoted = last;
  if (unquoted.length >= 2) {
    const firstCh = unquoted[0];
    const lastCh = unquoted[unquoted.length - 1];
    if ((firstCh === '"' && lastCh === '"') || (firstCh === '`' && lastCh === '`')) {
      unquoted = unquoted.slice(1, -1);
    } else if (firstCh === '[' && lastCh === ']') {
      unquoted = unquoted.slice(1, -1).replace(/]]/g, ']');
    }
  }
  unquoted = unquoted.replace(/""/g, '"').replace(/``/g, '`');
  return unquoted.toLowerCase();
}

function escapeEnumLabel(label: string): string {
  return `'${label.replace(/'/g, "''")}'`;
}

function enumTypeString(labels: string[]): string {
  return `enum(${labels.map(escapeEnumLabel).join(', ')})`;
}

/** Extract ENUM labels from inside-parens string. Supports '...'/\"...\"/bare. */
function extractEnumLabels(inner: string): string[] {
  const labels: string[] = [];
  const tokens = splitTopLevelCommas(inner);
  for (const tok of tokens) {
    const t = tok.trim();
    if (t === '') continue;
    if (t.startsWith("'") && t.length >= 2) {
      const parsed = parseStringLiteralAt(t, 0);
      if (parsed) {
        labels.push(parsed.value);
        continue;
      }
      // Fallback: strip quotes manually.
      labels.push(t.replace(/^'/, '').replace(/'$/, '').replace(/''/g, "'"));
      continue;
    }
    if (t.startsWith('"') && t.length >= 2) {
      // Double-quoted enum label.
      let out = '';
      let ok = false;
      let j = 1;
      while (j < t.length) {
        if (t[j] === '"') {
          if (t[j + 1] === '"') {
            out += '"';
            j += 2;
            continue;
          }
          ok = true;
          break;
        }
        out += t[j];
        j += 1;
      }
      labels.push(ok ? out : t.replace(/^"|"$/g, ''));
      continue;
    }
    // Bare label: strip surrounding quotes if any.
    labels.push(t.replace(/^['"]|['"]$/g, ''));
  }
  return labels.filter((l) => l !== '');
}

// ---------------------------------------------------------------------------
// Column type + constraints parsing
// ---------------------------------------------------------------------------

const TYPE_STOPPERS = new Set([
  'not',
  'null',
  'primary',
  'unique',
  'default',
  'references',
  'check',
  'collate',
  'generated',
  'constraint',
  'foreign',
  'comment',
  'on',
]);

interface ColTypeOut {
  type: string;
  next: number;
}

function parseColumnType(s: string, pos: number): ColTypeOut {
  const typeStart = skipWsAndComments(s, pos);
  let i = typeStart;
  let typeEnd = typeStart;
  const n = s.length;
  for (;;) {
    const j = skipWsAndComments(s, i);
    if (j >= n) {
      i = j;
      break;
    }
    const c = s[j]!;
    if (c === '(') {
      const close = findMatchingParen(s, j);
      if (close === -1) break; // unbalanced — stop type here
      i = close + 1;
      typeEnd = i;
      continue;
    }
    if (c === '[') {
      // Array suffix e.g. TEXT[] / INTEGER[10]
      let k = j + 1;
      while (k < n && s[k] !== ']') k += 1;
      if (k < n) k += 1;
      i = k;
      typeEnd = i;
      continue;
    }
    if (c === '"' || c === '`') {
      const id = parseIdentAt(s, j);
      if (!id) break;
      const lower = id.name.toLowerCase();
      if (TYPE_STOPPERS.has(lower)) break;
      i = id.next;
      typeEnd = i;
      continue;
    }
    if (c === "'") break; // string can't be part of type
    const m = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(s.slice(j));
    if (!m) break;
    const word = m[0];
    if (TYPE_STOPPERS.has(word.toLowerCase())) break;
    i = j + word.length;
    typeEnd = i;
  }
  return { type: s.slice(typeStart, typeEnd).trim(), next: typeEnd };
}

interface ColConstraints {
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  default: string | null;
  fk: { toTable: string; toCol: string | null; onDeleteRaw: string | null } | null;
  inlineComment: boolean;
}

/** Parse ON DELETE / ON UPDATE clauses at pos; returns { onDeleteRaw, next }. ON UPDATE consumed+ignored. */
function parseOnClauses(s: string, pos: number): { onDeleteRaw: string | null; next: number } {
  let i = pos;
  let onDeleteRaw: string | null = null;
  for (let guard = 0; guard < 4; guard += 1) {
    const j = skipWsAndComments(s, i);
    if (matchWordAt(s, j, 'on') === null) break;
    const afterOn = skipWsAndComments(s, (matchWordAt(s, j, 'on') as number));
    const w = peekWord(s, afterOn);
    if (!w || (w.toLowerCase() !== 'delete' && w.toLowerCase() !== 'update')) break;
    const isDelete = w.toLowerCase() === 'delete';
    let k = skipWsAndComments(s, afterOn + w.length);
    // Action: SET NULL | SET DEFAULT | NO ACTION | CASCADE | RESTRICT | SET ... (2 words) | single word
    const a1 = peekWord(s, k);
    if (!a1) break;
    let action: string;
    if (a1.toLowerCase() === 'set' || a1.toLowerCase() === 'no') {
      const k2 = skipWsAndComments(s, k + a1.length);
      const a2 = peekWord(s, k2);
      if (!a2) break;
      action = `${a1} ${a2}`;
      k = k2 + a2.length;
    } else {
      action = a1;
      k = k + a1.length;
    }
    if (isDelete && onDeleteRaw === null) onDeleteRaw = action;
    i = k;
  }
  return { onDeleteRaw, next: i };
}

/** Parse `REFERENCES tbl [(col)] [ON ...]` assuming pos is right after REFERENCES keyword. */
function parseReferencesTarget(
  s: string,
  pos: number,
): { toTable: string; toCol: string | null; onDeleteRaw: string | null; next: number } | null {
  const dotted = parseDottedIdents(s, pos);
  if (!dotted || dotted.parts.length === 0) return null;
  const toTable = dotted.parts[dotted.parts.length - 1]!;
  let i = dotted.next;
  let toCol: string | null = null;
  const j = skipWsAndComments(s, i);
  if (s[j] === '(') {
    const close = findMatchingParen(s, j);
    if (close === -1) return null;
    const inner = s.slice(j + 1, close);
    const cols = splitTopLevelCommas(inner)
      .map((t) => t.trim())
      .filter((t) => t !== '');
    if (cols.length > 0) {
      const id = parseIdentAt(cols[0]!, 0);
      toCol = id ? id.name : cols[0]!.split(/\s+/)[0]!;
    }
    i = close + 1;
  }
  const on = parseOnClauses(s, i);
  return { toTable, toCol, onDeleteRaw: on.onDeleteRaw, next: on.next };
}

/** Scan DEFAULT expr from pos until next top-level constraint starter or end. */
function scanDefaultExpr(s: string, pos: number): { expr: string; next: number } {
  const start = skipWsAndComments(s, pos);
  let i = start;
  const n = s.length;
  let depth = 0;

  const starterAt = (p: number): number | null => {
    // Try longest starters first. Returns end pos of starter or null.
    const save = skipWsAndComments(s, p);
    if (save >= n) return null;
    // NOT NULL
    const notM = matchWordAt(s, save, 'not');
    if (notM !== null) {
      const after = skipWsAndComments(s, notM);
      if (matchWordAt(s, after, 'null') !== null) return matchWordAt(s, after, 'null') as number;
      return null; // bare NOT is not a starter here
    }
    // PRIMARY KEY
    const priM = matchWordAt(s, save, 'primary');
    if (priM !== null) {
      const after = skipWsAndComments(s, priM);
      if (matchWordAt(s, after, 'key') !== null) return matchWordAt(s, after, 'key') as number;
      return null;
    }
    // FOREIGN KEY
    const forM = matchWordAt(s, save, 'foreign');
    if (forM !== null) {
      const after = skipWsAndComments(s, forM);
      if (matchWordAt(s, after, 'key') !== null) return matchWordAt(s, after, 'key') as number;
      return null;
    }
    for (const w of ['unique', 'default', 'references', 'check', 'collate', 'generated', 'constraint', 'comment', 'foreign', 'null', 'on']) {
      const m = matchWordAt(s, save, w);
      if (m !== null) return m;
    }
    return null;
  };

  while (i < n) {
    const eEnd = skipEStringAt(s, i);
    if (eEnd !== null) {
      i = eEnd;
      continue;
    }
    const c = s[i]!;
    if (c === "'") {
      i += 1;
      while (i < n) {
        if (s[i] === "'") {
          if (s[i + 1] === "'") {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      i += 1;
      while (i < n) {
        if (s[i] === '"') {
          if (s[i + 1] === '"') {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '`') {
      i += 1;
      while (i < n && s[i] !== '`') i += 1;
      if (i < n) i += 1;
      continue;
    }
    if (c === '-' && s[i + 1] === '-') {
      // Line comment ends DEFAULT expr.
      break;
    }
    if (c === '/' && s[i + 1] === '*') {
      let k = i + 2;
      while (k < n && !(s[k] === '*' && s[k + 1] === '/')) k += 1;
      if (k < n) k += 2;
      i = k;
      continue;
    }
    if (c === '(') {
      depth += 1;
      i += 1;
      continue;
    }
    if (c === ')') {
      if (depth === 0) break; // shouldn't happen inside column def (already split), stop
      depth -= 1;
      i += 1;
      continue;
    }
    if (depth === 0) {
      const st = starterAt(i);
      // Only treat as boundary if we're past at least one char of expr.
      if (st !== null && i > start) {
        // Peek: ensure the starter isn't part of `::type` cast? `::` precedes word, but starter check is word-based; `now()::text` — after `now()` we see `::text`; starterAt at ':' position won't match (not a word), so fine.
        break;
      }
      // `,` at depth 0 also ends expr (safety; column split should have removed it).
      if (c === ',') break;
    }
    i += 1;
  }
  return { expr: s.slice(start, i).trim(), next: i };
}

function parseColumnConstraints(s: string, pos: number): { cons: ColConstraints; next: number } {
  const cons: ColConstraints = {
    nullable: true,
    primaryKey: false,
    unique: false,
    default: null,
    fk: null,
    inlineComment: false,
  };
  let i = pos;
  const n = s.length;
  let guard = 0;
  while (guard < 200) {
    guard += 1;
    const j = skipWsAndComments(s, i);
    if (j >= n) {
      i = j;
      break;
    }
    // NOT NULL
    const notM = matchWordAt(s, j, 'not');
    if (notM !== null) {
      const after = skipWsAndComments(s, notM);
      if (matchWordAt(s, after, 'null') !== null) {
        cons.nullable = false;
        i = matchWordAt(s, after, 'null') as number;
        continue;
      }
    }
    // PRIMARY KEY
    const priM = matchWordAt(s, j, 'primary');
    if (priM !== null) {
      const after = skipWsAndComments(s, priM);
      const keyM = matchWordAt(s, after, 'key');
      if (keyM !== null) {
        cons.primaryKey = true;
        cons.nullable = false;
        i = keyM;
        continue;
      }
    }
    // UNIQUE
    if (matchWordAt(s, j, 'unique') !== null) {
      cons.unique = true;
      i = matchWordAt(s, j, 'unique') as number;
      // Optional `(cols)` after column-level UNIQUE — skip balanced parens if present.
      const k = skipWsAndComments(s, i);
      if (s[k] === '(') {
        const close = findMatchingParen(s, k);
        if (close !== -1) i = close + 1;
      }
      continue;
    }
    // DEFAULT
    if (matchWordAt(s, j, 'default') !== null) {
      const afterDef = matchWordAt(s, j, 'default') as number;
      // DEFAULT NULL → treat as no default (nullable marker only).
      const chk = skipWsAndComments(s, afterDef);
      const wNull = matchWordAt(s, chk, 'null');
      if (wNull !== null) {
        const afterNull = skipWsAndComments(s, wNull);
        // If NULL is followed by end or another starter, it's the NULL literal.
        const w2 = peekWord(s, afterNull);
        if (!w2 || TYPE_STOPPERS.has(w2.toLowerCase()) || afterNull >= n) {
          cons.default = null;
          i = wNull;
          continue;
        }
      }
      const scanned = scanDefaultExpr(s, afterDef);
      const expr = scanned.expr;
      i = scanned.next;
      if (expr !== '') cons.default = expr;
      continue;
    }
    // REFERENCES (col-level FK)
    if (matchWordAt(s, j, 'references') !== null) {
      const afterRef = matchWordAt(s, j, 'references') as number;
      const tgt = parseReferencesTarget(s, afterRef);
      if (tgt) {
        cons.fk = { toTable: tgt.toTable, toCol: tgt.toCol, onDeleteRaw: tgt.onDeleteRaw };
        i = tgt.next;
      } else {
        i = afterRef;
      }
      continue;
    }
    // CONSTRAINT name — consume name, loop again for the real constraint.
    if (matchWordAt(s, j, 'constraint') !== null) {
      const afterC = matchWordAt(s, j, 'constraint') as number;
      const k = skipWsAndComments(s, afterC);
      const w = peekWord(s, k);
      if (w && !['primary', 'foreign', 'unique', 'check', 'not', 'null', 'default', 'references'].includes(w.toLowerCase())) {
        const id = parseIdentAt(s, k);
        i = id ? id.next : k + w.length;
      } else if (!w) {
        // Possibly a quoted constraint name ("pk x").
        const id = parseIdentAt(s, k);
        i = id ? id.next : afterC;
      } else {
        i = afterC;
      }
      continue;
    }
    // FOREIGN (standalone inside column — skip `FOREIGN KEY (cols)` fragment, REFERENCES handled next loop)
    if (matchWordAt(s, j, 'foreign') !== null) {
      const afterF = matchWordAt(s, j, 'foreign') as number;
      const k = skipWsAndComments(s, afterF);
      const keyM = matchWordAt(s, k, 'key');
      if (keyM !== null) {
        let m = skipWsAndComments(s, keyM);
        if (s[m] === '(') {
          const close = findMatchingParen(s, m);
          if (close !== -1) m = close + 1;
        }
        i = m;
        continue;
      }
      i = afterF;
      continue;
    }
    // COMMENT [...] — inline comment, ignored-honest.
    if (matchWordAt(s, j, 'comment') !== null) {
      cons.inlineComment = true;
      let k = matchWordAt(s, j, 'comment') as number;
      // Optional `ON ...`? no. Skip optional `=` then string/word.
      k = skipWsAndComments(s, k);
      if (s[k] === '=') k = skipWsAndComments(s, k + 1);
      const lit = parseStringLiteralAt(s, k);
      if (lit) {
        k = lit.next;
      } else {
        const w = peekWord(s, k);
        if (w) k = skipWsAndComments(s, k) + w.length;
        else if (k < n) k += 1;
      }
      i = k;
      continue;
    }
    // CHECK (...) — skip balanced parens.
    if (matchWordAt(s, j, 'check') !== null) {
      let k = matchWordAt(s, j, 'check') as number;
      k = skipWsAndComments(s, k);
      if (s[k] === '(') {
        const close = findMatchingParen(s, k);
        if (close !== -1) k = close + 1;
      }
      i = k;
      continue;
    }
    // COLLATE name — skip one ident.
    if (matchWordAt(s, j, 'collate') !== null) {
      let k = matchWordAt(s, j, 'collate') as number;
      const id = parseIdentAt(s, k);
      i = id ? id.next : k;
      continue;
    }
    // GENERATED ... — skip until next starter (best-effort: consume words/parens).
    if (matchWordAt(s, j, 'generated') !== null) {
      let k = matchWordAt(s, j, 'generated') as number;
      // Consume up to 6 tokens/parens blindly.
      for (let t = 0; t < 6; t += 1) {
        const kk = skipWsAndComments(s, k);
        if (kk >= n) {
          k = kk;
          break;
        }
        if (s[kk] === '(') {
          const close = findMatchingParen(s, kk);
          if (close === -1) break;
          k = close + 1;
          continue;
        }
        const w = peekWord(s, kk);
        if (!w) {
          k = kk + 1;
          continue;
        }
        if (TYPE_STOPPERS.has(w.toLowerCase()) && w.toLowerCase() !== 'generated') break;
        k = kk + w.length;
      }
      i = k;
      continue;
    }
    // Standalone NULL (nullability)
    if (matchWordAt(s, j, 'null') !== null) {
      cons.nullable = true;
      i = matchWordAt(s, j, 'null') as number;
      continue;
    }
    // ON ... (orphan, e.g. after col-level REFERENCES already consumed — normally unreachable)
    if (matchWordAt(s, j, 'on') !== null) {
      const parsed = parseOnClauses(s, j);
      if (parsed.next !== j) {
        // Merge into existing fk if present.
        if (cons.fk && parsed.onDeleteRaw && !cons.fk.onDeleteRaw) {
          cons.fk.onDeleteRaw = parsed.onDeleteRaw;
        }
        i = parsed.next;
        continue;
      }
    }
    // Fallback: consume one word/char to guarantee progress.
    const w = peekWord(s, j);
    if (w) {
      i = j + w.length;
      // Skip a balanced paren group right after an unknown word (e.g. `USING foo`).
      const k = skipWsAndComments(s, i);
      if (s[k] === '(') {
        const close = findMatchingParen(s, k);
        if (close !== -1) i = close + 1;
      }
    } else {
      i = j + 1;
    }
  }
  return { cons, next: i };
}

// ---------------------------------------------------------------------------
// Statement-level parsers
// ---------------------------------------------------------------------------

function kindOf(stmt: string): string {
  const m = /^\s*([A-Za-z]+)(?:\s+([A-Za-z]+))?/.exec(stmt);
  if (!m) return 'STATEMENT';
  const a = (m[1] ?? '').toUpperCase();
  const b = (m[2] ?? '').toUpperCase();
  if (a === 'CREATE' && b) return `CREATE ${b}`;
  if (a === 'ALTER' && b) return `ALTER ${b}`;
  if (a === 'COMMENT' && b) return `COMMENT ${b}`;
  if (a === 'DROP' && b) return `DROP ${b}`;
  if (a === 'INSERT' && b) return `INSERT ${b}`;
  return a;
}

function parseCreateTypeStmt(stmt: string, line: number, ctx: Ctx): 'ok' | 'unsupported' | 'unparsable' {
  void line;
  let i = skipWsAndComments(stmt, 0);
  const cM = matchWordAt(stmt, i, 'create');
  if (cM === null) return 'unparsable';
  i = skipWsAndComments(stmt, cM);
  if (matchWordAt(stmt, i, 'type') === null) return 'unparsable';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'type') as number));
  const ifne = matchPhrase(stmt, i, ['if', 'not', 'exists']);
  if (ifne !== null) i = ifne;
  const dotted = parseDottedIdents(stmt, i);
  if (!dotted) return 'unparsable';
  const typeName = dotted.parts[dotted.parts.length - 1]!;
  i = skipWsAndComments(stmt, dotted.next);
  if (matchWordAt(stmt, i, 'as') === null) return 'unsupported';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'as') as number));
  if (matchWordAt(stmt, i, 'enum') === null) return 'unsupported';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'enum') as number));
  if (stmt[i] !== '(') return 'unparsable';
  const close = findMatchingParen(stmt, i);
  if (close === -1) return 'unparsable';
  const labels = extractEnumLabels(stmt.slice(i + 1, close));
  if (labels.length === 0) return 'unparsable';
  ctx.enums.set(typeName.toLowerCase(), labels);
  return 'ok';
}

interface ParsedColumn {
  name: string;
  rawType: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  default: string | null;
  fk: { toTable: string; toCol: string | null; onDeleteRaw: string | null } | null;
  inlineComment: boolean;
}

function parseColumnDefString(part: string): ParsedColumn | null {
  const id = parseIdentAt(part, 0);
  if (!id || id.name.trim() === '') return null;
  const t = parseColumnType(part, id.next);
  const { cons } = parseColumnConstraints(part, t.next);
  return {
    name: id.name,
    rawType: t.type,
    nullable: cons.nullable,
    primaryKey: cons.primaryKey,
    unique: cons.unique,
    default: cons.default,
    fk: cons.fk,
    inlineComment: cons.inlineComment,
  };
}

/** Parse ident list inside parens at pos (pos → '('). Returns names + after-paren pos. */
function parseParenIdentList(
  s: string,
  openPos: number,
): { names: string[]; next: number } | null {
  const j = skipWsAndComments(s, openPos);
  if (s[j] !== '(') return null;
  const close = findMatchingParen(s, j);
  if (close === -1) return null;
  const inner = s.slice(j + 1, close);
  const names: string[] = [];
  for (const tok of splitTopLevelCommas(inner)) {
    const t = tok.trim();
    if (t === '') continue;
    const id = parseIdentAt(t, 0);
    if (id && id.name !== '') names.push(id.name);
    else {
      const w = t.split(/\s+/)[0];
      if (w) names.push(w);
    }
  }
  return { names, next: close + 1 };
}

function parseCreateTableStmt(stmt: string, line: number, ctx: Ctx): 'ok' | 'unparsable' {
  let i = skipWsAndComments(stmt, 0);
  const cM = matchWordAt(stmt, i, 'create');
  if (cM === null) return 'unparsable';
  i = skipWsAndComments(stmt, cM);
  // Optional TEMP/TEMPORARY/UNLOGGED/GLOBAL/LOCAL — skip if present (still a table).
  for (;;) {
    const w = peekWord(stmt, i);
    if (!w) break;
    const lw = w.toLowerCase();
    if (lw === 'temp' || lw === 'temporary' || lw === 'unlogged' || lw === 'global' || lw === 'local') {
      i = skipWsAndComments(stmt, i) + w.length;
      continue;
    }
    break;
  }
  if (matchWordAt(stmt, i, 'table') === null) return 'unparsable';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'table') as number));
  const ifne = matchPhrase(stmt, i, ['if', 'not', 'exists']);
  if (ifne !== null) i = ifne;
  const dotted = parseDottedIdents(stmt, i);
  if (!dotted) return 'unparsable';
  const rawTableName = dotted.parts[dotted.parts.length - 1]!;
  i = skipWsAndComments(stmt, dotted.next);
  // Table name must be non-empty.
  if (rawTableName.trim() === '') return 'unparsable';
  // `CREATE TABLE x PARTITION OF ...` — declarative partition child: no column
  // list of its own. Explicitly unsupported → warn + skip (not unparsable).
  if (matchWordAt(stmt, i, 'partition') !== null) {
    warn(ctx, line, `unsupported PARTITION skipped`);
    return 'ok';
  }
  // Quote-aware first paren (a quoted table name may itself contain '(').
  const openIdx = findFirstParen(stmt, i);
  if (openIdx === -1) {
    warn(ctx, line, `table "${rawTableName}" has no columns skipped`);
    return 'ok'; // counted as handled (warned skip), not unparsable
  }
  const close = findMatchingParen(stmt, openIdx);
  if (close === -1) return 'unparsable';
  // Trailing `PARTITION BY ...` (declarative partitioning) is explicitly out of
  // scope: table is still imported, but the clause is honestly warned about.
  // (WITH (...)/TABLESPACE/INHERITS trailing options stay silently ignored.)
  const trailNoStr = stmt.slice(close + 1).replace(/'(?:''|[^'])*'/g, "''");
  if (/\bpartition\s+by\b/i.test(trailNoStr)) {
    warn(ctx, line, `partition clause in table "${rawTableName}" ignored`);
  }
  const body = stmt.slice(openIdx + 1, close);
  const parts = splitTopLevelCommas(body);

  const pkCols: string[] = [];
  const tableUniques: string[][] = [];
  const parsedCols: ParsedColumn[] = [];
  const inlineFks: Array<{ fromCol: string; toTable: string; toCol: string | null; onDeleteRaw: string | null }> = [];
  let inlineCommentWarned = false;

  for (const raw of parts) {
    const part = raw.trim();
    if (part === '') continue;
    // Table-level PRIMARY KEY (optional CONSTRAINT name prefix).
    let probe = skipWsAndComments(part, 0);
    const cPre = matchWordAt(part, probe, 'constraint');
    if (cPre !== null) {
      let k = skipWsAndComments(part, cPre);
      const w = peekWord(part, k);
      const isKw = w && ['primary', 'foreign', 'unique', 'check'].includes(w.toLowerCase());
      if (!isKw) {
        // Optional constraint name — bare or quoted. If absent, parseIdentAt
        // fails and k stays (e.g. lone `CONSTRAINT`, skipped below).
        const id = parseIdentAt(part, k);
        if (id) k = id.next;
      }
      probe = skipWsAndComments(part, k);
      if (probe >= part.length) continue;
    }
    const priM = matchWordAt(part, probe, 'primary');
    if (priM !== null) {
      const after = skipWsAndComments(part, priM);
      if (matchWordAt(part, after, 'key') !== null) {
        const kk = skipWsAndComments(part, (matchWordAt(part, after, 'key') as number));
        const list = parseParenIdentList(part, kk);
        if (!list) return 'unparsable';
        for (const c of list.names) if (c !== '') pkCols.push(c);
        continue;
      }
    }
    // Table-level FOREIGN KEY (optional CONSTRAINT name prefix already consumed).
    const forM = matchWordAt(part, probe, 'foreign');
    if (forM !== null) {
      const afterF = skipWsAndComments(part, forM);
      if (matchWordAt(part, afterF, 'key') !== null) {
        let k = skipWsAndComments(part, (matchWordAt(part, afterF, 'key') as number));
        const fromList = parseParenIdentList(part, k);
        if (!fromList) return 'unparsable';
        k = skipWsAndComments(part, fromList.next);
        if (matchWordAt(part, k, 'references') === null) return 'unparsable';
        const tgt = parseReferencesTarget(part, (matchWordAt(part, k, 'references') as number));
        if (!tgt || !tgt.toTable) return 'unparsable';
        if (fromList.names.length === 0) return 'unparsable';
        if (tgt.toCol === null) {
          // REFERENCES without column — pair each from-col with missing target → orphan later.
          for (const fc of fromList.names) {
            inlineFks.push({ fromCol: fc, toTable: tgt.toTable, toCol: '', onDeleteRaw: tgt.onDeleteRaw });
          }
        } else if (fromList.names.length === 1) {
          inlineFks.push({
            fromCol: fromList.names[0]!,
            toTable: tgt.toTable,
            toCol: tgt.toCol,
            onDeleteRaw: tgt.onDeleteRaw,
          });
        } else {
          // Composite: expand pairwise when from/to counts match; else skip + warning.
          if (fromList.names.length > 1) {
            // Re-extract the full to-column list from the REFERENCES parens
            // (parseReferencesTarget only keeps the first column).
            const rr = part.slice(k);
            const rp = findFirstParen(rr, 0);
            if (rp !== -1) {
              const absOpen = k + rp;
              const absClose = findMatchingParen(part, absOpen);
              if (absClose !== -1) {
                const toNames = splitTopLevelCommas(part.slice(absOpen + 1, absClose))
                  .map((t) => t.trim())
                  .filter((t) => t !== '')
                  .map((t) => parseIdentAt(t, 0)?.name ?? t.split(/\s+/)[0]!);
                if (toNames.length === fromList.names.length) {
                  fromList.names.forEach((fc, idx) => {
                    inlineFks.push({
                      fromCol: fc,
                      toTable: tgt.toTable,
                      toCol: toNames[idx]!,
                      onDeleteRaw: tgt.onDeleteRaw,
                    });
                  });
                  continue;
                }
              }
            }
            warn(ctx, line, `composite foreign key in table "${rawTableName}" skipped (column count mismatch)`);
            continue;
          }
          inlineFks.push({
            fromCol: fromList.names[0]!,
            toTable: tgt.toTable,
            toCol: tgt.toCol,
            onDeleteRaw: tgt.onDeleteRaw,
          });
        }
        continue;
      }
    }
    // Table-level UNIQUE.
    const uniqM = matchWordAt(part, probe, 'unique');
    if (uniqM !== null) {
      let k = skipWsAndComments(part, uniqM);
      if (part[k] === '(') {
        const list = parseParenIdentList(part, k);
        if (!list) return 'unparsable';
        if (list.names.length > 0) tableUniques.push(list.names);
      }
      // Bare UNIQUE without cols at table level — ignore.
      continue;
    }
    // CONSTRAINT CHECK / CHECK / EXCLUDE / LIKE / etc — ignore silently.
    // (Unquoted columns literally named check/like/exclude fall here too —
    // quote them. Deliberately not over-engineered.)
    const lowHead = (peekWord(part, probe) ?? '').toLowerCase();
    if (lowHead === 'check' || lowHead === 'exclude' || lowHead === 'like' || lowHead === 'constraint') {
      continue;
    }
    // Otherwise: column definition.
    const col = parseColumnDefString(part);
    if (!col || col.name.trim() === '') {
      warn(ctx, line, `unparsable column definition in table "${rawTableName}" skipped`);
      continue;
    }
    if (col.inlineComment && !inlineCommentWarned) {
      warn(ctx, line, `inline COMMENT in table "${rawTableName}" ignored`);
      inlineCommentWarned = true;
    }
    parsedCols.push(col);
    if (col.fk) {
      inlineFks.push({
        fromCol: col.name,
        toTable: col.fk.toTable,
        toCol: col.fk.toCol ?? '',
        onDeleteRaw: col.fk.onDeleteRaw,
      });
    }
  }

  if (parsedCols.length === 0) {
    warn(ctx, line, `table "${rawTableName}" has no valid columns skipped`);
    return 'ok';
  }

  // Duplicate table (case-insensitive) → skip second.
  if (ctx.byLower.has(rawTableName.toLowerCase())) {
    warn(ctx, line, `duplicate table "${rawTableName}" skipped`);
    return 'ok';
  }

  // Enforce table name limit.
  const tNameCapped = truncateWithWarning(ctx, line, rawTableName, FE_LIMITS.TABLE_NAME, `table "${rawTableName.slice(0, 30)}" name`);

  // Build columns.
  const pkLower = new Set(pkCols.map((c) => c.toLowerCase()));
  const columns: Table['columns'] = [];
  const colByLower = new Map<string, number>();
  for (const pc of parsedCols) {
    const nameCapped = truncateWithWarning(ctx, line, pc.name, FE_LIMITS.COLUMN_NAME, `column "${pc.name.slice(0, 30)}" name`);
    let typeStr = pc.rawType.trim() === '' ? 'TEXT' : pc.rawType.trim();
    // Inline ENUM('a','b') type → normalize to enum('a','b').
    const typeHead = (peekWord(typeStr, 0) ?? '').toLowerCase();
    if (typeHead === 'enum') {
      const pIdx = typeStr.indexOf('(');
      if (pIdx !== -1) {
        const closeP = findMatchingParen(typeStr, pIdx);
        if (closeP !== -1) {
          const labels = extractEnumLabels(typeStr.slice(pIdx + 1, closeP));
          if (labels.length > 0) typeStr = enumTypeString(labels);
        }
      }
    }
    const typeCapped = truncateWithWarning(
      ctx,
      line,
      typeStr,
      FE_LIMITS.COLUMN_TYPE,
      `column "${nameCapped.value}" type`,
    );
    let defCapped: string | null = null;
    if (pc.default !== null && pc.default.trim() !== '') {
      defCapped = truncateWithWarning(ctx, line, pc.default.trim(), FE_LIMITS.COLUMN_DEFAULT, `column "${nameCapped.value}" default`).value;
    }
    const isPk = pc.primaryKey || pkLower.has(pc.name.toLowerCase());
    // SERIAL -> basis integer + flag autoincrement (round-trip dengan ddl-export).
    const serialMatch = typeCapped.value.trim().match(/^(smallserial|serial|bigserial)(\s*\(.*\))?$/i);
    const serialBase =
      serialMatch != null
        ? ({ smallserial: 'SMALLINT', serial: 'INTEGER', bigserial: 'BIGINT' } as Record<string, string>)[
            serialMatch[1]!.toLowerCase()
          ]!
        : null;
    columns.push({
      id: newId(),
      name: nameCapped.value,
      type: serialBase ?? typeCapped.value,
      nullable: isPk ? false : pc.nullable,
      primaryKey: isPk,
      autoincrement: serialBase != null,
      default: defCapped,
      comment: '',
    });
    const lk = nameCapped.value.toLowerCase();
    if (!colByLower.has(lk)) colByLower.set(lk, columns.length - 1);
    void colByLower;
  }

  // Warn unknown PK columns.
  const colLowerSet = new Set(columns.map((c) => c.name.toLowerCase()));
  for (const pk of pkCols) {
    if (!colLowerSet.has(pk.toLowerCase())) {
      warn(ctx, line, `unknown primary key column "${pk}" in table "${tNameCapped.value}" skipped`);
    }
  }

  // Build table.
  const table: Table = {
    id: newId(),
    createdAt: ctx.now,
    updatedAt: ctx.now,
    name: tNameCapped.value,
    comment: '',
    columns,
    indexes: [],
  };

  // Column-level UNIQUE → indexes.
  for (const pc of parsedCols) {
    if (!pc.unique) continue;
    // Match to capped column name (case-insensitive).
    const found = columns.find((c) => c.name.toLowerCase() === pc.name.toLowerCase());
    const colName = found ? found.name : pc.name;
    const expr = `unique:${colName}`;
    const capped = truncateWithWarning(ctx, line, expr, FE_LIMITS.INDEX, 'index');
    table.indexes.push(capped.value);
  }
  // Table-level UNIQUE → indexes.
  for (const cols of tableUniques) {
    const resolved = cols.map((c) => {
      const found = columns.find((cc) => cc.name.toLowerCase() === c.toLowerCase());
      return found ? found.name : c;
    });
    const expr = `unique:${resolved.join(', ')}`;
    const capped = truncateWithWarning(ctx, line, expr, FE_LIMITS.INDEX, 'index');
    table.indexes.push(capped.value);
  }

  ctx.tables.push(table);
  ctx.byLower.set(table.name.toLowerCase(), table);
  ctx.tableLines.set(table.id, line);

  // Queue inline FKs (resolved later; orphans warned then).
  for (const fk of inlineFks) {
    if (!fk.fromCol || fk.fromCol.trim() === '' || !fk.toTable || fk.toTable.trim() === '') {
      warn(ctx, line, `foreign key in table "${table.name}" skipped (missing endpoint)`);
      continue;
    }
    if (!fk.toCol || fk.toCol.trim() === '') {
      warn(ctx, line, `foreign key "${fk.fromCol}" in table "${table.name}" skipped (missing reference column)`);
      continue;
    }
    ctx.pendingFks.push({
      fromTable: table.name,
      fromCols: [fk.fromCol],
      toTable: fk.toTable,
      toCols: [fk.toCol],
      onDeleteRaw: fk.onDeleteRaw,
      line,
    });
  }

  return 'ok';
}

function parseCreateIndexStmt(stmt: string, line: number, ctx: Ctx): 'ok' | 'unparsable' {
  let i = skipWsAndComments(stmt, 0);
  if (matchWordAt(stmt, i, 'create') === null) return 'unparsable';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'create') as number));
  let unique = false;
  if (matchWordAt(stmt, i, 'unique') !== null) {
    unique = true;
    i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'unique') as number));
  }
  if (matchWordAt(stmt, i, 'index') === null) return 'unparsable';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'index') as number));
  // Optional CONCURRENTLY.
  if (matchWordAt(stmt, i, 'concurrently') !== null) {
    i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'concurrently') as number));
  }
  const ifne = matchPhrase(stmt, i, ['if', 'not', 'exists']);
  if (ifne !== null) i = ifne;
  // Index name is optional in Postgres (`CREATE INDEX ON t (c)` auto-names).
  // Only consume it when followed by ON — otherwise it IS the ON keyword.
  const nameMark = i;
  const nameDotted = parseDottedIdents(stmt, i);
  if (nameDotted) {
    const afterName = skipWsAndComments(stmt, nameDotted.next);
    if (matchWordAt(stmt, afterName, 'on') !== null) i = nameDotted.next;
    else i = nameMark;
  }
  i = skipWsAndComments(stmt, i);
  if (matchWordAt(stmt, i, 'on') === null) return 'unparsable';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'on') as number));
  // Optional ONLY + table name.
  if (matchWordAt(stmt, i, 'only') !== null) {
    i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'only') as number));
  }
  const tbl = parseDottedIdents(stmt, i);
  if (!tbl || tbl.parts.length === 0) return 'unparsable';
  const tableName = tbl.parts[tbl.parts.length - 1]!;
  i = skipWsAndComments(stmt, tbl.next);
  // Optional USING method.
  if (matchWordAt(stmt, i, 'using') !== null) {
    let k = matchWordAt(stmt, i, 'using') as number;
    const mname = peekWord(stmt, k);
    if (mname) k = skipWsAndComments(stmt, k) + mname.length;
    i = k;
  }
  i = skipWsAndComments(stmt, i);
  if (stmt[i] !== '(') return 'unparsable';
  const close = findMatchingParen(stmt, i);
  if (close === -1) return 'unparsable';
  const inner = stmt.slice(i + 1, close);
  const tokens = splitTopLevelCommas(inner)
    .map((t) => t.trim())
    .filter((t) => t !== '');
  if (tokens.length === 0) return 'unparsable';
  // Strip trailing WHERE predicate after parens — already outside, ignore.
  const expr = tokens.join(', ');
  const full = unique ? `unique:${expr}` : expr;
  const capped = truncateWithWarning(ctx, line, full, FE_LIMITS.INDEX, 'index');
  ctx.pendingIndexes.push({ table: tableName, expr: capped.value, line });
  return 'ok';
}

function parseAlterTableStmt(stmt: string, line: number, ctx: Ctx): 'ok' | 'unsupported' | 'unparsable' {
  let i = skipWsAndComments(stmt, 0);
  if (matchWordAt(stmt, i, 'alter') === null) return 'unparsable';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'alter') as number));
  if (matchWordAt(stmt, i, 'table') === null) return 'unparsable';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'table') as number));
  const ifex = matchPhrase(stmt, i, ['if', 'exists']);
  if (ifex !== null) i = ifex;
  if (matchWordAt(stmt, i, 'only') !== null) {
    i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'only') as number));
  }
  const tbl = parseDottedIdents(stmt, i);
  if (!tbl) return 'unparsable';
  const tableName = tbl.parts[tbl.parts.length - 1]!;
  i = skipWsAndComments(stmt, tbl.next);
  // Optional ONLY (...)? no. Expect ADD.
  if (matchWordAt(stmt, i, 'add') === null) return 'unsupported';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'add') as number));
  // Optional CONSTRAINT [name].
  if (matchWordAt(stmt, i, 'constraint') !== null) {
    let k = matchWordAt(stmt, i, 'constraint') as number;
    k = skipWsAndComments(stmt, k);
    const w = peekWord(stmt, k);
    const isKw = w && ['foreign', 'primary', 'unique', 'check'].includes(w.toLowerCase());
    if (!isKw) {
      // Optional constraint name — bare or quoted ("fk x", `fk`, [fk]).
      const id = parseIdentAt(stmt, k);
      if (id) k = id.next;
    }
    i = k;
  }
  i = skipWsAndComments(stmt, i);
  if (matchWordAt(stmt, i, 'foreign') === null) return 'unsupported';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'foreign') as number));
  if (matchWordAt(stmt, i, 'key') === null) return 'unparsable';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'key') as number));
  const fromList = parseParenIdentList(stmt, i);
  if (!fromList || fromList.names.length === 0) return 'unparsable';
  i = skipWsAndComments(stmt, fromList.next);
  if (matchWordAt(stmt, i, 'references') === null) return 'unparsable';
  const tgt = parseReferencesTarget(stmt, (matchWordAt(stmt, i, 'references') as number));
  if (!tgt || !tgt.toTable) return 'unparsable';
  // Extract full to-list for composite support.
  let toNames: string[] = [];
  {
    // Re-derive from raw: find REFERENCES parens.
    const refPos = stmt.toLowerCase().indexOf('references', fromList.next);
    if (refPos !== -1) {
      const rp = stmt.indexOf('(', refPos);
      // Ensure this '(' belongs to REFERENCES (before ON...). Find matching and check.
      if (rp !== -1) {
        const before = stmt.slice(refPos, rp);
        if (!/\bon\b/i.test(before)) {
          const rc = findMatchingParen(stmt, rp);
          if (rc !== -1) {
            toNames = splitTopLevelCommas(stmt.slice(rp + 1, rc))
              .map((t) => t.trim())
              .filter((t) => t !== '')
              .map((t) => parseIdentAt(t, 0)?.name ?? t.split(/\s+/)[0]!);
          }
        }
      }
    }
    if (toNames.length === 0 && tgt.toCol) toNames = [tgt.toCol];
  }
  if (toNames.length === 0) {
    warn(ctx, line, `foreign key in table "${tableName}" skipped (missing reference column)`);
    return 'ok';
  }
  if (fromList.names.length !== toNames.length) {
    if (fromList.names.length === 1) {
      // Single from-col with single to-col already; mismatch only when multi.
      // Fall through pairwise only if equal; else warn.
    }
    if (fromList.names.length !== toNames.length) {
      warn(ctx, line, `composite foreign key in table "${tableName}" skipped (column count mismatch)`);
      return 'ok';
    }
  }
  ctx.pendingFks.push({
    fromTable: tableName,
    fromCols: fromList.names,
    toTable: tgt.toTable,
    toCols: toNames,
    onDeleteRaw: tgt.onDeleteRaw,
    line,
  });
  return 'ok';
}

function parseCommentStmt(stmt: string, line: number, ctx: Ctx): 'ok' | 'unsupported' | 'unparsable' {
  let i = skipWsAndComments(stmt, 0);
  if (matchWordAt(stmt, i, 'comment') === null) return 'unparsable';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'comment') as number));
  if (matchWordAt(stmt, i, 'on') === null) return 'unparsable';
  i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'on') as number));
  const w = peekWord(stmt, i);
  if (!w) return 'unparsable';
  const lw = w.toLowerCase();
  if (lw === 'table') {
    i = skipWsAndComments(stmt, i + w.length);
    const dotted = parseDottedIdents(stmt, i);
    if (!dotted) return 'unparsable';
    const tableName = dotted.parts[dotted.parts.length - 1]!;
    i = skipWsAndComments(stmt, dotted.next);
    if (matchWordAt(stmt, i, 'is') === null) return 'unparsable';
    i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'is') as number));
    let comment = '';
    if (matchWordAt(stmt, i, 'null') !== null) {
      comment = '';
      i = matchWordAt(stmt, i, 'null') as number;
    } else {
      const lit = parseStringLiteralAt(stmt, i);
      if (!lit) return 'unparsable';
      comment = lit.value;
      i = lit.next;
    }
    const capped = truncateWithWarning(ctx, line, comment, FE_LIMITS.TABLE_COMMENT, `table "${tableName}" comment`);
    ctx.pendingTableComments.push({ table: tableName, comment: capped.value, line });
    return 'ok';
  }
  if (lw === 'column') {
    i = skipWsAndComments(stmt, i + w.length);
    const dotted = parseDottedIdents(stmt, i);
    if (!dotted || dotted.parts.length < 2) return 'unparsable';
    const col = dotted.parts[dotted.parts.length - 1]!;
    const tbl = dotted.parts[dotted.parts.length - 2]!;
    i = skipWsAndComments(stmt, dotted.next);
    if (matchWordAt(stmt, i, 'is') === null) return 'unparsable';
    i = skipWsAndComments(stmt, (matchWordAt(stmt, i, 'is') as number));
    let comment = '';
    if (matchWordAt(stmt, i, 'null') !== null) {
      comment = '';
    } else {
      const lit = parseStringLiteralAt(stmt, i);
      if (!lit) return 'unparsable';
      comment = lit.value;
    }
    const capped = truncateWithWarning(ctx, line, comment, FE_LIMITS.COLUMN_COMMENT, `column "${col}" comment`);
    ctx.pendingColumnComments.push({ table: tbl, column: col, comment: capped.value, line });
    return 'ok';
  }
  return 'unsupported';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function fromDDL(input: string): DDLImport {
  const warnings: DDLWarning[] = [];
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
      pendingIndexes: [],
      pendingTableComments: [],
      pendingColumnComments: [],
    };

    let statements: RawStatement[];
    try {
      statements = splitStatements(input);
    } catch {
      return { tables: [], relations: [], warnings: [] };
    }
    if (statements.length === 0) return { tables: [], relations: [], warnings: [] };

    for (const st of statements) {
      const stmt = st.text;
      const line = st.line;
      try {
        const first = (peekWord(stmt, 0) ?? '').toLowerCase();
        if (first === 'create') {
          const second = (() => {
            let k = skipWsAndComments(stmt, 0);
            const cM = matchWordAt(stmt, k, 'create');
            if (cM === null) return '';
            k = skipWsAndComments(stmt, cM);
            // Skip table modifiers: CREATE [TEMP|UNLOGGED|...] TABLE / CREATE [UNIQUE] INDEX.
            for (let g = 0; g < 4; g += 1) {
              const w = (peekWord(stmt, k) ?? '').toLowerCase();
              if (w === 'temp' || w === 'temporary' || w === 'unlogged' || w === 'global' || w === 'local') {
                const ww = peekWord(stmt, k) ?? '';
                k = skipWsAndComments(stmt, k) + ww.length;
                continue;
              }
              return w;
            }
            return (peekWord(stmt, k) ?? '').toLowerCase();
          })();
          if (second === 'table') {
            const r = parseCreateTableStmt(stmt, line, ctx);
            if (r === 'unparsable') warn(ctx, line, `unparsable CREATE TABLE skipped`);
            continue;
          }
          if (second === 'type') {
            const r = parseCreateTypeStmt(stmt, line, ctx);
            if (r === 'unsupported') warn(ctx, line, `unsupported CREATE TYPE skipped`);
            else if (r === 'unparsable') warn(ctx, line, `unparsable CREATE TYPE skipped`);
            continue;
          }
          if (second === 'index' || second === 'unique') {
            // CREATE UNIQUE INDEX → second is 'unique'; also plain CREATE INDEX.
            const r = parseCreateIndexStmt(stmt, line, ctx);
            if (r === 'unparsable') warn(ctx, line, `unparsable CREATE INDEX skipped`);
            continue;
          }
          warn(ctx, line, `unsupported ${kindOf(stmt)} skipped`);
          continue;
        }
        if (first === 'alter') {
          const r = parseAlterTableStmt(stmt, line, ctx);
          if (r === 'unsupported') warn(ctx, line, `unsupported ${kindOf(stmt)} skipped`);
          else if (r === 'unparsable') warn(ctx, line, `unparsable ALTER TABLE skipped`);
          continue;
        }
        if (first === 'comment') {
          const r = parseCommentStmt(stmt, line, ctx);
          if (r === 'unsupported') warn(ctx, line, `unsupported ${kindOf(stmt)} skipped`);
          else if (r === 'unparsable') warn(ctx, line, `unparsable COMMENT skipped`);
          continue;
        }
        warn(ctx, line, `unsupported ${kindOf(stmt)} skipped`);
      } catch {
        warn(ctx, line, `unparsable statement skipped`);
      }
    }

    // -- Phase 2: resolve enum-typed columns (handles CREATE TYPE after CREATE TABLE) --
    try {
      for (const t of ctx.tables) {
        for (const c of t.columns) {
          const key = enumLookupKey(c.type);
          if (key === '') continue;
          // Skip if already normalized enum(...) form.
          if (c.type.trim().toLowerCase().startsWith('enum(') || c.type.trim().toLowerCase().startsWith('enum ')) {
            continue;
          }
          const labels = ctx.enums.get(key);
          if (labels) {
            const expanded = enumTypeString(labels);
            const ownerLine = ctx.tableLines.get(t.id) ?? 1;
            const capped = truncateWithWarning(ctx, ownerLine, expanded, FE_LIMITS.COLUMN_TYPE, `column "${c.name}" type`);
            c.type = capped.value;
          }
        }
      }
    } catch {
      // ignore enum resolution errors — keep raw types
    }

    // -- Phase 3: COMMENT ON resolution --
    for (const pc of ctx.pendingTableComments) {
      const t = ctx.byLower.get(pc.table.toLowerCase());
      if (!t) {
        warn(ctx, pc.line, `comment on unknown table "${pc.table}" skipped`);
        continue;
      }
      t.comment = pc.comment;
      t.updatedAt = ctx.now;
    }
    for (const pc of ctx.pendingColumnComments) {
      const t = ctx.byLower.get(pc.table.toLowerCase());
      if (!t) {
        warn(ctx, pc.line, `comment on unknown table "${pc.table}" skipped`);
        continue;
      }
      const col = t.columns.find((c) => c.name.toLowerCase() === pc.column.toLowerCase());
      if (!col) {
        warn(ctx, pc.line, `comment on unknown column "${pc.table}.${pc.column}" skipped`);
        continue;
      }
      col.comment = pc.comment;
    }

    // -- Phase 4: CREATE INDEX resolution --
    for (const pi of ctx.pendingIndexes) {
      const t = ctx.byLower.get(pi.table.toLowerCase());
      if (!t) {
        warn(ctx, pi.line, `index on unknown table "${pi.table}" skipped`);
        continue;
      }
      t.indexes.push(pi.expr);
    }

    // -- Phase 5: FK → Relation resolution --
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
        warn(ctx, fk.line, `foreign key "${fk.fromTable}.${fk.fromCols[0] ?? ''}" skipped (unknown table)`);
        continue;
      }
      const pairs: Array<[string, string]> = [];
      let orphan = false;
      for (let idx = 0; idx < fk.fromCols.length; idx += 1) {
        const fc = fk.fromCols[idx]!;
        const tc = fk.toCols[idx] ?? fk.toCols[0]!;
        if (!fc || !tc) {
          orphan = true;
          break;
        }
        const fromId = colMaps.get(fromT.id)?.get(fc.toLowerCase());
        const toId = colMaps.get(toT.id)?.get(tc.toLowerCase());
        if (!fromId || !toId) {
          orphan = true;
          break;
        }
        pairs.push([fromId, toId]);
      }
      if (orphan || pairs.length === 0) {
        warn(
          ctx,
          fk.line,
          `foreign key "${fk.fromTable}.${fk.fromCols[0] ?? ''}" skipped (unknown column)`,
        );
        continue;
      }
      const norm = normalizeOnDelete(fk.onDeleteRaw);
      if (norm.unknown) {
        warn(ctx, fk.line, `unknown ON DELETE "${fk.onDeleteRaw}" defaulted to restrict`);
      }
      for (const [fromColId, toColId] of pairs) {
        relations.push({
          id: newId(),
          createdAt: ctx.now,
          updatedAt: ctx.now,
          fromTableId: fromT.id,
          fromColumnId: fromColId,
          toTableId: toT.id,
          toColumnId: toColId,
          cardinality: '1:N',
          onDelete: norm.value,
        });
      }
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
