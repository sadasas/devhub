# Design Tokens — DevHub

| Field | Value |
|---|---|
| **Document status** | Active |
| **Owner** | Project Owner |
| **Last updated** | 2026-09-15 |
| **Applies to** | All UI code in `app/src` (components, features, styles) |

> Design tokens are the single source of truth for visual values. Any UI work
> (new or fix) MUST use the tokens below. Adding a new hardcoded visual value
> (icon size, title font-size, surface color) without updating this document
> **and** `scripts/guard-css-classes.mjs` in the same PR is a review finding.
> See `AGENTS.md` — UI Token Compliance.

---

## 0. Cakupan: global vs modul

| Tingkat | Isi | Contoh |
|---|---|---|
| Tier 1 — Global, semua modul sama | Primitif visual: tangga teks, ukuran ikon, tombol, surface, divider, target sentuh, i18n, motion | `font-card-title` via `.section-title`, `icon-tab-size`, `btn-sm`, `surface-panel`, `settings-row-group`, 44px touch, `t()` + paritas EN/ID |
| Tier 2 — Per modul, bebas | Komposisi & konten domain: layout, komponen khas, densitas | action-row password, kartu provider OAuth, susunan stat Profile vs Dashboard |

Aturan: modul boleh beda komposisi, tidak boleh beda primitif; pengecualian Tier-1 wajib ADR.

Korolari koran: rubrik olahraga dan ekonomi boleh beda isi dan susunan, tapi tidak boleh beda definisi headline dan kolom.

---

## 1. Icon size tokens

Base font of touch buttons: `.btn-sm` label is 14px on touch
(`global.css` touch block). Glyph numbers below are nominal Phosphor sizes;
rendered strokes are ~2–3px smaller because Phosphor draws with padding
inside its 256 viewBox — so a nominal 16px glyph reads optically next to a
14px label. This is intentional (optical sizing, cf. Apple SF Symbols scales).

| Token | Value | Applies | Rationale / source |
|---|---|---|---|
| `icon-tab-size` | **15px** | All tab-navigation glyphs (project tabs, profile tabs) | Unifies Profile 13px and project 15px (2026-09: same role, two authors). Slight emphasis over 13px labels is standard for nav tabs |
| `icon-stat-size` | **16px** | Statistic-tile glyphs (StatItem + StatTile: icon + label + big value) | Unifies StatTile 15px drift (2026-09); pairs with 12px labels + 24px values |
| `icon-section-title-size` | **14px** | Section-title glyphs (`.section-title`: "Your teams", "Usage", "Connected accounts") | Renamed 2026-09 (was `icon-panel-title-size`); kept 14px — pairs with 14px section titles. Majority Tier-1 glyph: Dashboard/Team settings + Profile + About use it |
| `icon-button-touch` | **18px** | Standalone (icon-only) button glyphs on touch (`hover: none`) | Sole carrier of meaning → bigger. Within Phosphor-for-buttons band 16–20; M3 uses 24/48 (50%), Apple uses larger scale for standalone symbols |
| `icon-button-label-touch` | **16px** | Leading icons of text buttons on touch | Supporting role — label stays primary. Reads optically next to 14px labels |
| Desktop glyphs | Authored per usage (`size={...}`) | All desktop (`hover: hover`) rendering | No global override on desktop; proportions already correct there (13px glyph in 28px box, 18px in 32px). Audit 2026-09: observed range 9–140px across 600+ usages — historical, not normative |

Rules:

- **Trigger rule**: touch sizing applies under `@media (hover: none)`
  (capability, not viewport width). `(hover: hover)` means "primary input
  *can* hover" (mouse/trackpad) and matches permanently on desktop — it is
  NOT the `:hover` state. Narrow desktop windows keep desktop sizes, except
  the combined `@media (hover: none), (max-width: 640px)` rule for
  datepicker/select/sort triggers (small popups stay 44px even with a mouse).
