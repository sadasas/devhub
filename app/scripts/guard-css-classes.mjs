// Guard: design-token compliance untuk kelas *-title/*-label.
// Latar: audit 2026-09 menemukan ±140 kelas judul/label ad-hoc tanpa token
// (profil 13px vs project 15px untuk peran identik, 4 definisi micro-label
// nyaris sama, varian panel --primary/--secondary). Keputusan:
// docs/03-engineering/design-tokens.md adalah satu-satunya sumber kebenaran.
// Guard ini menggagalkan build bila:
//   1. Jangkar kanonis hilang (token CSS terhapus tak sengaja), atau
//   2. Kelas *-title/*-label BARU muncul di luar allowlist di bawah, atau
//   3. Pola anti yang sudah dimatikan bangkit lagi (denylist), atau
//   4. Nilai font-size px BARU muncul di luar tangga token (allowlist sempit
//      ke canonical 9/10.5/11/12/13/14/15/17/22–24 seiring migrasi per area).
// Cara menambah kelas yang sah: daftarkan di ALLOWLIST + dokumen token
// dalam PR yang sama, lalu guard lolos lagi.
// Jalan: node app/scripts/guard-css-classes.mjs (lihat package.json guard:css).
// Hex/spacing/radius/border/btn: mode warn (exit 0); flag --strict untuk gagal-build (aktivasi masa depan).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(root, '..');
const cssFile = path.join(appDir, 'src', 'styles', 'global.css');

// Kelas yang BOLEH ada (inventarisasi 2026-09-14, grandfathered).
// Migrasi per area akan MENGECILKAN daftar ini menuju token kanonis —
// jangan memperbesarnya tanpa memperbarui design-tokens.md.
export const ALLOWLIST = new Set(
  'about-card-title about-stat-title api-col-labels api-docs-group-title api-req-label api-title-input api-tree-group-label api-tree-item-title auth-form-title bar-label bento-stat-label billing-card-title billing-empty-title billing-redirect-subtitle billing-redirect-title chat-chip-label chat-drawer-title chat-inline-title checkbox-label code-block-label composer-title consent-title consent-toggle-title context-decision-title dag-card-title dag-layer-title dashboard__members-title dashboard__onboarding-title dashboard__settings-section-title dashboard__settings-section-title--danger dashboard__settings-stat-label dashboard__settings-title dashboard__title-row data-row-title detail-label detail-subtitle detail-title diff-section-title docs-card-title docs-config-card-label docs-diagram-label docs-phase-title docs-section-title docs-step-subtitle docs-step-title docs-toc-title donut-label dp-title due-cal-mini-card-title due-cal-mini-list-title due-cal-strip-label due-cal-task-title editable-field-title empty-state-title erd-canvas-mode-title erd-col-tip-label erd-group-label erd-panel-rel-label erd-panel-subtitle erd-panel-title erd-rail-label erd-table-title field-label field-label-row form-section-title is-collapsed-label kanban-col-label kanban-swipe-tab-label legal-toc-title mention-option-title milestone-group-title modal-title more-item-label overview-group-title page-subtitle page-title palette-item-label palette-item-title panel-title preview-label preview-title pricing-checkout-title pricing-compare-card-title pricing-compare-title pricing-duration-label pricing-section-label pricing-title pricing-workspace-label profile-github-stat-label profile-heat-daylabel profile-panel-title profile-panel-title--primary profile-stat-label project-card-title project-title-row prop-label prop-label-btn prop-label-text prop-pop-label ref-picker-title release-flow-check-label row-title-text schema-side-collapsed-label section-title segmented-label settings-action-title share-tab-label sheet-section-label sheet-section-title sheet-title sidebar-global-divider__label sidebar-item-label sidebar-team-label snapshot-banner-label snapshot-indexes-label sort-control-label sort-menu-section-label ss-option-label stack-graph-hub-label stack-graph-node-label stat-card-title sub-tab-label task-activity-title task-card-labels task-card-title task-label task-label-more team-workspace__title timeline-card-title tooltip-title tour-popover-title usage-meter-label versions-title-row wb-board-title wb-edge-label wb-inspector-empty-title wb-inspector-title wb-layer-kind-label wb-layer-label wb-layers-title wb-shape-label welcome-command-label welcome-command-label-text welcome-empty-title welcome-queue-title welcome-row-title ws-option-label zero-team-steps-title'.split(
    ' ',
  ),
);

