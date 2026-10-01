// Guard: tooltip wajib untuk tombol icon-only (design-tokens.md §9 `tooltip-icon-btn`).
// Latar: tombol icon-only tanpa label teks tak terbaca maksudnya saat hover
// di desktop — pembaca layar punya aria-label, pengguna sighted tidak.
// Keputusan: docs/03-engineering/design-tokens.md §9 adalah satu-satunya
// sumber kebenaran. Guard ini mewarnai (warn-first, exit 0) bila:
//   1. Tombol <button> mentah berkela `btn-icon` di luar rentang
//      <Tooltip>…</Tooltip> yang seimbang, dan
//   2. Tombol itu tidak terdaftar di ALLOWLIST di bawah.
// Aturan §9 (pengetatan 2026-09-29): komponen <Tooltip> WAJIB — native
// `title=` telanjang (tanpa pembungkus Tooltip) adalah TEMUAN, bukan lolos.
// Rasional: §9 memandatkan komponen Tooltip; title native me-render chrome
// browser tanpa gaya (unstyled). Grandfather clause untuk title telanjang
// EXPIRED.
// Pengecualian §9: tombol tutup/dismiss (×) — aria-label wajib, tooltip
// visual opsional — didaftar eksplisit per file+label di ALLOWLIST.
// Cara menambah pengecualian yang sah: daftarkan di ALLOWLIST + dokumen
// token dalam PR yang sama (Living Rule §5), lalu guard diam lagi.
// Jalan: node app/scripts/guard-icon-buttons.mjs (lihat package.json guard:buttons).
// Mode warn (exit 0) sampai migrasi per area selesai; flag --strict untuk
// gagal-build (aktivasi masa depan) — cermin guard-css-classes.mjs.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(root, '..');
const srcDir = path.join(appDir, 'src');

// Tutup/dismiss (×) — aria-label wajib, tooltip visual opsional (§9).
// Entri eksplisit file+label (9 situs, 8 entri — chat menaungi 2 tombol);
// tambah hanya via keputusan tercatat.
export const ALLOWLIST = [
  { file: 'src/components/BottomSheet.tsx', label: 'action.close' },
  { file: 'src/components/Modal.tsx', label: 'action.close' },
  { file: 'src/components/SaveBanner.tsx', label: 'Dismiss' },
  { file: 'src/features/api/ApiPage.tsx', label: 'common:action.close' },
  { file: 'src/features/project/ProjectChatWidget.tsx', label: 'chat.closeAria' },
  { file: 'src/features/whiteboard/WhiteboardEditorShell.tsx', label: 'whiteboard.canvas.dismissCap' },
  { file: 'src/features/schema/ERDCanvasMode.tsx', label: 'schema.canvas.close' },
  // Present-exit ERD: Tooltip menelan Esc pertama (konflik tiered-Esc, terbukti test) — title= native dipertahankan.
  { file: 'src/features/schema/ERDCanvasMode.tsx', label: 'schema.canvas.exitPresent' },
];

const TOOLTIP_OPEN_RE = /<Tooltip(?=[\s>])/g;
const TOOLTIP_CLOSE_RE = /<\/Tooltip\s*>/g;
const BUTTON_OPEN_RE = /<button\b/g;