- **Touch boxes** (already global, do not re-implement per component):
  `.btn-sm`/`.btn-icon` → min 44×44px; `.btn-sm.btn-icon` keeps `padding: 0`
  (a later `.btn-sm` padding rule once overrode it and shrank glyphs to 12px
  via `svg { max-width: 100% }` — regression documented 2026-09, do not
  reintroduce padding on icon-only buttons).
- Non-button icons (carets, hints, logos, illustrations) are NOT covered —
  they keep authored sizes.

---

## 2. Typography tokens (v2 — full text scale)

Audit 2026-09 found **24 distinct `font-size` values** project-wide. Since this
system's own rule ties glyphs to adjacent text, text scatter propagates into
icon scatter — so the text scale is the root fix and icons are the symptom.
The canonical scale below is a deliberate **subset** (cf. M3: *"Your product
likely will not need [all] 15 [type] styles"*; Carbon: fixed steps, *"Don't
alter"*), localized to this product whose body text centers on 13px
(M3 centers on 14/16 — hence our numbers run slightly smaller, same structure).

| Token | Value | Role |
|---|---|---|
| `font-badge-mini` | 9px | Mini badges/counts in 18px rows only. Narrow, documented role — do not reuse elsewhere |
| `font-eyebrow` | mono 10.5px, 600, uppercase, ls 0.08em, `text-muted` | Micro-labels ONLY: stat labels, badge/count labels, sheet/sort/filter labels, data-dense micro-labels. NEVER section/panel/card titles (those are `font-card-title`) |
| `font-helper-micro` | 11px, `text-muted`, lh 1.5 (`.field-helper--micro`) | Transient inline status only (e.g. "copied" confirmations). Never labels, errors, or emphasis |
| `font-body-sm` | 12px | Chips, stat labels, helpers, secondary text |
| `font-body` | 13px | Body copy, settings rows, button labels |
| `font-emphasis` | 14px | Key values, small card titles (absorbs 13.5px drift) |
| `font-title-sm` | 15px | Empty-state / step titles (kept per M3 `titleMedium` precedent — NOT folded) |
| `font-card-title` | 14px, 650, `text-primary` | THE section/panel/card title style, via canonical `.section-title` (Profile, About, Dashboard/Team settings, project/timeline/docs-card/dashboard/billing). 650 aligns the Dashboard majority (Geist variable: valid). Deprecated aliases kept converging to it: `.profile-panel-title`, `.dashboard__settings-section-title` |
| `font-section-title` | 17px, 600, `text-primary` | docs-section, preview titles (value unchanged, name unified) |
| `font-display` | 22–30px fluid (`clamp`, mis. `.pricing-price-amount: clamp(22px, 6.2vw, 30px)`) | Stat numerals, hero numbers, fluid display. Batas clamp ikut terdaftar di guard |
| `font-danger` | color-only modifier (`status-danger`) | dashboard danger title, destructive sheet rows |

Fold map for drift values (applied during per-area migration, never big-bang):

| Drift value | Count | Verdict |
|---|---|---|
| 12.5px (61×) | Scattered, no coherent role | Fold to 12 (muted/secondary) or 13 (primary body) per context |
| 11.5px (13×) | Mixed small labels | Fold to 11 or 12 per context |
| 13.5px (10×) | Prose-ish titles | Fold to 14 (`font-emphasis`) |
| 10px mono micro (44×) | Data-dense labels (heatmap, counts) | Open: fold to eyebrow vs lock `font-data-micro` — decided at first area that touches it |
| 8px (1×) | Single micro marker | Keep (one spot, zero impact) |

Hierarchy is monotonic: eyebrow < card-title < section-title in size and
weight. Section titles use natural Title Case from the i18n key (no
`text-transform` in CSS). Uppercase CSS is reserved for eyebrow micro-labels
of ≤3 words (WCAG: no all-caps long text);
i18n keys must not pre-capitalize what CSS uppercases.

Measured contrast baseline (WCAG AA, normal text ≥ 4.5:1 — eyebrow 10.5px
semibold is NOT large-scale, so 4.5 applies). No migration may regress below
these numbers:

| Pair | Light | Dark |
|---|---|---|
| muted on elevated | 4.93 | 5.46 |
| muted on overlay | 5.04 | 5.13 |
| secondary on elevated | 6.66 | 7.50 |
| primary on elevated | 16.62 | 14.48 |

---

## 3. Surface tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `surface-panel` (`bg-elevated`) | `#fffcf8` | `#18181b` | Default panel/card surface |
| `bg-overlay` | `#ffffff` | `#1e1e21` | Floating layers ONLY (menus, sheets, dropdowns) |

History: `profile-panel--secondary` once painted an in-flow panel with
`bg-overlay` (redesign commit `21dc5d6`) — removed 2026-09 as drift. Overlay
is reserved for floating layers.

---

## 4. Touch & responsive rules (summary)

- Touch targets: 44px minimum on `hover: none` (Apple HIG; WCAG 2.5.8 floor
  is 24px). Desktop icon buttons 32px, text buttons 28px — intentional.
- Inputs `font-size: 16px` on touch (blocks iOS auto-zoom).
- Heights: `100dvh` with `100vh` fallback (mobile browser chrome);
  `env(safe-area-inset-*)` for notch/home indicator.
- Viewport thresholds: **640px** = mobile (paired JS+CSS:
  `useIsMobileSheet`, `useIsMobileActions`, calendar `useMediaQuery`);
  **860/861px** = app-shell drawer switch (`Layout.tsx` + CSS);
  **360px** = small-phone guards. `641px`/`861px` are the complements.
- Motion: `prefers-reduced-motion: reduce` disables animation/transitions
  (46 blocks) and JS picks `instant` scrolling; `forced-colors: active` keeps
  structure via `CanvasText` borders; `@media print` owns the API PDF export.

---

## 5. Living rule

1. New token or value change → update this document **and** the guard in the
   same PR (mirrors the repo's shared-types sync rule).
2. Pengecualian Tier-1 tanpa ADR = temuan review; guard + dokumen diperbarui
   dalam PR yang sama.
3. Migration is per area (Profile → Dashboard settings → Billing → …), one
   DevHub task each, with before/after screenshots (light + dark, 360px +
   desktop) and reviewer sign-off before the next area starts.
4. Per-area acceptance criteria: contrast ≥ baseline above; monotonic
   hierarchy; 200% text-zoom reflow without overlap; no touch-target
   shrinkage; heading/role/aria semantics unchanged + keyboard spot-check;
   uppercase only for short labels in both ID and EN.

## 6. Decision log

| Date | Decision |
|---|---|
| 2026-09-14 | Touch glyphs 16 (with text) / 18 (standalone), Option A (buttons only) |
| 2026-09-14 | Header single-row (icon-only Share on mobile); theme+language moved topbar → Profile Preferences + Command Palette |
| 2026-09-14 | Language control = segmented EN\|ID (not icon dropdown); 44px touch segmented buttons |
| 2026-09-14 | Panels unified to `bg-elevated`; titles unified to eyebrow style; settings rows grouped with dividers |
| 2026-09-14 | API-key stat removed from Profile (MCP is OAuth now); backend key infra untouched (separate decision) |
| 2026-09-14 | Tab glyphs unified to `icon-tab-size: 15px`; gradual path agreed (tokens → per-area hardening → full system if needed) |
| 2026-09-14 | Stat glyphs unified to `icon-stat-size: 16px`; panel-title glyphs locked at 13px (role rule: glyph follows adjacent text) |
| 2026-09-14 | `profile-panel-title--primary` removed (last one-off title variant in Profile); `font-helper-micro` token added |
| 2026-09-14 | Full text scale locked v2 (9/10.5/11/12/13/14/15/17/22–24) with fold map for drift values; panel-title glyph rule revised 13→14 (unify upward) |

| 2026-09-15 | §9 kontrol: btn sm/md/icon + aturan sm-settings, divider hairline vs gap, fast/normal + hapus slow mati, fondasi focus-ring |
| 2026-09-15 | §8 palet: 93 hex diaudit; UI dikunci ke var, domain kanvas/brand/tooltip disahkan, antre lipat Board/Auth/Teams/whiteboard; temuan var(--success-bg/fg) hantu di Auth |
| 2026-09-15 | var(--success-bg/fg) hantu dihapus; Auth pakai status-success-soft + status-success (keputusan owner: ganti) |
| 2026-09-15 | #34c38e → accent #5db69b untuk default elemen baru + palet (keputusan owner); #34c38e legacy dipertahankan di isLightFill |
| 2026-09-15 | Profile: `.profile-name` + `.profile-github-stat-value` 20px → 17px (`font-section-title`; keputusan owner) |
| 2026-09-15 | Profile heatmap level 1–3: `rgba(52,195,142,…)` emerald legacy → `color-mix(in srgb, var(--accent) 22/45/72%, transparent)` (keputusan owner); level 0 = `surface-hover`, level 4 = `accent` — skala heatmap kini terdokumentasi di §8, bukan drift |
| 2026-09-15 | Avatar `avatarColor()` hsl disahkan sebagai warna domain Tier-2 (bukan drift UI); radius default `size/2` → `var(--radius-pill)`; Profile melepas `rounded={16}` sehingga avatar 72 menjadi lingkaran penuh |
| 2026-09-15 | Profile heat-cell: `<button>` + `tabIndex` + `role=gridcell` → span non-interaktif `aria-hidden`; container `role=grid` → `role=img` + label (pola donut chart); `.password-toggle` 26px visual + hit-area 44px via `::after`, fokus ikut fondasi §9 |
| 2026-09-16 | Koneksi: ghost `var(--danger)/var(--warning)` → `status-*`; guard FAIL ghost var (CSS+TSX) + WARN inline `style={{}}` per file (btn-icon-wrap tersanksi dikecualikan), 4 test baru pasal 7/8 |
| 2026-09-16 | Template: Modal hapus 2-langkah → `ConfirmDeleteDialog` standar (1-klik + busy/error); inline skeleton/baris dilipat ke `.template-skeleton-*` (radius aksi ikut `--radius-input`); `template-skeleton-title` didaftar di ALLOWLIST |
| 2026-09-15 | Sidebar L1 diratakan: toggle Proyek/Arsip dari header mono uppercase 10.5–11px → item sans 13px (`sidebar-item` + chevron Phosphor, bukan glif ▾/▸); indent 36px + rail `::before` + 12.5px dihapus (project rows = item biasa); `sidebar-team-link` dilepas di Sidebar (tetap untuk ZeroTeam); `archived` opacity 0.65 dihapus (kontras kembali ke baseline) |
| 2026-09-15 | Sidebar: baris proyek (aktif + arsip) indent satu tingkat 24px di bawah toggle Proyek (tangga space-*, font tetap 13px); Anggota/Pengaturan tetap `sidebar-item` murni = selevel Proyek |
| 2026-09-15 | Settings: halaman 1-page → shell 2-pane (sidebar + `?section=` general/plan/usage/danger/github, satu section dirender); nav reuse rank `sidebar-item`, ikon 15px duotone, search + `aria-current`; item GitHub + badge Segera + panel teaser (depan: repo link DEF-013) |
| 2026-09-15 | Panel konten 1 CSS tunggal semua page: override khusus `.dashboard__members/.dashboard__settings` (overflow + padding-bottom 24px) DIHAPUS; seluruh aturan ukuran panel hanya di blok kanonis pcard (flex-fill + tabpanel); terbukti Chromium 1280×720 (settings 640 vs templates 660); board/kanban tanpa pcard tidak tersentuh |
| 2026-09-15 | Settings search: indeks keyword sub-setting per section (`SETTINGS_SUB_KEYS`, label i18n) + hint "Cocok: …" (11px muted) + clear-on-navigate; mis. "url" → Umum |

---

## 7. Spacing, radius & border tokens

Audit 2026-09-15 atas global.css: gap inti sehat (8/6/12/4/10 dominan),
ekor ganjil tersebar (1/3/5/7/9/11/13/18/22/26/28/30/34/36/40/72/84), dan
**14px dipakai 67x namun DILIPAT** (grid 4pt dijaga — keputusan owner).
Radius/border 95% sudah tertoken di tokens.css; sisa residu mentah
dilipat di bawah. Migrasi per area (never big-bang), preseden §2.

| Token | Value | Role |
|---|---|---|
| space-* | 0/2/4/6/8/10/12/16/20/24/32/48 | Satu-satunya nilai padding/margin/gap |
| radius-xs | 4px (--radius-xs) | Elemen mikro (chip inset, marker) |
| radius-sm | 6px (--radius-sm) | Kontrol kecil |
| radius-input | 8px (--radius-input) | Input, tombol, kartu kecil |
| radius-card | 12px (--radius-card) | Panel/kartu default |
| radius-lg | 16px (--radius-lg) | Hero/modal/sheet |
| radius-pill | 999px (--radius-pill) | Pill, avatar lingkaran (ganti 50%) |
| border-hairline | 1px var(--border-hairline) | Border/divider default |
| border-strong | 1px var(--border-strong) | Emfasis, hover |
| border-dashed | 1px dashed hairline | HANYA drop-zone/empty-state |
| border-semantic | 1px var(--status-*) | HANYA makna status/bahaya |

Fold map:

| Drift | Verdict |
|---|---|---|
| 14px spacing (67x) | Fold ke 12/16 per konteks (keputusan tercatat; JANGAN tambah ke tangga) |
| 5/7/9/11/13px | Genap terdekat |
| 18px | 16/20 per konteks |
| 22/26/28/30px | 20/24/32 per konteks |
| 34/36/40/72/84px | 32/48 per konteks |
| radius 2/3px | --radius-xs (4px) |
| radius 10px | 8/12 per konteks |
| radius hardcoded 8/12/16px | var (--radius-input/card/lg) |
| border-radius: 50% | --radius-pill |
| border rgba() mentah | token *-dim yang sesuai |
| 1.5px / 2px / 3px / 5px border-width | Verifikasi kasus dulu (guard: 3px 9x, 2px 5x, 1.5px + 5px masing-masing 1x), baru lipat |

Rules:

- Border width HANYA 1px (kecuali kasus terverifikasi + ADR).
- 50% dilarang untuk radius (gunakan pill).
- Guard memindai (warn-first): margin/padding/gap/row-gap/column-gap (tangga space-*);
  border-radius mentah (50% = DILARANG); border-width selain 1px; rgba() mentah di border.
  Transition SENGAJA tidak dijaga guard (butuh triase ADR per kasus, lihat §9).
- Ghost var `var(--danger|--warning|--success-bg|--success-fg)` = FAIL
  (tidak ada di tokens.css; gunakan `var(--status-*)`); `style={{}}` inline di TSX
  = WARN per file (warn-first; `btn-icon-wrap` tersanksi dikecualikan, skeleton
  mirror berdimensi tercatat sebagai utang triase per area).

---

## 8. Color palette

Audit 2026-09-15: 93 distinct hex di app/src (CSS+TSX). Keluarga UI di
tokens.css (light+dark); sisanya di bawah — disahkan sebagai domain
non-token, atau antre lipat per area. Aturan: kode UI chrome TANPA hex/
rgba mentah baru; semua warna UI via var(--*). color-mix di atas token
diperbolehkan (turunan, bukan warna baru). Sistem forced-colors
(CanvasText dsb.) dikecualikan (a11y).

| Keluarga | Token | Pakai |
|---|---|---|
| surface | bg-base/elevated/overlay(+hover)/inset | §3 |
| text | primary/secondary/muted/on-accent | §2 baseline kontras |
| border | hairline/strong | §7 |
| accent | accent/hover/pressed/dim + accent-ring + text-on-accent | Aksi primer, fokus, link |
| semantic | status-danger/warn/success/info + *-dim + *-soft | Makna status saja |
| chart | chart-1..6 (turunan status) | Grafik; BUKAN hex acak |
| method | method-get/post/put/patch/delete/options + *-dim | Badge metode API |
| card tint | card-blue/mint/cream-soft + *-dim | Tint kartu dekoratif |
| focus | 2px accent-ring (:focus-visible + offset 2px) | Semua kontrol keyboard |
| shadow | shadow-raised/inset-highlight | Overlay/sheet; never neon |

Domain warna SAH di luar token UI (bukan drift):

- **Kanvas whiteboard** (ColorPalette/tools/export/templates + fixture
  McpDocsPage + cermin erd-export): palet konten pilihan user
  (#e4e4e7, #6ea8fe, #e8b955, #5db69b, #a78bfa, #f2b8c6, #f4706d, #06251a, dst.; #34c38e legacy hanya untuk konten lama;
  #1a1a1a = default warna teks sticky + fallback rgba, bukan chrome UI).
  Data milik modul (Tier-2); kemiripan dengan token UI adalah kebetulan.
  Cermin erd-export dijaga sinkron manual (utang tercatat).
  Keputusan owner 2026-09-15: #34c38e → accent #5db69b untuk default elemen BARU (templates) + swatch palet; #34c38e dipertahankan di isLightFill (WhiteboardCanvas + export, cermin sinkron) untuk konten lama.
- **Brand/ilustrasi** (Logo, DoodleIllustration, bento-fill #fff): karya
  tetap, tidak ikut tema.
- **Varian tooltip** (dark #111827, info #2f6df6): live + ter-test
  (Tooltip, WhiteboardEditorShell); retokenisasi ikut task whiteboard.

  Pengecualian guard untuk domain di atas hidup di `HEX_FILE_ALLOWLIST` /
  `HEX_VALUE_ALLOWLIST` (`app/scripts/guard-css-classes.mjs`) — cermin
  bagian ini, diubah hanya via keputusan owner.

Antre lipat per area (semua mengubah visual → task sendiri, bukan fondasi):

| Residu | Verdict |
|---|---|---|
| Badge vivid BoardTimeline (#dc2626/#d97706/#2563eb/#52525b/#0e7a4a/#fff) | Sistem Badge tone (task Board) |
| Hijau sukses Auth (#dcfce7/#14532d) | status-success-soft + status-success — DILIPAT 2026-09-15 (var hantu --success-bg/fg dihapus) |
| Fallback tint chat #a1a1aa (ENTITY_TINT) | text-muted — DILIPAT 2026-09-15 (3 fallback di ChatPanel) |
| Tooltip dark/info hardcoded | Retokenisasi (task whiteboard; varian tetap ada) |

Rules:

- Skala heatmap Profile (terdokumentasi, bukan drift): level 0 `surface-hover`,
  level 1–3 `color-mix(in srgb, var(--accent) 22%/45%/72%, transparent)`,
  level 4 `var(--accent)`. `color-mix` di atas token adalah turunan, bukan
  warna baru (§8 aturan induk).
- Guard `app/scripts/guard-css-classes.mjs` adalah penegak pasal 7/8:
  `npm run guard:css` (warn, exit 0 — dipakai di `build`);
  `npm run guard:css-strict` (dry-run, exit 1 — JANGAN dipakai di build
  sampai migrasi per area selesai). Baseline awal 2026-09-15: 37 temuan
  (9 hex global.css + 16 spacing + 12 TSX). Baseline berjalan: **78 temuan**
  (51 CSS: 6 hex + 18 spacing + 12 radius + 4 border-width + 11 border-rgba; 27 TSX: 26 hex + 1 btn-size) — hitungan jujur per-hex-per-file
  dengan domain sah di bawah dikecualikan (`HEX_FILE_ALLOWLIST` /
  `HEX_VALUE_ALLOWLIST` di guard; tambah hanya via keputusan owner).
  Kenaikan 53→55 dari perbaikan regex: deklarasi `}`-terminated kini ikut
  terpindai (menemukan 72px + 34px yang selama ini lolos).
  Lompatan 55→78 dari perluasan guard ke radius/border/btn-size
  (12 radius + 4 border-width + 11 border-rgba + 1 btn-size).
- Nilai spacing/radius/warna baru di luar tangga = temuan review.
- Test yang meng-assert kelas varian (mis. .tooltip-card-info) diperbarui
  bersama migrasinya, bukan diam-diam.

---

## 9. Controls: buttons, dividers, motion, focus

Audit 2026-09-15: varian tombol 5 (primary/secondary/ghost/danger/outline,
Button.tsx) + link berbungkus .btn; divider hairline dominan (44 bawah + 35
atas); --duration-fast dipakai 145x, normal 2x (progress/transform lambat),
slow 0x sehingga DIHAPUS dari tokens.css; fokus global outline 2px accent +
offset 2px + halo ring 4px.

| Token | Value | Role |
|---|---|---|
| btn-sm | 28px / 12px label / pad 0-10 | SEMUA aksi settings-rows/action-row (Password, Connect, Copy, Manage). Touch naik 44px via blok global |
| btn-md | 34px / 13px label / pad 0-14 | Aksi primer halaman (CTA, Save, New) |
| btn-icon | 32px desktop / 36px touch | Ikon-only; padding 0 (jangan timpa — regresi 12px tercatat §1) |
| btn-gap | 6px, radius-input, weight 500 | DNA semua tombol/link-btn |
| divider | 1px hairline | Pemisah baris berkelompok (settings-row-group bawah, list li+li atas). Strong HANYA zona emfasis (danger-top) |
| gap-vs-divider | gap space-16 antar kartu/section; divider di DALAM kelompok | Kapan garis vs jarak |
| duration-fast | 120ms ease-out | SEMUA transisi UI |
| duration-normal | 180ms ease-out | HANYA gerak lambat bermakna (progress width, transform statements) |
| focus-ring | outline 2px accent + offset 2px + halo 4px ring | :focus-visible global; varian per-komponen (2/3px ring, inset, drop-shadow) tetap di atas fondasi ini |
| motion-rule | transform/opacity saja; :active scale 0.98 | Direduksi total saat prefers-reduced-motion |

Fold map (diterapkan sesi ini):

| Drift | Verdict |
|---|---|---|
| Manage plan btn-md di settings (DashboardSettingsTab:502) | btn-sm (peran action-row) |
| --duration-slow 220ms (0 referensi) | DIHAPUS dari tokens.css |
| .btn tanpa size (tinggi auto) | DILARANG — sisa 1 file (AuthPage OAuth, ikut task per-area Auth) |

Rules:

- Tombol/link-btn baru WAJIB size (sm/md/icon); tanpa size = temuan review.
- Guard memperingatkan className `btn` statis tanpa size (sisa 1 file: AuthPage OAuth —
  lipat ke btn-md ikut task per-area Auth, bukan fondasi). Transition belum dijaga guard.
- Transisi baru WAJIB duration-fast + ease-out kecuali justifikasi + ADR.
- Opt-out fokus (mis. composer bare) didaftar eksplisit per kasus, bukan pola.