// Task Template (2026-09-16): cermin skeleton baris Template — dimensi milik
// modul (Tier-2), didaftar eksplisit agar guard *-title tidak menolaknya.
ALLOWLIST.add('template-skeleton-title');

// Jangkar kanonis — bila salah satunya hilang, sistem token rusak.
export const REQUIRED_ANCHORS = [
  '.profile-panel-title',
  '.theme-segmented',
  '.theme-segmented-btn',
  '.btn-sm.btn-icon',
  '.settings-row-group',
  '.btn.btn-icon svg',
];

// Pola yang sudah dimatikan — bangkit lagi = regresi keputusan tercatat.
export const DENYLIST = ['profile-panel--secondary', 'profile-panel-subtitle'];

export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

export function extractTitleLabelClasses(css) {
  const found = new Set();
  for (const m of stripComments(css).matchAll(/\.[A-Za-z0-9_-]*(?:title|label)[A-Za-z0-9_-]*/g)) {
    found.add(m[0].slice(1));
  }
  return found;
}

// Nilai font-size px yang BOLEH ada (inventarisasi 2026-09-14, grandfathered:
// 24 nilai, dari 8px badge-mini sampai 48px display). Migrasi per area akan
// MELIPAT nilai drift (12.5/11.5/13.5/…) ke tangga kanonis
// (9/10.5/11/12/13/14/15/17/22–24, lihat design-tokens.md §2) sehingga daftar
// ini menyusut — jangan menambah nilai baru tanpa memperbarui dokumen.
export const FONT_SIZE_ALLOWLIST = new Set(
  '8 9 9.5 10 10.5 11 11.5 12 12.5 13 13.5 14 15 16 17 18 19 20 22 24 26 28 30 36 48'.split(' '),
);

export function extractFontSizes(css) {
  const found = new Set();
  const clean = stripComments(css);
  for (const decl of clean.matchAll(/font-size\s*:([^;{}]+);/g)) {
    for (const m of decl[1].matchAll(/([\d.]+)px/g)) found.add(m[1]);
  }
  return found;
}

export function findViolations(css) {
  const violations = [];
  for (const anchor of REQUIRED_ANCHORS) {
    if (!css.includes(anchor)) violations.push(`jangkar kanonis hilang: ${anchor}`);
  }
  for (const found of extractTitleLabelClasses(css)) {
    if (!ALLOWLIST.has(found)) {
      violations.push(
        `kelas baru di luar token: .${found} — daftarkan di ALLOWLIST + docs/03-engineering/design-tokens.md`,
      );
    }
  }
  for (const banned of DENYLIST) {
    if (css.includes(banned)) violations.push(`pola mati bangkit lagi: ${banned} (lihat design-tokens.md §3)`);
  }
  for (const size of extractFontSizes(css)) {
    if (!FONT_SIZE_ALLOWLIST.has(size)) {
      violations.push(
        `font-size baru di luar tangga token: ${size}px — lipat ke tangga kanonis (design-tokens.md §2) atau daftarkan di FONT_SIZE_ALLOWLIST`,
      );
    }
  }
  return violations;
}


// Token-warning inventory (warn-first, lihat design-tokens pasal 7/8).
// Hex/spacing dilaporkan sebagai WARNING (exit 0) sampai migrasi per area
// selesai; flag --strict mengubahnya jadi FAIL (aktivasi masa depan).
export const SPACING_SCALE = new Set([0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 48].map(String));

// Domain warna SAH pasal 8 (bukan drift) — dikecualikan dari warn.
// - File: karya brand/ilustrasi tetap (Logo, DoodleIllustration).
// - Nilai: palet konten kanvas whiteboard + varian tooltip live+ter-test.
//   Kemiripan dengan token UI adalah kebetulan (§8); hex fixture di luar
//   daftar ini (mis. #8b5cf6/#22c55e di McpDocsPage) tetap di-warn sampai
//   keputusan owner. Jangan tambah diam-diam.
export const HEX_FILE_ALLOWLIST = new Set([
  'src/components/Logo.tsx',
  'src/components/DoodleIllustration.tsx',
]);