// Parser fix 2026-09-29: tag pembuka <button> dipindai PENUH dari `<button`
// sampai `>` penutup tag sambil menghormati quotes (' " `), kedalaman
// `{...}` JSX, dan `=>` — `>` hanya penutup bila quote==null &&
// brace-depth==0 && bukan bagian `=>` (char sebelumnya bukan `=`).
// Latar bug: regex lama `/<button\b[^>]*>/` berhenti di `>` PERTAMA, yaitu di
// dalam `onClick={() => ...}` untuk tombol multi-baris — terpotong sebelum
// `title=` sehingga false positive (kasus: TaskDetail.tsx button buka ~589,
// title= di ~594, ter-flag missing). Depth-counting Tooltip di bawah tak
// berubah; `<Tooltip(?=[\s>])` tetap agar TooltipCard tak terhitung;
// self-closing `<Tooltip … />` tetap tak membuka rentang.
export function buttonTags(src) {
  const out = [];
  for (const m of src.matchAll(BUTTON_OPEN_RE)) {
    const start = m.index;
    let quote = null;
    let depth = 0;
    let end = -1;
    for (let i = start + '<button'.length; i < src.length; i++) {
      const ch = src[i];
      if (quote) {
        if (ch === quote && src[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{') {
        depth += 1;
        continue;
      }
      if (ch === '}') {
        if (depth > 0) depth -= 1;
        continue;
      }
      if (ch === '>') {
        if (src[i - 1] === '=') continue; // `=>` arrow, bukan penutup tag
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    out.push({ index: start, tag: src.slice(start, end + 1) });
  }
  return out;
}

// Rentang <Tooltip>…</Tooltip> yang seimbang via depth-counting open/close
// (bukan lookback rapuh — Tooltip boleh bersarang lewat trigger komposit).
// `<TooltipCard` tidak dihitung (lookahead menuntut spasi/`>` setelah nama).
// Tag self-closing `<Tooltip … />` tidak membuka rentang.
export function tooltipRanges(src) {
  const events = [];
  for (const m of src.matchAll(TOOLTIP_OPEN_RE)) {
    const tagEnd = src.indexOf('>', m.index);
    if (tagEnd === -1) continue;
    if (src[tagEnd - 1] === '/') continue;
    events.push({ index: m.index, kind: 'open' });
  }
  for (const m of src.matchAll(TOOLTIP_CLOSE_RE)) {
    events.push({ index: m.index, kind: 'close', end: m.index + m[0].length });
  }
  events.sort((a, b) => a.index - b.index);
  const ranges = [];
  let depth = 0;
  let start = -1;
  for (const e of events) {
    if (e.kind === 'open') {
      if (depth === 0) start = e.index;
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0) ranges.push([start, e.end]);
    }
  }
  return ranges;
}

export function inRanges(ranges, index) {
  for (const [s, e] of ranges) {
    if (index >= s && index < e) return true;
  }
  return false;
}

export function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

export function findViolations(tsxSources) {
  const violations = [];
  for (const s of tsxSources) {
    if (s.file.endsWith('.test.tsx')) continue;
    const ranges = tooltipRanges(s.src);
    for (const b of buttonTags(s.src)) {
      const tag = b.tag;
      if (tag.indexOf('btn-icon') === -1) continue;
      // §9 pengetatan 2026-09-29: title= telanjang TANPA Tooltip = TEMUAN.
      // Hanya rentang <Tooltip> seimbang atau ALLOWLIST yang meloloskan.
      if (inRanges(ranges, b.index)) continue;
      const rel = s.file.replace(/\\/g, '/');
      if (ALLOWLIST.some((a) => rel === a.file && tag.indexOf(a.label) !== -1)) continue;
      violations.push({ file: rel, line: lineOf(s.src, b.index), hasTitle: /title\s*=/.test(tag) });
    }
  }
  return violations;
}

function walkTsx(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out = walkTsx(full, out);
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function main() {
  const tsxSources = [];
  for (const file of walkTsx(srcDir)) {
    let src = '';
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    tsxSources.push({ file: path.relative(appDir, file), src });
  }
  const violations = findViolations(tsxSources);
  const strict = process.argv.includes('--strict');
  if (violations.length > 0) {
    console.error(
      '[guard:buttons] ' + (strict ? 'FAIL' : 'WARN') + ': ' + violations.length +
      ' tombol icon-only di luar <Tooltip> - mode ' + (strict ? 'strict' : 'warn, exit 0') + ':',
    );
    for (const v of violations.slice(0, 30)) {
      const kind = v.hasTitle ? 'bare title= tanpa <Tooltip>' : 'tanpa <Tooltip>';
      console.error(
        `[guard:buttons]   - ${v.file}:${v.line} — btn-icon ${kind} — ` +
        'bungkus <Tooltip title={sama-dengan-aria-label}> atau daftarkan di ALLOWLIST (tutup/dismiss saja)',
      );
    }
    if (violations.length > 30) console.error('[guard:buttons]   ... +' + (violations.length - 30) + ' lagi');
    if (strict) process.exit(1);
  }
  console.log('[guard:buttons] OK: tombol icon-only ber-<Tooltip> atau terdaftar di ALLOWLIST.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
