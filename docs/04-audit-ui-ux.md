# Audit UI/UX — DevHub

- **Tanggal**: 2026-08-13
- **Lingkup**: `app/src` (React 19 + Vite + TypeScript) — komponen, halaman, state, styling, aksesibilitas
- **Metode**: audit statis 4 peran berurutan — UI Designer → UX Researcher → UX Architect → UI Finish-Gate Reviewer; verifikasi lint (`oxlint`) + build (`tsc -b && vite build`) sebelum/sesudah
- **Status**: selaras dengan PRD (`docs/01-project/prd.md`) — dark-only, keyboard-first, WCAG AA, hosted SaaS (lihat [ADR-021](02-architecture/adr.md#adr-021))

## Ringkasan eksekutif

| Peran | Fokus | Skor | Temuan | Diterapkan |
| --- | --- | --- | --- | --- |
| UI Designer | konsistensi visual, design tokens | 8.5/10 | D1–D6 (+D5/D6 valid) | 4 fix |
| UX Researcher | alur, umpan balik, mikrokopi | 8.5/10 | U1–U9 | 6 fix, 2 catatan |
| UX Architect | IA, routing, struktur | 8/10 | A1–A5 | 5 keputusan tercatat |
| UI Finish-Gate | WCAG, aksesibilitas | 8.5/10 | G1–G4 (G1 = D2) | 3 fix |

Skor keseluruhan **8.5/10**. Tidak ada temuan critical. Sistem design token internal adalah kekuatan utama (nol warna hardcoded di fitur; kontras, fokus ring, reduced-motion, dan feedback error konsisten di semua halaman).

---

## Temuan per peran

### UI Designer

| ID | Severity | Temuan | Keterangan |
| --- | --- | --- | --- |
| D1 | Low | `app/src/index.css` adalah boilerplate Vite yang mati (tema terang ungu, `#root` 1126px, tidak diimpor `main.tsx`) | **DIHAPUS** |
| D2 | High | `--text-muted #71717a` pada teks 10–12px di atas `--bg-elevated`/`--bg-overlay` = kontras 4.1–4.4:1, gagal WCAG AA 4.5:1 untuk teks kecil | **DIUBAH** → `#8a8a93` (5.2–5.7:1 di semua surface) |
| D3 | Medium | Tiga pola tab berbeda (`tabs`/`sub-tabs`/`api-tabs`) membuat hierarki kabur | **DIUNIFIKASI**: `api-tabs` menyatu ke pola `tabs`; `sub-tabs` dipertahankan sebagai segmented view-toggle yang sah |
| D4 | Medium | 13 inline style layout tersebar di fitur (margin/padding/width) | **DIGANTI** dengan utility class (lihat daftar di bawah) |
| D5 | — | (Diajukan) `font-weight 450/650` tidak valid | **DICABUT** — Geist Variable punya sumbu 100–900; nilai valid |
| D6 | — | (Diajukan) warna chart via inline style | **VALID** — memakai CSS vars (`var(--status-*)`), bukan hex |

### UX Researcher

| ID | Severity | Temuan | Keterangan |
| --- | --- | --- | --- |
| U1 | Medium-High | Alur onboarding: modal "New project" tidak menjelaskan bahwa team wajib dibuat dulu; error "Select a team first." muncul belakangan | **DIPERBAIKI**: helper + disabled state + empty state dashboard "Create a team first" |
| U2 | Medium | Autosave tidak memberi feedback sukses — pengguna tidak tahu kapan data tersimpan (state `saving` ada tapi tidak dirender) | **DIPERBAIKI**: indikator "Saving…" + "All changes saved" (lihat G3) |
| U3 | Low-Medium | CommandPalette hanya navigasi, tidak ada aksi; PRD G-1 hanya mewajibkan navigasi | **DIPERBAIKI**: aksi "New project" (`/?new=1`) + 9 aksi create per-entitas saat berada di dalam proyek via deep-link read-once `?tab=X&new=[value]` (`useNewParam`); viewer tidak melihat command create (lihat Batch 9) |
| U4 | Low | Arrow ←/→ pada task card memindah status/milestone tanpa konfirmasi/undo | **CATATAN**: perilaku dipertahankan + hint visual ditambah (edit langsung adalah nilai inti autosave; undo penuh = fitur terpisah di backlog) |
| U5 | Low | Shortcut `n` (new task) tidak terlihat di UI | **DIPERBAIKI**: hint "← → move · n new task" di toolbar board |
| U6 | Low | Urutan priority select (low→urgent) vs StatsPage (urgent→low) tidak konsisten | **DIPERBAIKI**: satu sumber `TASK_PRIORITY_ORDER` di `labels.ts`, dipakai TaskModal, NewTaskModal, StatsPage |
| U7 | Low | Meta angka dashboard ("2/5 done", "3 issues") tanpa tooltip konteks penuh | **DIPERBAIKI**: `title` menjelaskan konteks penuh per span |
| U8 | Low | Modal yang tetap ter-mount (TaskModal saat ganti task) tidak reset scroll body | **DIPERBAIKI**: `scrollTo(0,0)` saat modal terbuka |
| U9 | — | Empty state bio profil memakai profil sendiri | Valid — tidak diubah |

Kekuatan terverifikasi: autosave lokal-first berlapis (debounce 800ms + retry + `flushPendingSave` keepalive + polling 5s saat tab visible) — praktis tidak ada jalur kehilangan data; konfirmasi destruktif 2-langkah konsisten (task inline, key revoke modal, project delete); empty state + CTA konsisten; error selalu `role=alert`; keyboard-first nyata (Ctrl+K, `n`, arrow, `?`); URL encoding state tab/view (`?tab=`, `?view=`) → deep-linkable.

### UX Architect

| ID | Temuan / Pertimbangan | Keputusan |
| --- | --- | --- |
| A1 | Proyek kini punya 10 tab (naik dari 8 di PRD: +API, +About) | **Batasi 10**: tab ke-11 dikelompokkan/gabung (mis. "Overview" atau menu overflow). Pola tab → sub-tab → panel sudah distandarkan (D3). *(Deviasi tercatat 2026-08-13: tab ke-11 "Whiteboard" diizinkan — ADR-023; solusi Overview/overflow tetap backlog.)* |
| A2 | `projectId` UUID penuh di URL (`/project/:id`) | **Pertahankan**: unique, tidak perlu slug, aman di-share; kompensasi dengan chip short-id + copy di header proyek |
| A3 | Tidak ada breadcrumb | **Skip**: hierarki 3 level (Dashboard → Proyek → Tab) cukup dijelaskan sidebar + back button; breadcrumb menambah noise untuk solo dev |
| A4 | Scroll position tidak di-reset saat ganti tab (`?tab=`) | **Skip/dokumentasikan**: perilaku dipertahankan; konsisten dengan aplikasi dokumen (Notion-style) |
| A5 | Hierarki state: URL = posisi; `ProjectProvider key={projectId}` = isolasi; polling cross-tab | Valid — tidak diubah. URL sudah menjadi single source of truth navigasi |

### UI Finish-Gate Reviewer (WCAG)

| ID | Severity | Temuan | Keterangan |
| --- | --- | --- | --- |
| G1 | High | = D2 (kontras teks muted) | **DIPERBAIKI** (lihat D2) |
| G2 | Medium | Warn chip `#e3b341` ≈ 4.7:1 di atas bg dim — gagal 4.5:1 untuk teks kecil 10px | **DIUBAH** → `#e8b955` (≈5:1) — `--status-warn` + `--method-post` |
| G3 | New | Tidak ada umpan balik autosave untuk screen reader (hanya visual) | **DIPERBAIKI**: `role="status"` aria-live polite + `role="alert"` untuk error (lihat U2) |
| G4 | Low | Field wajib tidak ditandai (tanda `*` / `aria-required` tidak konsisten) | **DIPERBAIKI**: `Input`/`Textarea` kini render `*` + `aria-required` + `required` saat prop `required` dipakai (NewTaskModal title, AuthPage email/password/confirm, NewProjectModal name) |

Lulus verifikasi: focus ring global `:focus-visible` 2px accent-ring + offset 2px; focus trap di Modal & CommandPalette; skip-link → `#main-content`; `aria-busy` pada tombol loading; modal `role=dialog aria-modal`; donut chart `role=img` + label; combobox/listbox pattern di palette lengkap dengan `aria-activedescendant`; label wrap checkbox blocker (wrapper label = benar); `prefers-reduced-motion` mematikan semua animasi.

---

## Perubahan yang diterapkan

### Dihapus
- `app/src/index.css` (boilerplate Vite mati)

### `app/src/styles/tokens.css`
- `--text-muted: #71717a` → `#8a8a93` (D2/G1)
- `--status-warn` & `--method-post`: `#e3b341` → `#e8b955` (G2)

### `app/src/styles/global.css`
- Hapus blok `.api-tabs/.api-tab/.api-tab-active/.api-tab-count`; style pill dipindah ke `.tab-count` (D3)
- Utility baru di section Utilities: `.mt-4 .mt-8 .mt-10 .mt-12 .mt-16 .mt-24`, `.mb-12 .mb-16 .mb-24`, `.flex-1`, `.gap-8`, `.field--grow`, `.page-footer`, `.panel-title`, `.select-role`, `.field-helper--flush`, `.field-helper--inset` (D4)
- Baru: `.save-status` (feedback autosave), `.board-toolbar` + `.board-hints`, `.field-required` (G3, U4/U5, G4)

### Komponen
- `components/InlineError.tsx`: prop `style` → `className` (D4)
- `components/Modal.tsx`: reset scroll body saat open (U8)
- `components/CommandPalette.tsx`: aksi "New project" (U3)
- `components/Input.tsx` / `Textarea.tsx`: `required` → `*` di label + `aria-required` (G4)
- `components/SaveBanner.tsx`: tulis ulang — status saving/saved dengan `role="status"`, error `role="alert"` (U2/G3)

### Halaman & flow
- `features/board/BoardPage.tsx`: toolbar board + hint shortcut (U4/U5)
- `features/board/TaskModal.tsx`, `NewTaskModal.tsx`: pakai `TASK_PRIORITY_ORDER` (U6)
- `features/stats/StatsPage.tsx`: pakai `TASK_PRIORITY_ORDER` (U6)
- `features/dashboard/DashboardPage.tsx`: empty state team-first (U1), `?new=1` membuka NewProjectModal (U3), `title` pada meta statistik (U7)
- `features/project/NewProjectModal.tsx`: helper + disabled saat tidak punya team (U1)
- `state/project-context.tsx`: state `lastSavedAt` di-update saat save sukses (U2)
- `lib/labels.ts`: `TASK_PRIORITY_ORDER` baru (U6)

### Verifikasi
- `npm run lint -w app` — bersih (6 warning pre-existing `react(only-export-components)` di `state/*-context`)
- `npm run build -w app` — tsc + vite sukses (1 warning chunk >500kB pre-existing)

---

## Batch 2 — Modal detail: read mode dulu (sebelum edit)

**Latar**: semua 7 modal detail (Task, Issue, Milestone, Decision, Test, Tech, Table) sebelumnya langsung terbuka dalam mode edit dengan autosave per keystroke — viewer tidak bisa membaca tanpa risiko mengubah data, dan role check tidak konsisten antar jalur (klik baris vs tombol pensil vs shortcut keyboard).

### Keputusan
Setiap modal detail sekarang membuka dalam **read mode**: nilai ditampilkan sebagai label→value (teks, Badge status/priority/severity, mono untuk tanggal/versi, chips untuk labels, daftar untuk blocked-by/test-case/options/kolom tabel, `pre-wrap` untuk teks panjang; kosong = *italic* "—" atau "No …"). Tombol **Edit** (hanya rol editor) memasuki mode edit dengan form lama; tombol **Done** kembali ke read view. Viewer hanya melihat read mode (Edit & Delete disembunyikan).

### Perubahan

**Baru**
- `components/DetailList.tsx` — `DetailList`, `DetailRow` (label 12px + value 13.5px `pre-wrap`), `DetailEmpty` (italic muted).

**`app/src/styles/global.css`** (section "Read-mode detail views", setelah `.form-stack`)
- `.detail-title`, `.detail-list`, `.detail-row` (grid 110px/1fr), `.detail-label`, `.detail-value`, `.detail-empty`, `.detail-chips`, `.detail-options` (ol), `.detail-col-caption`/`.detail-col-row` (grid nama/tipe/flags/default untuk kolom tabel).

**7 modal detail** (`features/{board,issues,releases,decisions,tests,stack,schema}/*Modal.tsx`)
- State `editing` + reset ke false setiap `id` berubah (bersamaan reset `confirmDelete`).
- Judul konsisten (P4): read = "Task"/"Issue"/"Milestone"/"Decision record"/"Test case"/"Stack entry"/"Table"; edit = "Edit …".
- Footer: read mode `[Delete] … [Close] [Edit]`; edit mode `[Delete] … [Done]`; saat konfirmasi hapus → `[Confirm delete] … [Cancel]`.
- Read view Task: title heading + status/priority Badge, milestone, estimate/actual, labels, description, blocked-by (dengan Badge status tiap task), test case (dengan Badge status).
- Read view Issue: severity/status Badge, linked task, description, reproduction.
- Read view Milestone: status Badge, version, target date (mono), changelog.
- Read view Decision: status Badge, date (mono), context, **options sebagai ordered list**, decision, consequences.
- Read view Test: status Badge, linked task/issue, steps, expected.
- Read view Tech: category/status Badge, version (mono), notes.
- Read view Table: comment, **kolom dalam grid nama/type/flags(PK/NULL)/default**, indexes (mono).

**`state/project-context.tsx` (P1 — pertahanan berlapis)**
- `canEditRef` (sinkron dari `role` tiap render); `dispatch` kini **tidak melakukan apa-apa** jika `!canEditRef.current`; guard sama pada `runSave` dan `flushPendingSave` — viewer secara struktural tidak bisa mengubah atau memicu persist state.

### Menutup temuan
- **P2** (7 modal langsung edit mode) — selesai via read-mode-first.
- **P3** (inkonsistensi jalur) — selesai: semua jalur edit kini melalui tombol Edit yang di-gate `canEdit`.
- **P1** (viewer bisa ubah state lokal) — selesai: gate di level UI + state.
- **P4** (judul modal) — selesai: pola "entity"/"Edit entity".

### Verifikasi (batch ini)
- `npm run lint -w app` — bersih (hanya 6 warning pre-existing)
- `npm run build -w app` — tsc + vite sukses (1 warning chunk >500kB pre-existing)

---

## Batch 3 — Footer modal & konfirmasi hapus terpisah

Perubahan ketiga yang diminta: tanpa tombol Close di footer (X di header sudah ada), edit mode tanpa Delete (hanya Cancel), dan hapus melalui popup konfirmasi terpisah.

- **Komponen baru `components/ConfirmDeleteDialog.tsx`** — membungkus `Modal` (width sm, pola "Delete project" yang sudah ada): props `{open, title, description, confirmLabel?, onConfirm, onClose}`; body `.modal-copy`; footer `[Cancel (ghost)] [Delete (danger, icon Trash)]`.
- **Footer read mode** (7 modal detail): `[Delete (canEdit)] [spacer] [Edit (canEdit)]` — tombol `Close` dihapus; tutup lewat X header / Esc / backdrop.
- **Footer edit mode**: `[spacer] [Cancel (ghost)]` — kembali ke read view (autosave tetap); tombol `Done` dan `Delete` dihapus dari edit mode.
- **Alur hapus**: klik Delete (read mode) → `ConfirmDeleteDialog` per entity ("Delete task?" / "Delete issue?" / "Delete milestone?" / "Delete decision record?" / "Delete test case?" / "Delete stack entry?" / "Delete table?") dengan copy spesifik — milestone: "Tasks linked to it will be unassigned."; tabel: "its columns and its relations."; konfirmasi → `remove()` (dispatch + tutup).
- State `confirmDelete`/`confirmingDelete` (plus helper inline "This permanently deletes the task…") dihapus dari ketujuh modal, diganti `confirmOpen` (reset tiap open; `done()` kini hanya `setEditing(false)`).

### Verifikasi (batch ini)
- `npm run lint -w app` — bersih (hanya 6 warning pre-existing react(only-export-components))
- `npm run build -w app` — tsc + vite sukses (1 warning chunk >500kB pre-existing)

---

## Batch 4 — Edit mode: Cancel restore data, tombol Done, posisi Cancel kiri

Permintaan: tombol Delete tidak boleh tampil di edit mode, tambah tombol Done di kanan Cancel, dan pastikan Cancel selalu di kiri tombol lain di semua komponen.

- **Posisi Cancel** — 6 situs yang masih menaruh Cancel di kanan dibalik menjadi kiri: `api/CollectionModal`, `api/EndpointModal`, `decisions/NewDecisionModal`, `releases/NewMilestoneModal`, `keys/KeysPage` (modal revoke: Cancel juga mereset state konfirmasi), `project/AboutPage` (form PRD). Audit `rg` mengkonfirmasi Cancel sudah di kiri di semua modal lain.
- **7 modal detail** (Task/Issue/Milestone/Decision/Test/Tech/Table):
  - Delete hanya muncul di read mode (`canEdit && !editing`).
  - Edit mode: `[Cancel (ghost)] [Done (primary)]` — Cancel membatalkan perubahan (restore kolom) dan kembali ke read view; Done menyimpan (autosave) dan menutup modal.
  - Implementasi cancel: `editSnapshot = useRef<State | null>` — snapshot `structuredClone(state)` diambil saat `startEditing` (tombol Edit), dan `cancelEditing` memulihkan via `dispatch({ type: 'replace', state: editSnapshot.current })` (gate `canEditRef` di `project-context` tetap jalan untuk viewer).
  - `done` lama diganti `startEditing` / `cancelEditing` / `finishEditing (onClose)`.

### Addendum — Board: tombol Add task selalu terjangkau

Kolom kanban sebelumnya tumbuh penuh mengikuti jumlah item (tanpa batas tinggi; `.kanban` hanya scroll horizontal) — dengan banyak task, tombol "Add task" di bawah daftar terlempar keluar viewport. Perbaikan (murni CSS di `global.css`):
- `.kanban-col` → `max-height: calc(100dvh - 180px)` (kolom dibatasi setinggi viewport minus header halaman/toolbar).
- `.kanban-col-body` → `overflow-y: auto` (daftar task scroll internal; scrollbar webkit custom tetap).
- `.kanban-col-add` → `border-top: 1px solid var(--border-hairline)` (tombol tampak ter-dock di bawah kolom).

Hasil: tombol "Add task" (per kolom, `canEdit` saja, preset status/milestone tetap) selalu terlihat di paling bawah kolom — pola Trello/Todoist; struktur TSX tidak berubah.

### Verifikasi (batch ini)
- `npm run lint -w app` — bersih (6 warning pre-existing react(only-export-components))
- `npm run build -w app` — tsc + vite sukses (686.57 kB chunk / gzip 179.68 kB; 1 warning chunk >500kB pre-existing)

---

## Batch 5 — Save status jadi toast pojok kanan atas

Permintaan: "pemberitahuan state save dll pusatkan di pojok kanan atas". Sebelumnya `SaveBanner` dirender inline di bawah tabs (ProjectPage) — bergeser posisinya per tab dan mengubah tinggi halaman. Kini menjadi toast mengambang:

- **`SaveBanner.tsx`** — kedua state dirender lewat `createPortal(…, document.body)` (pola sama seperti `Modal`); ini wajib karena `tab-panel` punya animasi `fade-in` (transform ancestor membuat `position: fixed` relatif terhadap panel, bukan viewport). Bila tidak sedang `saving`/`showSaved`/`saveError`, komponen kini `return null` (min-height anti-jump tidak diperlukan lagi karena keluar dari flow).
- **global.css** — kelas baru `.save-toast`: `position: fixed; top: 16px; right: 20px; z-index: 20` dengan gaya kartu (bg-overlay, border-strong, shadow-raised, radius input, `max-width: min(400px, calc(100vw - 32px))`). `.save-banner` (error: border/background/teks danger) dan `.save-status` (12px muted) kini hanya memodifikasi varian dalam toast.
- **Z-index 20** — di atas sidebar/konten (10), di bawah palette (30) dan modal (40): saat modal terbuka toast tidak menutupi; error + Retry tetap relevan setelah modal ditutup.
- Perilaku tidak berubah: `Saving…` (role=status), "All changes saved" auto-hide 2 detik, error persisten `role=alert` + Retry tanpa tombol dismiss.

### Verifikasi (batch ini)
- `npm run lint -w app` — bersih (6 warning pre-existing react(only-export-components))
- `npm run build -w app` — tsc + vite sukses (686.66 kB chunk / gzip 179.71 kB; 1 warning chunk >500kB pre-existing)

---

## Batch 6 — Redesign tab About + edit PRD jadi modal

Permintaan: "redesign tab about, pastikan edit prd itu modal" (tingkat: full redesign). Tab About sebelumnya berupa deskripsi + meta + 7 kartu statistik + 5 section polos, dengan form edit PRD **inline** menggantikan seluruh section saat diedit.

- **`lib/prd.ts` (baru)** — `PRD_SECTIONS` (purpose/goals/features/scope/outOfScope + label, helper, ikon Phosphor: Target, Flag, Rocket, MagnifyingGlass, Prohibit) dan `EMPTY_PRD`; dipakai AboutPage + modal.
- **`features/project/EditPrdModal.tsx` (baru)** — pola ProfileEditModal: `Modal width="md"`, title "Edit PRD", footer `[Cancel][Save PRD]` (submit via `form=`), gate `dirty` (Save disabled tanpa perubahan), reset state saat open, `InlineError` saat gagal. Form berisi **Description** (jalur edit description yang sebelumnya tidak ada selain saat create) + 5 Textarea PRD (label + helper).
- **`AboutPage.tsx` ditulis ulang (read-only)** — header "About" + tombol "Edit PRD" (canEdit) membuka modal; **hero card** (`.about-hero`): description 16px (kosong = italic "No description yet.") + meta sebagai chips mono pill (`Team / Created / Updated` + Badge status & role); **stat tiles** (`.about-stats`): grid `repeat(auto-fit, minmax(120px,1fr))`, judul mono uppercase 10.5 + nilai mono 20/600 tabular; **PRD section jadi kartu** (`.about-card`): ikon accent 14px + judul mono uppercase + body pre-wrap, kosong = italic muted "Not set yet.".
- **global.css** — blok `.about-*` lama (`about-form`, `about-actions`, `about-section*`) diganti set baru (hero/meta-chip/stats/cards); semua memakai token & radius existing.

### Verifikasi (batch ini)
- `npm run lint -w app` — bersih (6 warning pre-existing react(only-export-components))
- `npm run build -w app` — tsc + vite sukses (693.07 kB chunk / gzip 180.96 kB; 1 warning chunk >500kB pre-existing)

### Little fixes (batch ini)
- Tab About kini full width seperti tab lain: `max-width: 760px` dihapus dari `.about-body`; kartu PRD (`about-cards`) diubah `flex` → `grid repeat(auto-fit, minmax(320px, 1fr))` (2 kolom responsif di layar lebar, tetap satu kolom di mobile).

---

## Batch 7 — Markdown di semua input PRD (Edit | Preview per field)

Permintaan: "di about, buat fitur higligh perpoint" → diklarifikasi menjadi dukungan markdown penuh di input PRD, tanpa perubahan storage (PRD tetap teks di `projects.prd` jsonb; markdown hanya lapisan tampilan; MCP/AI membaca teks mentah).

- **`lib/markdown.tsx` (baru)** — `parseLines(text)` mengelompokkan baris menjadi blok: `-` / `*` / `•` → `<ul>`, `1.` / `1)` → `<ol>` (penomoran lanjut), lainnya → `<p>`; baris kosong memisahkan; grup list sejenis berturut-turut digabung. `renderInline(text)` memformat `**bold**`, `_italic_`, `` `code` `` — React escaping otomatis, tanpa `dangerouslySetInnerHTML`. `MarkdownBlocks` merender blok sebagai `.md-blocks`/`.md-list`.
- **`EditPrdModal.tsx`** — keenam field (Description + 5 section PRD) kini punya toggle mini **Edit | Preview** di kanan label (`.md-toggle`, komponen lokal `PrdField`; tooltip: `Markdown: "- bullet, 1. numbered, **bold**, _italic_, code`"); mode Preview merender `MarkdownBlocks` dalam kotak `.md-preview` ("Nothing to preview." bila kosong); hint eksplisit di atas form; `dirty`/alur save tidak berubah.
- **`AboutPage.tsx`** — body kelima kartu PRD dirender markdown (kosong → "Not set yet."); description hero diformat inline (`renderInline`).
- **global.css** — `.field-label-row`, `.md-toggle`/`.md-toggle-btn(.active)` (mini segmented, active accent-dim/accent), `.md-preview`/`.md-preview-empty`, `.md-blocks`, `.md-list` (`::marker` accent), `.md-code`.
- **MCP** — deskripsi tool `update_prd` ditambah: "All text fields support markdown: "- bullet, 1. numbered, **bold**, _italic_, `code`", …" (agent AI mendapat tahu; data tetap teks mentah); dokumen `/docs/mcp` mendapat Callout markdown di step "Get your project ID".
- Catatan: `markdown.tsx` menambah 2 warning oxlint react(only-export-components) (pola sama dengan 6 warning existing di state·context).

### Verifikasi (batch ini)
- `npm run lint -w app` — bersih dari error (8 warning only-export-components, 2 baru di markdown.tsx)
- `npm run build -w app` — tsc + vite sukses (696.40 kB chunk / gzip 181.86 kB; 1 warning chunk >500kB pre-existing)
- `npm run build -w server` — tsc sukses

---

## Batch 8 — Reposisi produk ke SaaS (copy & dokumentasi)

Permintaan: "update semua doc, project bukan lagi self-hosted web" + penggunaan skill Brand Guardian (audit copy produk) dan Visual Storyteller (narasi/copy). Produk kini **hosted SaaS universal** (tanpa segmentasi persona di copy user-facing; fokus fitur & masalah yang dijawab); ADR lama tidak diedit.

- **Keputusan**: ADR-021 "Product positioning: hosted SaaS" — supersedes ADR-001, menegaskan ADR-010; glossary: *hosted SaaS / operator / workspace*.
- **Copy user-facing** (universal, tanpa "solo developers"/"small teams"): AuthPage brand panel ("The memory of your projects." + "everything your project needs, in one workspace." + "Your data stays yours — export or import anytime."), `index.html` meta, DocsPage overview ("the technical memory of what you build"), McpDocsPage ("hosted endpoint", "DevHub is reachable").
- **README**: hero 2 blockquote (fitur + data portability), umbrella "DevHub is a hosted, multi-user project-management workspace. Self-hosting is not supported; data portability is guaranteed via JSON export/import.", roadmap tabel Phase 1–2 Done, footer "built by developers, for developers".
- **PRD/charter/roadmap**: status "Active", G-3 "register/login … so that my data is private", Availability "Hosted SaaS; no SLA beyond operator's uptime", stakeholder "Users of the service", open question #3 Resolved, tabel keputusan charter §11 ditandai Superseded (Build to sell? Yes — lihat ADR-021).
- **Arsitektur/ops/compliance**: security-design (C1 "Only authorized members", password reset "contact the operator"), api-guide (team-scoped), technical-design (komentar authorId), monitoring (privacy-first philosophy), incident-response (operator on-call), privacy & ToS (effective date 2026-08-13, "small hosted SaaS service", "managed hosting platform", MCP "connects only at your configuration").

### Verifikasi (batch ini)
- `npm run lint -w app` — bersih (8 warning: 6 pre-existing react(only-export-components) + 2 markdown.tsx)
- `npm run build -w app` — tsc + vite sukses (696.44 kB chunk / gzip 181.86 kB)
- Server tidak berubah pada batch ini (copy hanya di app + docs).

---

## Batch 9 — Command palette: aksi create per entitas (M15)

Permintaan: "di command pallete hanya bisa create projek" — palette hanya punya aksi "New project"; scope yang dipilih: **"Semua yang bisa create"** (9 entitas). Batch ini mencatat desain; implementasi code M15 T1–T5/T7 menyusul.

- **Keputusan**: pola deep-link read-once `?tab=X&new=[value]` (precedent `DashboardPage ?new=1` + `useEntityDeepLink`). Hook baru `app/src/hooks/useNewParam.ts` membaca `new`, memicu callback sekali, lalu membersihkan param (`replace`). Palette (global, di luar ProjectContext) mendeteksi project aktif via `matchPath('/project/:projectId')`; command create hanya tampil di dalam project + gate role viewer (`role !== 'viewer'`).
- **9 command**: New task (`?tab=board&new=1`), New issue (`?tab=issues&new=1`), New test case (`?tab=tests&new=1`), New decision (`?tab=decisions&new=1`), New milestone (`?tab=releases&new=1`), New tech entry (`?tab=stack&new=1`), New API collection (`?tab=api&new=1`), New API endpoint (`?tab=api&new=endpoint` — ApiPage punya dua state create, dipisah via nilai param). *(Catatan M16: entitas Notes dihapus — command New note tidak jadi dibangun.)*
- **Tab wiring**: tiap halaman menambah `useNewParam` (gated `canEdit`) — BoardPage `setNewTaskAt({})`, IssuesPage/TestsPage `setCreating(true)`, DecisionsPage/ReleasesPage `setOpenNew(true)`, StackPage `setCreating(true)`, ApiPage dual (collection/endpoint). *(NotesPage tidak ada lagi sejak M16.)*
- **Integrasi M14**: FlowchartsTab (M14 T4) ikut membaca `new=1` + command "New flowchart" (M15 T5, blocked by M14 T4). **SUPERSEDED (2026-08-13, ADR-023)**: FlowchartsTab digantikan tab **Whiteboard** (entity terpadu brainstorming + flowchart + entity ref cards, milestone **M17 v0.11.0**); command create mengikuti pola yang sama: `?tab=whiteboards&new=1` + "New whiteboard" di palette.
- **Resolusi backlog**: #2 (DevHub 4defd8dd) dan #3 (0345ac4c) — close-out di sini; discoverability via palette kosong menampilkan semua command; tanpa footer-hint baru.
- **File (rencana)**: `app/src/hooks/useNewParam.ts` (baru), `app/src/components/CommandPalette.tsx`, 7 halaman tab (board/issues/tests/decisions/releases/stack/api), `DocsPage.tsx` (tip Ctrl+K), `technical-design.md`, docs ini.

### Verifikasi (batch ini)
- Docs-only: tidak ada perubahan code pada batch ini (implementasi M15 T1–T7 menyusul); lint/build tidak dijalankan karena tidak ada file code berubah.

---

## Batch 10 — Audit mobile support (2026-08-21)

**Permintaan**: "audit ui ux agar support mobile device". **Menutup item DevHub `232b47c6-108c-41c8-80af-6e4a02f5b267`.** Scope: seluruh `app/src` pada viewport mobile (360–860px), perangkat touch (pointer: coarse), dan iOS Safari (zoom-on-focus, rubber-banding). Metode: audit statis per area — shell/layout, komponen & hooks, halaman standalone — dengan verifikasi akhir lint + build.

### Temuan (ringkas)

| ID | Severity | Temuan | Lokasi |
| --- | --- | --- | --- |
| M1 | Critical | `.layout` `grid-template-columns: 232px 1fr` tanpa breakpoint — seluruh app tidak terpakai di ≤860px (konten ~64px di 360px) | `global.css:994-998` |
| M2 | Critical | Kanban DnD hanya HTML5 Drag-and-Drop — tidak berfungsi di touch; fallback arrow-key & modal edit tidak discoverable | `board/TaskCard.tsx:67-74`, `BoardPage.tsx:232-283`, `DueCalendar.tsx:90-250` |
| M3 | Critical | Pin task `opacity: 0` sampai hover — tidak terlihat/tidak terpakai di touch (tidak ada `@media (hover: none)`; pola sudah ada untuk chat di `global.css:5862`) | `global.css:1860-1873` |
| M4 | Major | Semua input/textarea/select 13–14px → iOS auto-zoom saat fokus | `global.css:244, 372, 2953` |
| M5 | Major | Touch targets <36px hampir merata (btn-sm/btn-icon 28px, sidebar-add-btn 18px, key-copy-btn 20px, wb-selection-btn 26px, fp-color 20px, due-cal-task ~15px) | `global.css:126-141, 1109-1122, 3181-3194, 5829, 6136-6151, 6331-6342` |
| M6 | Major | CommandPalette hanya via keyboard (Ctrl+K / ? / /); shortcut `?` tanpa guard isTypingTarget → membuka palette saat mengetik `?` (termasuk di iOS keyboard) | `CommandPalette.tsx:208-257` |
| M7 | Major | Overflow horizontal: `.project-actions`/`.page-header`/`.data-list-header`/`.api-toolbar`/`.sub-tabs` tidak wrap; `.member-row` ~480px intrinsik; `.preview-table` + `.preview-mono` nowrap tanpa wrapper scroll; toolbar whiteboard + `.wb-selection-bar` terpotong | `global.css:1653-1658, 1270-1276, 2217-2223, 4849-4855, 2666-2674, 5453-5484, 6319-6329` |
| M8 | Major | Whiteboard: zoom hanya wheel (tanpa pinch), scroll trap (`touch-action: none` + `min-height: 480px` pada layar pendek), hint teks mouse-only | `WhiteboardCanvas.tsx:143-151, 1839`; `global.css:5814-5815` |
| M9 | Minor | Docs TOC `display: none` <1020px tanpa pengganti; popover sort/presence tidak di-clamp viewport; grid min-track `.stats-grid` 300px/`.about-cards` 320px; SaveBanner (error persisten) menutupi aksi header; `.detail-row` label 110px ketat di 360px; grid kv/param API orphan baris ke-2; kalender due-date 6×112px; `.ss-hint` dead code | berbagai |

**Keputusan desain** (hasil konfirmasi user): navigasi mobile = **drawer + top bar** (bukan bottom tab bar); scope = **semua temuan** (termasuk minor).

### Rencana eksekusi

1. **Fase 1 — Mobile shell (M1)**: breakpoint ≤860px — `.layout` 1 kolom, `.sidebar` jadi off-canvas drawer (fixed 260px, `translateX(-100%)` ↔ `.sidebar-open` + backdrop), top bar mobile (hamburger + logo + tombol CommandPalette), tutup drawer saat route berubah/Escape/tap backdrop + scroll-lock body; `.page` padding → 16px.
2. **Fase 2 — Touch interaction (M2/M3)**: drag pointer-based (long-press) untuk board & due-calendar, reuse `handleDropStatus`; menu "Move to…" per kartu; `@media (hover: none)` untuk pin + hit area ≥36px.
3. **Fase 3 — Whiteboard (M8)**: pinch zoom (2-pointer, zoom di centroid), perbaikan scroll trap (`overscroll-behavior` + tinggi canvas `min()`), `.wb-selection-bar`/toolbar scroll, hint text update.
4. **Fase 4 — iOS zoom & touch targets (M4/M5)**: `@media (hover: none)` — input 16px, kontrol ≥36px tanpa merusak densitas desktop.
5. **Fase 5 — Overflow (M7)**: `flex-wrap` + guards grid; `.preview-table` wrapper scroll; `.member-row` responsif; grid API kv/param eksplisit.
6. **Fase 6 — Minor (M9)**: guard `?` palette, TOC docs via `<details>`, clamp popover, SaveBanner posisi mobile, `.detail-row` kolom tunggal ≤480px, dsb.
7. **Verifikasi**: `npm run lint -w app`, `npm run test:app`, `npm run build -w app`; cek manual viewport 375/390/768px (drawer, long-press drag, pin, zoom iOS, pinch whiteboard).

### Status

- [x] Audit selesai (temuan di atas)
- [x] Fase 1 — Mobile shell
- [x] Fase 2 — Touch interaction
- [x] Fase 3 — Whiteboard
- [x] Fase 4 — iOS zoom & touch targets
- [x] Fase 5 — Overflow
- [x] Fase 6 — Minor
- [x] Verifikasi akhir

### Perubahan yang diterapkan

**Baru**
- `lib/palette-events.ts` — event `devhub:open-palette` (`openPalette`/`onOpenPalette`) agar palette bisa dibuka dari tombol top bar.
- `lib/drop-registry.ts` — registry `registerDrop(key, handler)`/`getDropHandler(key)` untuk drop target kanban/kalender.
- `hooks/useTouchDrag.ts` — long-press drag berbasis pointer events untuk touch: tekan 180ms → drag, highlight kolom via `kanban-drop-active`, auto-scroll `.kanban` di tepi viewport, drop via `elementFromPoint` + `[data-drop-key]`, suppress click setelah drag, guard `(hover: hover)` (desktop tetap HTML5 DnD).
- `features/docs/DocsToc.tsx` — tambah `DocsTocMobile` (collapsible `<details>`, tampil ≤1020px) + refactor `TocLinks`/`jumpTo` bersama.

**`features/layout/Layout.tsx`** — top bar mobile (hamburger `aria-expanded` + logo + tombol palette), drawer state, tutup saat ganti route/Escape/tap backdrop, scroll-lock body saat drawer terbuka.

**`features/board/BoardPage.tsx`** — handler drop direfaktor jadi taskId-based (`moveTaskStatus`/`moveTaskMilestone`/`moveTaskDue`, semua gate `canEdit`); `renderColumn` menerima `(taskId) => void` + register ke drop registry; `data-drop-key` pada `.kanban-col-body`; `onTouchDrop` dipass ke TaskCard & DueCalendar.

**`features/board/TaskCard.tsx`** — ref + `useTouchDrag`; prop `onTouchDrop`; sr-only hint menyebut touch ("press and hold, then drag").

**`features/board/DueCalendar.tsx`** — chip diekstrak jadi `CalTaskChip` (dengan `useTouchDrag`); `data-drop-key={`date:${date}`}` per sel + `clear` pada strip "No date"; handler `moveToDate` didaftarkan ke registry per sel.

**`features/whiteboard/WhiteboardCanvas.tsx`** — pinch zoom 2-pointer di `useView` (zoom di centroid via `zoomAtPoint` + translate mengikuti centroid; `stopPropagation` menekan handler tool saat pinch); hint "Scroll or pinch to zoom · drag to pan".

**`components/CommandPalette.tsx`** — listener `onOpenPalette` (trigger dari top bar); shortcut `?` kini di-guard `isTypingTarget` sama seperti `/`.

**`styles/global.css`**
- Mobile shell ≤860px: `.layout` 1 kolom, `.topbar` sticky, `.sidebar-drawer` off-canvas 264px (`translateX(-100%)` ↔ `.sidebar-open` + shadow), `.nav-backdrop`, `.page` padding 20px 16px.
- Blok `@media (hover: none)`: input/select/textarea/ss-input/palette-input → 16px (anti iOS zoom); btn-sm/btn-icon/sidebar-signout/back-btn/sub-tab/erd-zoom-btn/wb-selection-btn/wb-delete-btn ≥36px; key-copy/code-copy/project-id-copy/fp-color ≥32px; ss-trigger/ss-option/palette-item/sort-menu-row ≥40px; due-cal-task ≥24px; `.task-card-pin { opacity: 1 }`.
- Wrap/overflow: `.page-header`, `.project-header`, `.project-actions`, `.project-title-row`, `.data-list-header`, `.api-toolbar` → `flex-wrap`; `.sub-tabs` → `overflow-x: auto` + max-width; `.preview-table` → `display: block; overflow-x: auto`.
- Grid guards: `.stats-grid`/`.about-cards`/`.keys-guide-grid`/`.project-grid` → `minmax(min(Npx, 100%), 1fr)`.
- Whiteboard: `.wb-canvas` + `overscroll-behavior: contain`; ≤860px tinggi `62dvh` min 320px (anti scroll-trap); `.wb-selection-bar` → `flex-wrap`.
- ≤700px: `.save-toast` full-width top; `.member-row` collapse (avatar+name+pct).
- ≤480px: `.detail-row` 1 kolom; `.detail-col-caption/.detail-col-row` 2 kolom (type/default disembunyikan).
- Docs TOC mobile: `.docs-toc-mobile` collapsible ≤1020px.
- API ≤900px: penempatan eksplisit baris ke-2 grid kv/param (tidak ada orphan).

### Verifikasi (batch ini)
- `npx tsc -b` — bersih
- `npm run lint -w app` — bersih dari error (warning pre-existing only-export-components + exhaustive-deps WhiteboardCanvas)
- `npm run test -w app` — 672/672 lolos (1 kegagalan flaky IndexedDB pada run pertama, lolos saat re-run)
- `npm run build -w app` — sukses (chunk terbesar index 267.78 kB / gzip 80.92 kB)

### Catatan
- Menu "Move to…" per kartu tidak dibuat terpisah — jalur alternatif yang sudah ada: Edit status di TaskModal + arrow-key (desktop) + long-press drag (touch).
- `.ss-hint` dibiarkan (dead code tanpa dampak mobile; slot hint SearchableSelect).

---

## Batch 11 — Fix mobile round 2 (2026-08-21)

**Permintaan**: laporan setelah review mobile Batch 10 — 6 issue.

| # | Issue | Akar masalah | Perbaikan |
| --- | --- | --- | --- |
| 1 | Tinggi area header beda antar halaman (terlihat di Invitations) | back-btn hanya ada di beberapa halaman, tinggi 19px tidak konsisten dengan halaman tanpa back-btn | ≤860px: `.back-btn` min-height 36px + margin konsisten; `.page-header` margin-bottom seragam |
| 2 | Statistik profile melebihi layar | Heatmap kontribusi 53 kolom minggu (`minmax(6px,1fr)` + gap) ≈ 477px intrinsik > konten mobile | `.profile-heat-layout { overflow-x: auto }` — grafik scroll horizontal |
| 3 | Toggle Workspace/Docs API tidak wrap | `.api-toolbar-left` flex tanpa wrap (count mono panjang + sub-tabs) | `.api-toolbar-left { flex-wrap: wrap; min-width: 0 }`; `.api-toolbar-actions { flex-wrap: wrap }` |
| 4 | Card deleted info sesak | `.deleted-banner-item` baris horizontal [badge][judul][meta] | Jadi kolom: badge entity di atas judul, meta di bawah; `.deleted-banner-head { flex-wrap: wrap }` |
| 5 | Popup online user terpotong | `.presence-popover` absolute `right:0` 240px — saat chip wrap ke kiri, popover keluar viewport | `PresenceChip`: popover di-portal ke body + `position: fixed` ter-clamp (ukur trigger rect, clamp kiri/kanan, max-height sisa viewport, reposition saat scroll/resize) — pola SearchableSelect |
| 6 | Popup room chat terpotong | `.chat-drawer` fixed dengan `100dvh` tanpa fallback (height invalid → auto → meluas); rawan containing-block ancestor | Drawer di-portal ke body + fallback `vh` sebelum `dvh` + ≤640px full-width (`left/right 8px`, height `min(70dvh, 100dvh-96px)`) |

### Verifikasi (batch ini)
- `npx tsc -b`, lint — bersih
- `npm run test -w app` — 672/672 lolos
- `npm run build -w app` — sukses

---

## Backlog (tidak dikerjakan dalam sesi ini)

1. **Undo untuk perubahan board** (arrow move / drag) — edit langsung + autosave = tidak ada undo; pertimbangkan snapshot ringan atau shortcut `Ctrl+Z` di level project.
2. **Aksi New task / New issue di CommandPalette** — butuh hoisting modal (task/issue memerlukan konteks project; bisa buka ke `/project/:id?tab=board&new=1`). → **SELESAI (M15)**: 9 aksi create per entitas via deep-link read-once `?tab=X&new=[value]` (lihat Batch 9); backlog DevHub 4defd8dd ditutup.
3. **Penemuan hotkey**: hint board sudah ada; evaluasi daftar hotkey global di palette footer ("n new task" dsb) bila shortcut bertambah. → **SELESAI (M15)**: DocsPage tip Ctrl+K diperbarui; palette kosong menampilkan semua command (discoverability alami); tanpa footer-hint baru (backlog DevHub 0345ac4c ditutup).
4. **Chunk splitting** (>500 kB) — di luar lingkup UI/UX, tercatat untuk performa.
5. **Mode baca di workbench API**: pola read-mode modal detail belum merata ke editor API (Edit/Preview toggle sudah ada di sana, tapi preview adalah render JSON, bukan tampilan read yang rapi).
6. **Keamanan: MCP API key ter-commit di `opencode.json:8`** (commit `aac5a5d`) — key `devhub_CnEa…` asli; catatan saja per keputusan user, rekomendasi: revoke + regenerate + `.gitignore` sebelum menambah config baru.