export const HEX_VALUE_ALLOWLIST = new Set([
  '#e4e4e7',
  '#6ea8fe',
  '#e8b955',
  '#34c38e', // legacy: klasifikasi isLightFill konten lama (default baru = accent)
  '#5db69b', // accent suksesor #34c38e (keputusan owner 2026-09-15) — swatch palet kanvas
  '#a78bfa',
  '#f2b8c6',
  '#f4706d',
  '#1a1a1a', // kanvas: default warna teks sticky + fallback rgba (ColorPalette/Inspector/EditorShell)
  '#06251a', // kanvas: swatch hijau gelap palet konten (ColorPalette)
]);

// Radius/border/btn-size/ghost/inline inventory (warn-first, pasal 7/8/9).
// - Radius: nilai mentah (tanpa var) di border-radius = drift; 0 dan var() lolos.
//   50% DILARANG (gunakan pill); 2/3px -> xs; 10px -> 8/12; 4/6/8/12/16/999px -> var.
// - Border: width HANYA 1px; rgba() mentah -> token *-dim (hex ditangani extractor hex).
// - Tombol: className statis berisi btn tanpa btn-sm/md/icon = temuan review (pasal 9).
// - Ghost var var(--danger|--warning|--success-bg|--success-fg) = FAIL (pasal 8,
//   tidak ada di tokens.css; gunakan status-*). Regex menuntut ')' sehingga
//   var(--status-danger) tidak tertangkap.
// - Inline style={{}} TSX = WARN per file (pasal 7; btn-icon-wrap tersanksi dikecualikan).
// - SENGAJA TANPA transition guard (butuh triase ADR per kasus).
export function extractOffScaleRadius(css) {
  const bad = new Map();
  for (const decl of stripComments(css).matchAll(/border-radius\s*:([^;{}]+)(?=[;}])/g)) {
    const v = decl[1].trim();
    if (v === "0" || v.indexOf("var(") !== -1) continue;
    bad.set(v, (bad.get(v) || 0) + 1);
  }
  return bad;
}

export function extractOffWidthBorder(css) {
  const bad = new Map();
  const clean = stripComments(css);
  const re = /(?:^|[;{}])\s*border(?:-(?:top|right|bottom|left|width|color))?\s*:([^;{}]+)(?=[;}])/gm;
  for (const decl of clean.matchAll(re)) {
    for (const m of decl[1].matchAll(/([\d.]+)px/g)) {
      if (m[1] !== "1") bad.set(m[1], (bad.get(m[1]) || 0) + 1);
    }
  }
  return bad;
}

export function extractRawBorderColor(css) {
  const bad = new Map();
  const clean = stripComments(css);
  const re = /(?:^|[;{}])\s*border(?:-(?:top|right|bottom|left|width|color))?\s*:([^;{}]+)(?=[;}])/gm;
  for (const decl of clean.matchAll(re)) {
    for (const m of decl[1].matchAll(/rgba?\([^)]+\)/g)) {
      const k = m[0].replace(/\s+/g, "");
      bad.set(k, (bad.get(k) || 0) + 1);
    }
  }
  return bad;
}

