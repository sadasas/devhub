# Design Tokens — DevHub

| Field | Value |
|---|---|
| **Document status** | Active |
| **Owner** | Project Owner |
| **Last updated** | 2026-09-26 |
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
| `icon-subtab-size` | **13px** | View-switcher `sub-tab` glyphs (Schema/API/Releases/Stack/Board/Profile/DueCalendar) | One tier below `icon-tab-size` (15px): sub-tabs are secondary navigation. Unifies Board 16px + Profile 15px drift (2026-09) |
| `icon-button-left` | **14px** | `Button leftIcon` (text buttons, desktop) | Majority pattern (toolbar New/Import/row actions). Row delete Trash 13px folded to 14 (2026-09) |
| `icon-trigger-size` | **16px** | Icon-only triggers: sort trigger, overflow `...`, drawer, tree folder | Touch-carrier exception on desktop too — small tap targets stay legible. Tree/folder decorative glyphs keep authored sizes |
| `icon-canvas-tools` | **15px** | Whiteboard editor tool buttons (desktop) | Exception sah: authored per usage (cf. Desktop glyphs row). Touch CSS membesarkan ke 18px |
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

- Touch targets: 44px minimum on `hover: none` (WCAG 2.5.8 floor
  is 24px). Desktop sizes follow the §9 size ladder: text buttons
  28/34px (sm/md); icon boxes match their size class (28/34px),
  36px when unsized — intentional.
- Inputs `font-size: 13px` di semua device.
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

## 4b. Breakpoints, content widths and mobile action alignment

| Token | Value | Role |
|---|---|---|
| `bp-small` | `360px` | Small-phone guards: cap teks + `row-gap: 8` saja; dilarang layout baru di sini |
| `bp-mobile` | `640px` | Mobile: 1 kolom, `.page 16/16/32`, `.pcard-body 12px`, modal fullscreen + footer 50/50, toolbar/header 2-baris, icon-only, prop pil |
| `bp-tablet-stack` | `900px` | SATU-SATUNYA breakpoint collapse 2-kolom → 1-kolom (detail-grid, schema-layout, welcome-grid, settings-row). Menggantikan 860/700/640/900 yang tersebar; pengecualian per modul wajib ADR |
| `bp-drawer` | `860/861px` | App-shell drawer switch (`Layout.tsx` + CSS): grid 1 kolom + `rows: auto 1fr`, drawer `min(304px, 100vw-48px)` + backdrop blur, hamburger on, `topbar-btn` 44px |
| `bp-tablet-rhythm` | `641–1024px` | `pcard-body 20/16/16`, `page` 20px; `861–1024px: page 16/20/40` |
| `bp-laptop` | `1024px / 1281px` | `≥1024: .page:has(pcard) padding 16`; `≥1281: max-width 1280 centered` |
| `content-narrow` | `360px` | `.auth-form` — form auth saja |
| `content-read` | `800px` | `.narrow-center` — konten baca (members/settings-like); list panjang + board full-bleed tanpa wrapper |
| `content-page` | `1280px` | `.page` — semua wrapper halaman |
| `content-prose` | `42ch` | `.empty-state-desc` — deskripsi empty/prose |
| `action-row` | `fit-content + align-self: flex-end` | Aksi baris settings/form di mobile: rata kanan, bukan fullwidth (sejajar tombol Save). Kanonis: `.dashboard__settings-copy/-manage/-danger-btn` |
| `modal-footer` | desktop `flex-end`; mobile 50/50 | Footer modal: desktop `flex-end + wrap + gap 8`, Cancel kiri; mobile `.btn { flex: 1 1 0 }`, primary `flex: 2`, danger `max-width: 50%`, 44px |
| `toolbar-header` | desktop `end`; mobile `100% + end` | `.page-header / .project-actions / .board-toolbar-actions`: desktop `end + wrap`, mobile turun `width: 100% + justify-content: flex-end + row-gap: 8` |
| `onboarding-actions` | stacked / center | Empty/onboarding: stacked fullwidth primary 44px (mobile) atau center wrap (desktop). BUKAN rata kanan |

Rules:

- Breakpoint px baru di luar daftar di atas = temuan guard (warn-first; grandfathered: complements 641/861 + tablet 700/767 yang sudah dipakai, tercatat di guard).
- `action-row` fullwidth (`width: 100%` pada `*-copy/*-manage/*-danger-btn`) = temuan guard; pengecualian onboarding/modal didaftar eksplisit per kasus, bukan pola.
- Contoh kanonis (jangan fullwidth):
  `@media (max-width: 640px) { .settings-row-actions { align-self: flex-end; } .settings-row-actions .btn { width: auto; min-height: 44px; } }`

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
| 2026-09-19 | `erd-group-label`, `erd-rail-label`, `versions-title-row` (dari ERD hardening main) didaftar di ALLOWLIST guard-css (grandfathered, gate kembali hijau) |
| 2026-09-22 | `.editable-field-title` (wrapper judul TaskModal untuk pencil hover-reveal; memperbaiki order mobile judul yang jatuh karena selector `textarea.composer-title` tak lagi kena) didaftar di ALLOWLIST guard-css |
| 2026-09-22 | Lampiran ala Linear: thumb 40px + tombol Eye → `AttachmentPreviewModal` (reuse `.md-preview`/`.modal-fullscreen`, zoom gambar, video, PDF `sandbox`, teks cap 1MB); `LinkCard` (favicon+domain, OG title/desc/image via `/attachments/unfurl` SSRF-guarded cache 1 jam); embed deskripsi `![alt](attachment:<id>)` (blob URL sesi, lolos expiry 60 dtk signed URL); upload dari editor (paperclip/drag-drop/paste, staged vs attached). Kelas baru `.link-card` tanpa `*-title/*-label` (guard hijau); video dibuka di allowlist (`video/*`) |
| 2026-09-22 | Subtask ala Linear/Asana/ClickUp (gaya subtle, tanpa tint): tambah inline judul+assignee+tanggal di TaskModal (reuse `SearchableSelect` + `DatePicker range` portal; chain Enter, validasi rentang parent saat buat); baris subtask indent 16 + rail `border-hairline` 1px, avatar 14-16 + meta 11px muted + due chip existing; badge `Subtask` (`Badge neutral`) + breadcrumb `btn-ghost btn-sm`; kartu board: ikon `GitBranch` 11 + sub-label parent 11px muted, progress reuse `.usage-meter-bar/fill`, due rollup via `taskDueChip`; kalender: ikon + parent di tooltip/chip. Nol kelas/hex/spacing/font baru (guard hijau) |
| 2026-09-23 | Tooltip satu gaya inverse theme-aware: prop `tone` dihapus (±30 call-site), `.tooltip-card-{dark,light,info}` + arrow varian dilipat ke 1 blok token (`--surface/text/border/icon-inverse`, nilai dibalik per tema); hex `#111827/#2f6df6` keluar dari allowlist guard; aturan: plain vs rich tak lagi dibedakan tone (konsensus Linear/GitHub/Onyx, inversi Radix) |
| 2026-09-24 | Menu/select §10: `RowMenu` kebab + `stopPropagation` (`app/src/components/RowMenu.tsx`); `SearchableSelect` mount-emit guard + regression test; portal `DatePicker`; overlay `bg-overlay` (§3) |
| 2026-09-24 | Chip/card/skeleton/drawer §10: `chip-wrap` + `label-chip-no-maxwidth` (tanpa maxWidth paksa); `grid-minmax-card` + `project-card-title-block`; `template-skeleton-kebab`; `templates-icon-only` + `labels-kebab-mobile` via `useIs*Narrow`; `drawer-settings` |
| 2026-09-24 | Upload + whiteboard §10: upload TUS + fallback PUT + `isUploadAuthError` (`app/src/lib/attachmentUpload.ts`); whiteboard kind `embed` (SVG wireframe, sanitasi allowlist, max 20/board) |
| 2026-09-24 | i18n §10: aksi umum via `common:` (`defaultNS: common`, 6 ns + paritas EN/ID dalam PR yang sama); rujukan silang `select-mount-emit` + `upload-tus-fallback` |
| 2026-09-25 | Feedback section unified: `StatusBanner` (`danger/warn/success/info` → `save-banner/conflict-banner/save-status/info-banner`, role otomatis) gantikan duplikasi flash/error GCal/GitHub; pilot migrasi `GCalSettings` + `GitHubSettings` (error pindah ke bawah aksi, `unconfigured` jadi warn, tombol "Install on another GitHub account"); `GitHubSetupGate` ke `InlineError`; aturan penempatan di `coding-standards` §7 + `design-tokens` §7 |
| 2026-09-25 | Koreksi: butir "urutan kanonis section integrasi" (scoped, behavioral) dicabut dari §7 global — diganti aturan penempatan global di `coding-standards` §7 (banner menempel pemicu, teks statis utuh); §7 kembali ke mekanik (ritme, varian warna); warn GitHub pindah ke atas baris aksi |
| 2026-09-25 | `InlineError` ditegaskan global: ikon `Warning` 12px + teks 600 (seragam 71 titik + `Input`/`Textarea`); tetap teks tanpa kotak, `role=alert` tak berubah; `.field-error > svg` nempel baris pertama (pola `save-toast`), gap 6 tangga space-* |
| 2026-09-25 | Audit penempatan feedback se-app: aturan kedekatan dilonggarkan jadi "di atas ATAU bawah pemicu asal bersebelahan" (konvensi modal: error di atas footer = menempel); 12 titik P0 diperbaiki (duplikat PricingPage, alert-pada-info PlanLimitModal/TeamBillingPanel, role ganda PaymentHistory, primitif custom ProfilePage, load-gagal auth/billing, ember salah ProjectPage, kode mati LabelsSection, doneWarn dinamis TaskModal) |
| 2026-09-25 | Slot tunggal banner section: SEMUA banner menumpuk di bawah konten (danger → warn → success) — flash/notice GitHub turun, tumpukan GCal disusun ulang, `GCalBanner` jadi wrapper `StatusBanner`, notice disconnect GCal, dialog konfirmasi disconnect GitHub, loading GitHub `role=status` |
| 2026-09-26 | §4b breakpoint + content-width + action-alignment (4 klasifikasi: action-row rata kanan / modal-footer 50/50 / toolbar-header wrap-end / onboarding stacked) + §7b overflow-guard/grid-collapse/card-header/toolbar-stack/truncate/empty-center + §9b modal-mobile/tabs-icon-only/overlay-clamp; guard WARN breakpoint/empty-per-page/settings-fullwidth di PR yang sama (Fase 0, nol perubahan visual) |
| 2026-09-26 | Fase 1 pilot: `ModalFooter` + `ConfirmFooter` (Tier-1, `app/src/components/`) + 8 regression test; migrasi `ConfirmDeleteDialog`/`CollectionModal`/`UnlinkProviderModal` tanpa perubahan visual; footer modal baru WAJIB primitif (manual = temuan review); `PageHeader`/`Section` tetap terencana |
| 2026-09-26 | Fase 1 lanjutan: `PageHeader` + `Section`/`SettingsRowGroup` + 10 regression test; `section-title-icon` (`--with-icon`, ALLOWLIST + guard di PR yang sama); migrasi `KeysPage`/`TemplatesPage` (header), `LabelsSection`/`DashboardSettingsTab` general (section), `ProfilePage`/`GCalSettings` (row-group) tanpa perubahan visual; header/section manual baru = temuan review |
| 2026-09-26 | Migrasi per-area Profile: header `ProfilePage` → `PageHeader`; footer `ProfileEditModal`/`ChangePasswordModal` (cabang form; cabang sukses 1-tombol Done tetap manual) → `ModalFooter`; tanpa perubahan visual (cancel `disabled` saat busy dipertahankan, label `common:action.cancel` eksplisit) |
| 2026-09-26 | Migrasi per-area Dashboard: section plan/usage (incl. `id` deep-link, prop `id` baru di `Section` + test)/danger → `Section`; footer `NewProjectModal` → `ModalFooter`, leave-modal → `ConfirmFooter`; dikecualikan: header `MembersTab` (h2, `PageHeader` h1-only — semantik dipertahankan), delete-modal typed-confirm (`aria-describedby` per-button, di luar API `ConfirmFooter`), link `<a class="btn">` (belum ada primitif LinkButton) |
| 2026-09-26 | Audit per-area Billing: patuh, nol perubahan — `TeamBillingPanel`/`PaymentHistoryPage` sudah primitif (`StatusBanner`/`DataErrorState`/`Badge`/`Button`/`BillingLedger` compound); dikecualikan: header `PaymentHistoryPage` (h1 bawa `mt-8`, `PageHeader` tanpa escape-hatch by design — lipat butuh verifikasi visual), empty `.billing-empty` kustom (bukan `EmptyState`, migrasi = risiko visual) |
| 2026-09-26 | Migrasi per-area Tracker: footer `NewIssueModal` + dialog pindah-tanggal `DueCalendar` → `ModalFooter`; dikecualikan: footer `IssueModal`/`TaskModal` (`[danger sm Delete + save-state]`, tambah Cancel = ubah UX — butuh pola `DetailFooter` tersendiri), footer `NewTaskModal` (1-tombol submit tanpa Cancel, tambah Cancel = ubah UX) |
| 2026-09-26 | Migrasi per-area Project: 3 section `ProjectSettings` (general/danger/integrations) → `Section`; footer `EditGeneralModal`/`EditPrdSectionModal` → `ModalFooter`; footer archive/import `ProjectPage` → `ConfirmFooter` (tone `ghost` baru untuk Restore non-destruktif + test); dikecualikan: delete-modal typed-confirm (`aria-describedby` per-button); catatan: Cancel kini disabled saat busy di archive/import (X/backdrop tetap aktif — selaras `ConfirmDeleteDialog`) |
| 2026-09-26 | Migrasi per-area Whiteboard/Templates/Keys: 5 footer → `ModalFooter` (`NewWhiteboardModal`/`EditWhiteboardModal`/`SaveTemplateModal`/`InstantiateTemplateModal`/cabang form `NewKeyModal`; cabang done 1-tombol tetap manual); 1 gagal pre-existing sindrom `unread dot` (`WhiteboardList`, berkas tak tersentuh) |
| 2026-09-26 | Migrasi per-area Public/Integrations: footer `GitHubSetupGate` → `ModalFooter`; dikecualikan: header `PublicWhiteboards` (`div` + h3) dan `PublicProjectPage` (`div` + aksi link mentah) — `PageHeader` me-render `header`+h1, migrasi = ubah landmark/outline public shell |
| 2026-09-26 | Pola tertunda `DetailFooter` selesai: komponen + 3 test; migrasi 7 footer DetailShell save-state (`Issue`/`Task`/`Tech`/`Table`/`Milestone`/`Decision`/`TestModal`) + bersih import `Button`/`Trash` mati; teks save-state per-area dipertahankan via slot `children` |
| 2026-09-26 | Pola tertunda `WizardFooter` selesai: komponen + 5 test; migrasi `OnboardingWizard` (satu fragment dual-host popover+modal dipertahankan, autoFocus desktop-only + gate `blocked` + `data-tour-id` dipertahankan; `aria-disabled="false"` → absen, setara semantik) |
| 2026-09-26 | `LinkButton` selesai (pola tertunda terakhir): union `to`/`href` + `iconPosition` + 4 test; migrasi 11 link; dikecualikan OAuth `AuthPage` (`fontWeight: 600`); 1 gagal pre-existing (`PublicProjectPage` duplikat tombol Roadmap — list whiteboard tak tersentuh, CTA saya role=link tak bisa gandakan role=button) |
| 2026-09-26 | Label pill activity dikembalikan `New`/`Baru` (10 kunci `unread` × EN/ID, nilai saja): selaras metode tab-switch — bukan status baca; test mayoritas (`Api/Stack/Decisions/Tests/Whiteboard/Schema`) memang mengharapkan `New`; 2 test (`IssuesPage`, `TaskCard`) ikut diluruskan |
| 2026-09-26 | Audit per-area Layout/Sidebar: patuh, nol perubahan — shell Tier-2 (drawer/topbar/nav/switcher/user-menu) pakai kelas token sendiri; satu-satunya `.btn` (`Layout` banner) bersize; sidebar sudah konvergen 2026-09-15 |
| 2026-09-26 | Migrasi per-area Pricing/Docs: footer konfirmasi checkout `PricingPage` → `ModalFooter`; header `DocsPage`/`McpDocsPage` → `PageHeader`; dikecualikan: footer `OnboardingWizard` (pola wizard `[Skip][spacer][Back?][Finish/Next]` sm dual-host Modal+Popover — migrasi = ubah size + putus reuse) |
| 2026-09-26 | Migrasi per-area API: delete-modal `ApiPage` → `ConfirmFooter` (alur delete teruji hijau); 1 gagal pre-existing `unread dot` (badge tree `New`, di luar permukaan diff — footer saja, 7+/8-, nol sentuh tree; delete-flow hijau sebagai bukti migrasi) |
| 2026-09-26 | Migrasi per-area Stack/Schema/Releases/Decisions: 7 footer → `ModalFooter` (`NewTechModal`/`SaveVersionModal`/`NewTableModal`/`NewRelationModal`/`ImportSchemaModal`/`NewMilestoneModal`/`NewDecisionModal`) + delete-relation `SchemaPage` → `ConfirmFooter`; dikecualikan: 5 footer DetailShell `[danger sm Delete + save-state]` (`TechModal`/`TableModal`/`MilestoneModal`/`DecisionModal`/`TestModal` — butuh pola `DetailFooter`) + single-submit `NewTestModal`; 3 gagal pre-existing di berkas tak tersentuh (2× sindrom `unread dot`, 1× popup versi `MilestoneModal` yang bahkan tak import `NewMilestoneModal`) |
| 2026-09-26 | Migrasi per-area Teams: header `InvitesPage` → `PageHeader`; footer `CreateTeamModal`/`InviteModal`/`ChangeRoleModal`/`EditTeamGeneralModal` → `ModalFooter`; tanpa perubahan visual |
| 2026-09-26 | Migrasi per-area Auth: 2 tombol OAuth `AuthPage` (`btn btn-secondary` tanpa size — sisa terakhir §9) → `btn-md`; inline duplikat (display/align/padding/border/radius, sudah milik `.btn`/`.btn-secondary`/`.btn-md`) dibuang, `fontWeight: 600` dipertahankan; temuan guard `tombol tanpa size` kini nol |
| 2026-09-29 | Focus page mobile: `.focus-topbar-label` (span label Back + Tandai selesai, `display:none` di ≤640px `.page`, pola `tabs-icon-only` §9b) didaftar di ALLOWLIST guard-css (kelas mengandung `label`, Tier-2 modul, bukan primitif Tier-1) |
| 2026-09-29 | Tooltip icon-only §9 (`tooltip-icon-btn`): tombol icon-only di hover-capable WAJIB `<Tooltip title={sama-dengan-aria-label}>`; tutup/dismiss (×) dikecualikan (aria-label saja); guard `guard:buttons` warn-first (ALLOWLIST 7 situs close, depth-counting `<Tooltip>` seimbang) + backfill 5 situs (`AttachmentSection` preview/download/delete, `DueCalendar` strip-toggle, `GitHubTaskSection` unlink) — guard + dokumen dalam perubahan yang sama |
| 2026-09-29 | Guard `guard:buttons` parsing fix + pengetatan §9 (`tooltip-icon-btn`): tag `<button>` multi-baris dipindai penuh (hormati quotes/`{...}`/`=>`, false positive TaskDetail:589 hilang); bare `title=` native tanpa `<Tooltip>` kini temuan (grandfather EXPIRED); ALLOWLIST tutup/dismiss +2 entri ERD (close + present-exit pengecualian Esc) — guard + dokumen dalam perubahan yang sama |
| 2026-10-04 | Token Focus (`bg-focus`, `accent-focus/hover/pressed`): bg krem + hijau halaman Focus Mode desain baru (keputusan owner via screenshot); guard tak perlu diubah (hanya memindai global.css; kelas baru tanpa `*-title/*-label`, hex hanya di tokens.css) |
| 2026-10-01 | Doodle v2 adegan objek (keputusan owner): maskot bermuka (`thinking/celebrating/confused` + blush) dibuang — kesan anak-SD; ganti 6 spot tanpa wajah (`empty/offline/not-found/locked/broken/success`: blob organik + objek goyang + 2-3 aksen coretan, tinta `#1c1c1f` + kertas `#fff` + aksen `accent`/`status-*`); `DataErrorState` mapping `classifyError()` → doodle, `ZeroTeamOnboarding` → `empty`; guard allowlist `DoodleIllustration.tsx` dipertahankan (file tetap), 12 test hijau |
| 2026-10-01 | Doodle v2 Batch 1 rollout (keputusan owner): `doodle` dipasang di 26 `EmptyState` (18× `empty`, 4× `not-found` + `NotFoundPage` 404, 1× `locked` settings-no-access, 1× `broken` ERD versionsError, `InvitesPage` ikut `empty`); `icon` dipertahankan sebagai fallback; `success` tetap cadangan tak terpakai; welcome strips + teks inline `noResults` tunda Batch 2 |
| 2026-10-01 | Doodle v2 Batch 2 (keputusan owner): (A) welcome modal tour → `empty` 104px; (B) 3 welcome strips → doodle 64px gantikan ikon (`empty`/`empty`/`not-found`); (C) 6 spot topik `tour-team/project/plan/build/decide/collab` 52px di header popover via field `doodle` di `TourStepDef` (popover ukur-ulang otomatis, aman); kelas baru `tour-wizard-art` + `tour-popover-head--with-art` (gap 12/8 tangga space-*); 73 test hijau |
| 2026-10-01 | Doodle v2 Batch 3 tour restructure (keputusan owner): 7→14 step (1 fitur 1 step: welcome/team/project/board/issues/tests/schema/decisions/releases/api/whiteboard/overview/finish); 7 spot baru (`tour-welcome/issues/tests/schema/releases/api/overview`, reuse 6 lama); `TOUR_TOTAL=14`; popover head kolom-tengah 64px ala welcome modal; finish modal debut `success`; `ZeroTeamOnboarding` → `tour-team`; i18n EN/ID 14 kunci paritas |
| 2026-10-01 | Tour step-skip fix (bug Batch 3): `readTourStep` polos + `ProjectPage` resume step ≥3 + `tour-events.test.ts` (verbatim 0–13, snapshot stabil 3→4→5→6); 84 test hijau |
| 2026-10-01 | Illustration system doc (keputusan owner): gaya doodle dikunci di `illustration-system.md` (kontrak visual, palet+tone, taksonomi state/`tour-*`, matriks pakai, anti-pola, checklist varian baru); §8 Brand/ilustrasi merujuk ke sana |
| 2026-10-04 | Composer bare cue = garis atas-bawah saja (keputusan owner): `.composer-title:focus-visible` tanpa outline/halo — `border-strong` atas-bawah, kiri-kanan kosong; base transparan cegah lompatan layout; pengecualian Tier-1 §9 (indikator fokus keyboard penuh di composer, preseden Notion/Linear); guard tak perlu diubah (1px + var existing) |
| 2026-10-04 | Badge priority diseragamkan (keputusan owner): `Badge tone=tone + TaskPriorityIcon 11 + label` di meta Focus, TaskDetail (meta+sidebar+badges), PublicDetailModal; timeline Board memakai teks pendek `TASK_PRIORITY_SHORT` (Urg/Hi/Med/Lo) sebagai pengecualian densitas eksplisit; hapus `.focus-detail-prio` + `as any` BoardTimeline |
| 2026-10-03 | Aksi hover baris tanpa ruang cadangan §10 (`mini-row-actions`): `.mini-row { position: relative }` + `.mini-row-actions` overlay absolute (idle `opacity:0`, hover/fokus baris menggantikan konten terakhir: `.mini-row-meta` fade-out, `.mini-row-body` geser `var(--mini-actions-reserve)`), `@media (hover:none)` kembali in-flow & selalu tampil; gantikan pola lama in-flow `opacity:0` (Labels/Checklist `.mini-del`) dan `.att-actions` `visibility:hidden` (Attachments) yang menyisakan jarak kosong permanen; `RowMenu` kebab narrow tidak dibungkus (selalu terlihat); tanpa kelas baru kena guard `*-title/*-label` |
| 2026-10-03 | Size-ladder ikon Tier-1 §9: `.btn-sm.btn-icon` 28×28 + `.btn-md.btn-icon` 34×34 (global.css:166-178), `.btn-icon` tanpa size tetap 36px; touch `hover:none` ladder di-restore 44px + `padding: 0` setelah blok touch (specificity 0,2,0, global.css:3941-3956) — `.btn-icon` 36 lama menimpa `.btn-sm` 28 sehingga trash melayang 8px di atas Edit di baris bar API; uji e2e `api-tab-fixes` (Trash==Edit 28px centerY Δ≤1; touch 44 + precondition `matchMedia('(hover: none)')`) |
| 2026-10-04 | Workbench API method select terpotong "G…": `.api-workbench-method .ss-wrap { flex: 0 0 auto }` + `.api-path-input { width: auto }` (akar: path input bawa base `width: 100%` sebagai flex-basis → baris kelebihan ~116px, select tanpa guard ikut menyusut, trigger text ellipsis; pola guard sama seperti `.method-chip` read-mode); uji e2e baru (label tak ellipsized, wrap ≥ 60px) |
| 2026-10-04 | Semantik schedule kalender (amend ADR-028): drop ke tanggal = `startDate = dueDate` = target (single-day/no-date); multi-day tak berubah; strip = clear kedua (sebelumnya hanya due → start basi); perbaiki 2 bug turunan (start==due di-drag jadi multi-day tak sengaja, strip tinggalkan start usang); uji `DueCalendar` 38/38 (+3 baru) |
| 2026-10-04 | Aturan hidden action & icon hint §10c + full migration (tanpa rename class): `.swap-group` + `.wb-card-actions` + `.api-tree-actions` + `.chat-msg-actions` → overlay opacity kanonik (`display:none`/`visibility` dibuang — Tab mencapai tombol); `.mini-del` lepas double-gate + Tooltip Labels/Checklist; bug touch `.pin-toggle` (tak tampil → tampil) + `.welcome-row-chevron` (0.6 → 1); `.version-row-eye` + `:focus-within`; hapus CSS mati `.sidebar-add-btn-team`; token `--mini-actions-reserve: 32px` didefinisikan; `.erd-handle`/`.prop-edit`/`.settings-row-actions`/`.row-kebab` terverifikasi kanonik/pengecualian |
| 2026-10-03 | 5 issue tab API: (1) default = endpoint pertama urutan sidebar — guard `?entity` deep link menang; (2) seluruh baris tree clickable (button tanpa onClick → bubble, trash `stopPropagation`); (3) tombol ikon ikut ladder §9; (4) pill aktif via override `.api-page .tabs` static + padding 4/8 + `scrollIntoView` `.tab-active` (pola §9b `api-tabs-strip`) — strip top-flush & sticky aneh hilang (topGap 4/leftGap 8 desktop), pill mobile tak kepotong (right 317.7 ≤ bar 318); (5) gap TOC↔search 12px (`.api-docs .docs-toc-mobile { margin: 12px 0 }`, global.css:23058); uji: e2e `e2e/tests/api-tab-fixes.spec.ts` 7 test serial (1 project, dihapus afterAll — cap plan) + unit `ApiPage.test` 42/42 (helper `sidebarRoot`, +2 test default-selection & deep-link) |
| 2026-10-04 | Kalender DueDate seragam + lipat shadow dashboard (§8): `emptyH` 112/72 → `collapsedH` 142/108 (`DueCalendar.tsx:473-496`) — grid tak bergeser saat task muncul; fallback CSS `.due-cal-month/week` → 142 (global.css:15627-15635); e2e `due.spec.ts` dinavigasi ulang (tab By Due Date/Calendar/Buckets & dialog perantara sudah tak ada; label Title → Name) + assert seragam pasca-task; shadow `shadow-raised` DILIPAT di `.archive-filter-btn-active` (→ accent-dim + text-primary), `.welcome-queue-card` (tanpa shadow/lift, hover surface-hover), `.bento-stat-selected/-tone-primary`; CSS mati `.task-activity-toggle` dihapus; uji `dashboard-flat.spec.ts` (light+dark); sisa in-flow (`.segment-active`, `.team-workspace__card`) antre lipat; temuan: chip dirender di overlay `.due-cal-spans-container` (bukan dalam cell) → locator cope-date tak valid, persistensi diassert via API + render |
| 2026-10-04 | Presence popup: marker `(you)`/`(Anda)` keluar dari container ellipsis (flex-split `.presence-popover-name-text` ellipsis + `.presence-you` fixed — pola: marker status jangan satu container ellipsis dengan teks variabel); trigger `badgeOnly` dikupas dari pill `badge-info` → avatar stack polos (`presence-chip--naked`, hover surface-hover), CSS mati `.presence-chip--badge` dihapus; uji `PresenceChip.test` +2 |
| 2026-10-04 | Amend keputusan Sept-14 (tema+bahasa keluar topbar): jalan pintas `ThemeSwitcher` + `LanguageSwitcher` varian dropdown kembali ke `content-header-actions` global (`Layout.tsx`, trigger `topbar-btn` 36px, tanpa CSS/i18n baru) — alasan discoverability (issue Next.js #86002, pola header GitHub/Linear); Profile Preferences tetap rumah kanonik (tidak dihapus); opsi sidebar-menu/dashboard-segmented ditolak via wireframe whiteboard; uji `ThemeSwitcher.test` (baru) + e2e `header-prefs.spec.ts` |
| 2026-10-04 | Audit Tooltip icon-only menyeluruh (32 situs): guard `guard-icon-buttons` buta terhadap komponen `<Button>` (hanya `<button>` mentah) + mode warn exit-0 → temuan menumpuk tak diperbaiki (PinButton `title=` native, WhiteboardCard, 6 ApiPage, TaskDetail ×2, ProjectPage ×3, dsb.). SEMUA dibungkus `<Tooltip title=sama-dengan-aria-label>` (bare `title=` dibuang); `ArchiveUndoToast` dismiss masuk ALLOWLIST; guard diperluas ke `<Button>` + test `guard-icon-buttons.test.mjs`; guard kini HIJAU 0 warning |
| 2026-10-04 | Tooltip kolom ERD menutupi daftar (`showColTip` ikut kursor + `pointer-events:none`): ganti ke table-edge anchor `placeRightOrFlip` (selaras jalur keyboard) untuk hover maupun fokus; `placeRightOrFlip` dikeraskan (TIP 300×190, flip vertikal, clamp kiri/atas-bawah); clamp CSS disinkron `308/198px` + aman kontainer sempit; uji stabilitas posisi saat mouseMove |
| 2026-10-04 | Unifikasi settings-row Team+Project ke pola Profile: Team ID/URL (`DashboardSettingsTab`) + Project ID/Team/Desc (`ProjectSettings`) dari `Input readOnly`/meta-block → `dl.settings-rows` + `SettingsRowGroup` dt/dd + mono + aksi Copy (pola: nilai read-only = settings-row); mirror skeleton; hapus CSS mati (`-id-row/-copy/-read-meta-block/-read-key/-read-desc-block/-team-status/-slug` + 2 rujukan list); `Input` import lepas di ProjectSettings; uji struktur +2 |

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
- **Padding panel/kartu konten = 20px seragam** (audit 2026-09: `.profile-panel`
  16/20 + `.pcard-body` 32/20/16 disatukan ke 20px; mobile tetap 12px).
  Pengecualian tercatat: `.pcard--compact .pcard-body` 12/20 (varian padat
  ProjectPage), `.modal-body`/`.content-card`/`.about-card` 16px,
  `.timeline-card`/`.data-row` 12/14px–12/10px (densitas daftar).
- **Seksi settings = satu mekanisme jarak.** Setiap seksi settings WAJIB
  `<section class="dashboard__settings-section" aria-labelledby="…">`
  (flex column, `gap: 12px`, padding 20px 0); elemen di dalamnya DILARANG
  punya margin/padding vertikal sendiri (tidak collapse di flex —
  insiden 28-vs-16px, 2026-09). Ritme antar-blok selalu 12px.
  Pengecualian: grup disclosure integrasi (`.integration-disclosure`,
  buat-apa + akses + legal) adalah SATU blok dengan garis internal rapat
  `gap: 4px` — cermin pola `danger-name` → copy (`margin-bottom: 4px).
- **Urutan kanonis blok baca General:** 1 nama (+ikon) → 2 ID + Copy →
  3 meta sekunder (proyek: Team·Status; tim: Team URL) → 4 Description
  di akhir. Blok tanpa data dilewati, tidak disusun ulang.
- **Varian banner section:** danger `save-banner`, warn `conflict-banner`,
  success `save-status`, info `info-banner` — semua via `var(--status-*)`.
  Banner in-flow selebar wadahnya (cap 400px hanya untuk toast melayang
  di `.toast-stack`). Penempatan diatur `coding-standards.md` §7
  (banner menempel pada pemicu; teks statis utuh tak disela).
- Guard memindai (warn-first): margin/padding/gap/row-gap/column-gap (tangga space-*);
  border-radius mentah (50% = DILARANG); border-width selain 1px; rgba() mentah di border.
  Transition SENGAJA tidak dijaga guard (butuh triase ADR per kasus, lihat §9).
- Ghost var `var(--danger|--warning|--success-bg|--success-fg)` = FAIL
  (tidak ada di tokens.css; gunakan `var(--status-*)`); `style={{}}` inline di TSX
  = WARN per file (warn-first; `btn-icon-wrap` tersanksi dikecualikan, skeleton
  mirror berdimensi tercatat sebagai utang triase per area).

---

## 7b. Overflow, grid collapse, card header and toolbar

| Token / pola | Value / kelas | Role |
|---|---|---|
| `overflow-guard` | `.page, .tab-panel { min-width: 0 }` + `.page { overflow-x: clip }` | Halaman tidak scroll horizontal; scroll milik `.kanban/.tabs/.preview-table` internal. Syarat: overlay WAJIB portal (`coding-standards.md` §5) |
| `grid-collapse` | `repeat(auto-fill, minmax(min(Npx, 100%), 1fr))` → `1fr` | Kartu responsif; mobile 1 kolom. `minmax(min(Npx,100%),1fr)` cegah overflow 320px |
| `card-header-mobile` | breadcrumb baris 1, aksi baris 2 | Pola `pcard--compact` digeneralisasi: judul ellipsis + cap, `.project-actions { width: 100%; justify-content: flex-end; gap: 6 }` ≤640px |
| `toolbar-stack-mobile` | switcher atas, aksi bawah | Pola `.board-toolbar` digeneralisasi: `flex-wrap + row-gap: 8`, actions `width: 100% + end`, kontrol jadi icon-only 44px. Berlaku schema/api/releases/stack |
| `truncate-mobile` | `220px / 55vw / 38vw / 30vw` | Cap `.breadcrumb-current / .breadcrumb-link` — daftar tertutup, cap baru = temuan review |
| `empty-state--center` | `align-items: center; text-align: center` ≤640px | SATU kelas global gantikan daftar per-page (issues/tests/stack/decisions/releases/whiteboard/schema); page baru WAJIB pakai ini |
| `section-title-icon` | `.dashboard__settings-section-title--with-icon` (inline-flex + gap 8 + accent) | Ikon opsional di h2 settings (pola `.section-title`); HANYA bila `Section icon` diisi, tanpa ikon h2 tetap semula |

Rules:

- Empty-state per-page baru (`.xxx-page .empty-state`) = temuan guard — pakai `.empty-state--center`.
- Grid kartu baru WAJIB `minmax` (cermin §10); `flex %` = temuan review.

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
| focus | accent-focus/hover/pressed | Halaman Focus Mode desain-baru 2026-10: CTA hijau (pill gabungan, tab timer, preset aktif, transport play). Light: `#2f7d5a`; dark: `#57a37e` |
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
  tetap, tidak ikut tema. Gaya ilustrasi mengikat di
  [illustration-system.md](illustration-system.md) — di luar itu = temuan
  review.
- **Varian tooltip** (dulu dark `#111827`, info `#2f6df6`): DILIPAT 2026-09-23 ke
  satu gaya inverse theme-aware (`--surface-inverse`/`--text-inverse`/
  `--border-inverse`/`--icon-inverse`, nilai dibalik per tema ala Radix;
  preseden unifikasi Onyx DAN-2927). Prop `tone` dihapus dari
  `Tooltip`/`TooltipCard`; ±30 call-site dibersihkan.

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
| Shadow in-flow non-dashboard (`.segment-active` bg-overlay+shadow global.css:13841, `.team-workspace__card` shadow global.css:20456) | accent-dim + `box-shadow: none` (pola selected-pill §8; task tersendiri, bukan fondasi) |

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
- Shadow: `shadow-raised` / `inset-highlight` HANYA layer melayang
  (modal, panel, sheet, menu, popover, tooltip, toolbar/pill floating —
  §3). Konten in-flow (kartu, chip/tab/toggle terpilih, stat) WAJIB
  `box-shadow: none`; seleksi ditandai `background: var(--accent-dim)`
  (+ `border: accent-ring` bila perlu) — pola selected-pill
  (`.mini-toggle`, `.seg-btn-active`, `.tab-active`). `bg-overlay`
  sebagai bg hover in-flow juga melanggar §3 (contoh dilipat
  2026-10-04: `.welcome-queue-card:hover` → `surface-hover`).
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
| btn-icon | 28px (sm) / 34px (md) / 36px tanpa size; touch 44px | Ikon-only; padding 0 (jangan timpa — regresi 12px tercatat §1). Size-ladder 2026-10-03 (global.css:166-178): kotak ikon setinggi tombol teks sebelarnya — `.btn-icon` 36 lama menimpa `.btn-sm` 28 sehingga trash melayang 8px di atas Edit (bug tab API) |
| btn-gap | 6px, radius-input, weight 500 | DNA semua tombol/link-btn |
| tooltip-icon-btn | `<Tooltip title={sama-dengan-aria-label}>` (side top) | Tombol icon-only tanpa label teks di hover-capable WAJIB `<Tooltip>`; bare `title=` native TANPA Tooltip = temuan guard (kecuali tutup/dismiss × di ALLOWLIST — aria-label wajib, tooltip visual opsional); grandfather clause untuk title telanjang EXPIRED 2026-09-29; di sentuh/mobile tooltip tak ada sehingga ikon harus jelas dari konteks |
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
| EmptyState primary sm (Decisions, Releases, ApiDocs) | btn-md (mayoritas Issues/Tests/Stack/Whiteboard/Welcome; primer di kanvas halaman) |
| Import `outline sm` di ApiDocs empty-state | `ghost sm` (samakan Import header; `outline` tetap sah untuk Copy Key) |
| Raw `<button class="btn ... btn-danger">` di row (ReleasesListView) | Komponen `Button` (`ghost sm btn-icon btn-danger`) — tanpa size = temuan review |
| `danger` tanpa size (= md 34px) di baris form sempit | `size="sm"` eksplisit (temuan 2026-09 ternyata sudah rapi di ApiPage — verifikasi dulu sebelum klaim) |
| ConsentBanner Accept+Reject dua-duanya `secondary` | SENGAJA — anti dark-pattern ("ketiga tombol setara", consent.note). Jangan "perbaiki" ke primary |
| WhiteboardList sort memuat `createdAt`, halaman lain memfilter | Dicatat, belum diputuskan (opsi sort produk — butuh keputusan owner, bukan lipat diam-diam) |
| Board `?view=` + Dashboard `?status` + Profile `?tab=` tablist tanpa roving/arrow | Dilengkapi 2026-09 (tablist + roving tabIndex + ArrowLeft/Right + aria-controls/tabpanel); Board naik ke pola header A + `board.count` |
| .btn tanpa size (tinggi auto) | DILARANG — nol sisa (AuthPage OAuth → btn-md, decision §6 2026-09-26; terverifikasi grep + `guard:buttons` hijau 2026-10-03) |

Rules:

- Tombol/link-btn baru WAJIB size (sm/md/icon); tanpa size = temuan review.
- Guard memperingatkan className `btn` statis tanpa size (nol temuan per
  2026-10-03 — AuthPage OAuth terakhir dilipat ke btn-md 2026-09-26). Transition belum dijaga guard.
- Transisi baru WAJIB duration-fast + ease-out kecuali justifikasi + ADR.
- Opt-out fokus (mis. composer bare) didaftar eksplisit per kasus, bukan pola.

---

## 9b. Modal mobile, tabs icon-only and overlay clamp

| Token / pola | Value / kelas | Role |
|---|---|---|
| `modal-mobile` | `100% + 100dvh-24 + safe-area` + footer 50/50 | `.modal-lg / .modal-composer--fullscreen` jadi fullscreen sheet ≤640px (`overflow-x: clip`); footer ikut `modal-footer` §4b |
| `tabs-icon-only` | `min 44px + center + label hidden` | SATU pola gantikan board + releases: `min-width/min-height 44px`, label `display: none`, teks tetap di `aria-label` (`font-size: 0` tanpa px lolos guard) |
| `api-tabs-strip` | `.api-page .tabs { position: static; padding: 4px 8px }` (global.css:13181) + `scrollIntoView({ block: 'nearest', inline: 'nearest' })` pada `.tab-active` saat `tab` berubah (ApiPage `workbenchTabsRef`) | Bar workbench API: base `.tabs` sticky `top: 40px` menempel di scrollport `.api-main` (bukan window) + base `padding: 0 0 4px` membuat strip band putih top-flush (0px atas/kiri, terukur di screenshot 956×88); override Tier-1 ini SCOPED `.api-page` — DocsNav/PageSkeletons/PublicProjectPage tetap base `.tabs` |
| `overlay-clamp` | `100vw-16 / 100dvh-16` | SEMUA popover/sheet/menu: `position: fixed + max-width: calc(100vw-16px) + max-height: min(320px, 100dvh-16px)` + flip atas-bawah + clamp kiri/kanan + reposition saat scroll/resize (pola `RowMenu.tsx`) |

Rules:

- Overlay/dropdown/menu/kalender baru WAJIB portal ke body + `overlay-clamp` + `stopPropagation` (cermin §10 `menu-kebab`).
- Primitif terencana (Fase 1, API di `coding-standards.md` §6): `ModalFooter/ConfirmFooter`, `PageHeader`, `Section + SettingsRowGroup` — susunan manual footer/header/section baru DILARANG setelah primitif tersedia.

---

## 10. Menu, select, chip, card, skeleton, drawer (Sep-2026)

Pola Sep-2026 untuk baris/aksi padat + seleksi + kartu responsif.
Sumber: `RowMenu` (`app/src/components/RowMenu.tsx`), `SearchableSelect`
mount-emit guard + test, portal `DatePicker`, `common:xxx` i18n,
upload TUS + fallback PUT + `isUploadAuthError`
(`app/src/lib/attachmentUpload.ts`), whiteboard kind `embed`.

| Token / pola | Value / kelas | Role |
|---|---|---|
| `menu-kebab` | `RowMenu` trigger kebab icon-only + `stopPropagation` di trigger + menu | Aksi baris (Templates, Labels, dsb.) tanpa memicu row-click/navigasi; overlay pakai `bg-overlay` (§3), target sentuh ikut `btn-icon` (§9) |
| `skeleton-kebab` / `template-skeleton-kebab` | skeleton mirror layout kebab | Loading Templates/row mirror posisi kebab agar tidak shift saat data datang |
| `select-mount-emit` | `SearchableSelect`: JANGAN emit `onChange` saat mount; hanya pada pilih user (guard + regression test) | Mencegah reset/filter ke-trigger saat inisialisasi |
| `select-portal` / `datepicker-portal` | dropdown/kalender via portal ke body | Keluar dari `overflow:hidden` kartu/modal; tidak dipotong ancestor |
| `chip-wrap` | flex-wrap chips, tanpa truncate | Baris label/meta membungkus, bukan overflow |
| `label-chip-no-maxwidth` | label chip TANPA `maxWidth` | Label penuh terbaca + wrap (bukan ellipsis paksa) |
| `grid-minmax-card` | grid `repeat(auto-fill, minmax(...))` | Kartu responsif tanpa flex-percentage-math (cf. coding-standards §9) |
| `project-card-title-block` | judul kartu `display:block` | Perbaiki ellipsis/wrap judul project-card |
| `templates-icon-only` | aksi Templates icon-only di sempit | Hemat ruang; label penuh hanya di lebar cukup |
| `labels-kebab-mobile` | Labels/Templates pindah ke kebab di mobile via `useIs*Narrow` hooks | Satu mekanisme aksi di layar kecil (paired JS+CSS, cf. §4 thresholds 640px) |
| `mini-row-actions` | `.mini-row` relative + `.mini-row-actions` (absolute `right:0; top:50%`, idle `opacity:0`/`pointer-events:none`) + `.mini-row-meta` (fade saat aksi tampil) + `.mini-row-body` (geser `var(--mini-actions-reserve, 32px)` tanpa transisi) | Aksi hover baris (Labels count, Attachment nama-file, Checklist judul) TANPA ruang cadangan idle; hover/fokus menggantikan konten terakhir; `hover:none` kembali in-flow + selalu tampil; baris tanpa aksi (`:empty`) tak menggeser konten |
| `drawer-settings` | drawer untuk Settings di sempit | Panel pengaturan jadi drawer, bukan kolom terjepit |
| `common-ns-key` | aksi umum via `common:` (`defaultNS: common`, 6 ns + paritas EN/ID) | `save/sort/select/presence/activity/error` milik `common`, bukan duplikat per-ns |
| `upload-tus-fallback` | upload TUS + fallback PUT + `isUploadAuthError` | Resume besar via TUS; fallback PUT saat TUS tak tersedia; 401/403 dibedakan via `isUploadAuthError` (bukan retry buta) |
| `whiteboard-embed` | whiteboard kind `embed` (SVG wireframe) | Konten AI-generated di kanvas; disanitasi allowlist, max 20/board |

Rules:

- RowMenu WAJIB `stopPropagation` (trigger + menu container).
- Select/datepicker baru WAJIB portal + mount-emit guard + test.
- Chip/label baru WAJIB wrap tanpa `maxWidth` paksa.
- Grid kartu baru WAJIB `minmax`, bukan flex `%`.
- Token i18n umum baru WAJIB `common:` + EN/ID paritas dalam PR yang sama.
- Upload baru WAJIB lewat `attachmentUpload.ts` (TUS → fallback PUT, auth error via `isUploadAuthError`).

---

## 10c. Hidden actions & icon hints (Okt-2026)

Satu mekanisme kanonik menggantikan 5 mekanisme lama yang hidup berdampingan
(`opacity` saja / `opacity+pointer-events` / `opacity+visibility` /
`max-width+opacity+visibility` / `display:none` — audit 2026-10-04). Referensi
kanonik: `.mini-row-actions` (`global.css:23346-23400`).

### Kriteria pemakaian (komponen baru WAJIB ikut matriks ini)

| Situasi | Pola |
|---|---|
| Baris list padat, ≥1 aksi edit/delete non-primer | **Hidden row action** (kanonik di bawah) — aksi hapus tunggal pun hidden, bukan selalu tampak |
| 1 aksi primer/satu-satunya (settings-row, `.settings-row-actions`) | **Selalu tampak** — jangan disembunyikan |
| >2 aksi, atau layar sempit/sentuh | **`RowMenu` kebab** (ikut rule `menu-kebab` §10) |
| Pencil/chevron di sebelah label/field yang bisa diedit | **Icon hint** (kanonik di bawah) |

### Mekanisme kanonik hidden row action

Idle `opacity: 0` + `pointer-events: none` (overlay absolute — idle TIDAK
menyisakan gap, keputusan §6 2026-10-03); reveal `:hover` + `:focus-within`
pada row (WAJIB dua-duanya agar Tab mencapai aksi); konten yang digantikan
fade-out (pola `.mini-row-meta`); body geser `var(--mini-actions-reserve)`
(token di `tokens.css`); `@media (hover: none)` kembali in-flow + selalu
tampil; motion opacity saja (§9); icon-only ikut ladder §9 + `<Tooltip>`
`tooltip-icon-btn` + `aria-label` (44px touch otomatis).

**Dilarang:** `display: none` / `visibility: hidden` sebagai reveal (keluar
dari tab order → jalur keyboard 2-langkah); trigger hanya `:focus-visible`
tanpa `:focus-within`; mekanisme reveal baru (wajib pakai pola ini);
`opacity: 0.6` di touch (touch = tampak penuh, bukan setengah).

### Mekanisme kanonik icon hint

`opacity: 0` → reveal `:hover` / `:focus-within` (+`:focus-visible` untuk
tombol); dekoratif = `aria-hidden` + `pointer-events: none`; interaktif =
`<button>` + `aria-label` + focus ring (§9); `hover: none` → tampak;
`max-width: 640px` → `display: none` kecuali revert eksplisit
(`.page .detail-side .prop-edit`). Varian resmi: **dim hint** (idle
`opacity: 0.55`, mis. `.version-row-eye`) — khusus affordance "ada detail",
bukan aksi tersembunyi. `PropRow` hanya sah di dalam `.detail-side`
(rule `.prop-edit` di-scope di sana — di luarnya pensil tampak permanen).

### Migrasi 2026-10-04 (semua pola existing → kanonik, tanpa rename class)

`.mini-row-actions` referensi (nol ubah); `.mini-del` dilepas dari double-gate
+ backfill Tooltip Labels/Checklist; `.swap-group` + `.chat-msg-actions` +
`.wb-card-actions` + `.api-tree-actions` dikonversi ke overlay opacity
(status/tree-label jadi meta yang fade); `.task-card-pin` + `.erd-handle`
sudah kanonik (verifikasi); `.pin-toggle` + `.welcome-row-chevron` diperbaiki
kasus touch (tidak tampil / 0.6 → tampil penuh); `.sidebar-add-btn-team`
CSS mati dihapus; `.settings-row-actions`/`.row-kebab` pengecualian
selalu-tampak.