export function extractUnsizedButtons(tsxSources) {
  const hit = [];
  for (const s of tsxSources) {
    if (s.file.endsWith(".test.tsx")) continue;
    const re = /className=(["'])(.*?)\1/g;
    let m;
    while ((m = re.exec(s.src))) {
      if (m[2].indexOf("$") !== -1) continue;
      const cls = m[2].split(/\s+/);
      const sized = cls.indexOf("btn-sm") !== -1 || cls.indexOf("btn-md") !== -1 || cls.indexOf("btn-icon") !== -1;
      if (cls.indexOf("btn") !== -1 && !sized) {
        hit.push({ file: s.file, cls: m[2] });
        break;
      }
    }
  }
  return hit;
}

export function extractHardcodedHex(css) {
  const found = new Map();
  for (const m of stripComments(css).matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
    const k = m[0].toLowerCase();
    if (HEX_VALUE_ALLOWLIST.has(k)) continue;
    found.set(k, (found.get(k) || 0) + 1);
  }
  return found;
}

// Cakupan: properti margin/padding/gap (+row-gap/column-gap) saja.
// border-width sengaja TIDAK dipindai (§7: border HANYA 1px, aturan sendiri).
export function extractOffScaleSpacing(css) {
  const bad = new Map();
  const clean = stripComments(css);
  const re = /(?:^|[;{}])\s*(?:margin|padding|row-gap|column-gap|gap)[^:;{}]*:([^;{}]+)(?=[;}])/gm;
  for (const decl of clean.matchAll(re)) {
    for (const m of decl[1].matchAll(/([\d.]+)px/g)) {
      if (!SPACING_SCALE.has(m[1])) bad.set(m[1], (bad.get(m[1]) || 0) + 1);
    }
  }
  return bad;
}

export function extractTsxHexFiles(tsxSources) {
  const hit = [];
  for (const s of tsxSources) {
    if (s.file.endsWith('.test.tsx')) continue;
    if (HEX_FILE_ALLOWLIST.has(s.file.replace(/\\/g, '/'))) continue;
    const seen = new Set();
    for (const m of s.src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const hex = m[0].toLowerCase();
      if (HEX_VALUE_ALLOWLIST.has(hex)) continue;
      if (!seen.has(hex)) {
        seen.add(hex);
        hit.push({ file: s.file, hex });
      }
    }
  }
  return hit;
}

// Ghost vars (§8): var(--danger|--warning|--success-bg|--success-fg) tidak ada
// di tokens.css — DILARANG, FAIL. Gunakan var(--status-danger|--status-warn|
// --status-success[-soft]). Ditemukan 2026-09 di KeysPage + .activity-deleted;
// dilipat ke status-* (task Koneksi). Regex menuntut ')' tepat setelah nama
// sehingga var(--status-danger) TIDAK ikut tertangkap.
export const GHOST_VAR_RE = /var\(\s*--(danger|warning|success-bg|success-fg)\s*\)/g;

export function extractGhostVars(css) {
  const bad = new Map();
  for (const m of stripComments(css).matchAll(GHOST_VAR_RE)) {
    const k = `var(--${m[1]})`;
    bad.set(k, (bad.get(k) || 0) + 1);
  }
  return bad;
}

export function extractTsxGhostVars(tsxSources) {
  const hit = [];
  for (const s of tsxSources) {
    if (s.file.endsWith('.test.tsx')) continue;
    const seen = new Set();
    for (const m of s.src.matchAll(GHOST_VAR_RE)) {
      const name = `var(--${m[1]})`;
      if (!seen.has(name)) {
        seen.add(name);
        hit.push({ file: s.file, name });
      }
    }
  }
  return hit;
}

// Inline style={{}} di TSX (warn-first, pasal 7): gaya visual WAJIB kelas CSS/
// token agar responsif (media query), ter-guard, dan ikut tema. Dikecualikan
// dari warn: pola btn-icon-wrap inline-flex tersanksi (sizing glyph touch §1,
// Button.tsx + KeysPage empty CTA) — dicek per baris (+1 baris sebelumnya
// untuk JSX multi-baris). Skeleton mirror berdimensi (width/height/Radius
// cermin amount/badge/btn) tetap ter-warn sebagai utang triase per area.
export function extractTsxInlineStyles(tsxSources) {
  const hit = [];
  for (const s of tsxSources) {
    if (s.file.endsWith('.test.tsx')) continue;
    const lines = s.src.split('\n');
    let count = 0;
    lines.forEach((line, i) => {
      if (!line.includes('style={{') && !line.includes('style={')) return;
      const context = (i > 0 ? lines[i - 1] : '') + '\n' + line;
      if (context.includes('btn-icon-wrap')) return;
      count += 1;
    });
    if (count > 0) hit.push({ file: s.file, count });
  }
  return hit;
}

export function findTokenWarnings(css, tsxSources) {
  const warnings = [];
  for (const entry of extractHardcodedHex(css)) {
    warnings.push('hex mentah di global.css: ' + entry[0] + ' (' + entry[1] + 'x) - lipat ke var(--*) atau catat di pasal 8');
  }
  for (const entry of extractOffScaleSpacing(css)) {
    warnings.push('spacing di luar tangga di global.css: ' + entry[0] + 'px (' + entry[1] + 'x) - lipat ke pasal 7');
  }
  for (const h of extractTsxHexFiles(tsxSources)) {
    warnings.push('hex mentah di ' + h.file + ' (' + h.hex + ') - lipat ke var(--*) atau domain pasal 8');
  }
  for (const entry of extractOffScaleRadius(css)) {
    const hint = entry[0].indexOf("50%") !== -1
      ? "DILARANG - gunakan var(--radius-pill) (pasal 7)"
      : "lipat ke var(--radius-*) / tangga pasal 7";
    warnings.push("radius di luar token di global.css: " + entry[0] + " (" + entry[1] + "x) - " + hint);
  }
  for (const entry of extractOffWidthBorder(css)) {
    warnings.push("border-width selain 1px di global.css: " + entry[0] + "px (" + entry[1] + "x) - border HANYA 1px (pasal 7) atau verifikasi + ADR");
  }
  for (const entry of extractRawBorderColor(css)) {
    warnings.push("border rgba() mentah di global.css: " + entry[0] + " (" + entry[1] + "x) - lipat ke token *-dim (pasal 7)");
  }
  for (const h of extractUnsizedButtons(tsxSources)) {
    warnings.push("tombol tanpa size di " + h.file + " (" + h.cls + ") - wajib btn-sm/md/icon (pasal 9)");
  }
  for (const h of extractTsxInlineStyles(tsxSources)) {
    warnings.push("style={{}} inline di " + h.file + " (" + h.count + "x) - pindah ke kelas CSS/token agar ikut tema & media query (pasal 7, warn-first; btn-icon-wrap tersanksi dikecualikan)");
  }
  return warnings;
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
  let css = '';
  try {
    css = readFileSync(cssFile, 'utf8');
  } catch (err) {
    console.error(`[guard:css] FAIL: tidak bisa membaca src/styles/global.css: ${err.message}`);
    process.exit(1);
  }
  const violations = findViolations(css);
  const tsxSources = [];
  // Denylist juga berlaku di TSX (mis. className yang dibangkitkan lagi).
  const srcDir = path.join(appDir, 'src');
  for (const file of walkTsx(srcDir)) {
    let src = '';
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    tsxSources.push({ file: path.relative(appDir, file), src });
    for (const banned of DENYLIST) {
      if (src.includes(banned)) {
        violations.push(`pola mati bangkit lagi: ${banned} di ${path.relative(appDir, file)}`);
      }
    }
  }
  for (const entry of extractGhostVars(css)) {
    violations.push(`ghost var ${entry[0]} di global.css (${entry[1]}x) — tidak ada di tokens.css, gunakan var(--status-*) (pasal 8)`);
  }
  for (const h of extractTsxGhostVars(tsxSources)) {
    violations.push(`ghost var ${h.name} di ${h.file} — tidak ada di tokens.css, gunakan var(--status-*) (pasal 8)`);
  }
  if (violations.length > 0) {
    console.error('[guard:css] FAIL: pelanggaran token desain:');
    for (const v of violations) console.error(`[guard:css]   - ${v}`);
    process.exit(1);
  }
  const strict = process.argv.includes('--strict');
  const warnings = findTokenWarnings(css, tsxSources);
  if (warnings.length > 0) {
    console.error('[guard:css] ' + (strict ? 'FAIL' : 'WARN') + ': ' + warnings.length + ' temuan token (hex/spacing/radius/border/btn) - mode ' + (strict ? 'strict' : 'warn, exit 0') + ':');
    for (const w of warnings.slice(0, 30)) console.error('[guard:css]   - ' + w);
    if (warnings.length > 30) console.error('[guard:css]   ... +' + (warnings.length - 30) + ' lagi');
    if (strict) process.exit(1);
  }
  console.log('[guard:css] OK: jangkar token utuh, tanpa kelas *-title/*-label baru.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
