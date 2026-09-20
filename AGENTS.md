# DevHub Agent Sync Protocol

## Session Start

Setiap session dimulai, baca seluruh isi folder `docs/` di root project untuk memahami konteks proyek.
Ikuti urutan:
1. Baca `docs/01-project/` — pemahaman proyek
2. Baca `docs/02-architecture/` — arsitektur & design decisions
3. Baca `docs/03-engineering/` — standar engineering
4. Baca `docs/05-operations/` — operasional
5. Baca `docs/06-compliance/` — kepatuhan
6. Baca file audit di `docs/` root (`04-audit-*.md`)

Jika folder tidak ditemukan, skip dan lanjutkan kerja utama.

---

These rules apply when the MCP server `devhub` is configured (see `opencode.json`) and reachable.
If not reachable, log as pending, continue main work, and retry at end of session — sync must not block work.

## Prerequisites

Before sync begins, ensure MCP is configured (OAuth 2.1 PKCE):

1. Run `opencode mcp auth devhub` — browser opens to DevHub login (custom form), then auto-stores token. Verify with `opencode mcp list` (expect `devhub: connected`).
2. Check env var `DEVHUB_PROJECT_ID` — if empty, ask user via `question` tool (custom: true):
   "Project ID is not set. Open a project in DevHub → copy the ID from the header, then paste it here."
3. If MCP returns 401 (token expired or scope insufficient), run `opencode mcp auth devhub` again (access 15m, refresh 30d rotation — re-auth refreshes).
4. If MCP is not reachable (server down), log as pending and continue main work.

## Project target resolution (hierarchical)

1. User mentions a project in session → use that.
2. Env var `DEVHUB_PROJECT_ID` is set → use that.
3. Neither → ask user once at session start, then stay consistent until session ends.

Never guess `projectId` or write it directly to any file.

## Milestone resolution

Before creating a task (session start or mid-session), ask the user whether the task should be grouped under a milestone:

1. Fetch the milestone list from `project_state` (see `milestones[]`).
2. If no milestones exist → offer to create one:
   "No milestones yet. Want to create a new milestone?" (custom: false — Yes / No)
3. If milestones exist → ask via `question` tool:
   "Use a milestone for this task?"
   Options: [Use existing milestone, Create new milestone, No milestone]
4. If "existing" → list milestone names via `question`, pick one → use its `milestoneId`.
5. If "new" → ask name, version (optional), target date (optional) → `add_milestone`, use the returned ID.
6. If "none" → `create_task` without `milestoneId`.

## Required sync

| Event | DevHub Tool | When |
| --- | --- | --- |
| Architecture decision finalized (structure, dependencies, patterns, hosting, security) | `add_decision` | When decision is final |
| Work plan drafted / implementation starts | `create_task` | Session start |
| Work completed & verified (lint/test/build green or committed) | `update_task` status `done` | Before closing session |
| Flowchart / architecture diagram designed or changed | `create_whiteboard` / `update_whiteboard` | When design is created |
| Bug found / issue confirmed | `add_issue` | When issue is created |
| Issue linked to task | `update_issue` (linkedTaskId) | When linking |
| Test case written for task/issue | `add_test_case` | When test is written |
| Milestone created / status changed | `add_milestone` / `update_milestone` | When milestone is changed |
| API collection / endpoint baru diekspos (mis. tambah `server/src/modules/*/handlers/*.ts`, `entity-router.ts`, `*.routes.ts`) | `add_api_collection` / `add_api_endpoint` | Saat agen membuat/mengekspos endpoint atau collection baru — segera setelah route/handler committed & `method+path` final |
| Kontrak API endpoint berubah (method/path/params/body/responses/collection) | `update_api_endpoint` | Saat agen mengubah kontrak — patch sebelum tutup sesi/commit |

## Behavior rules

- Only ADR-level decisions are recorded — not small cosmetic/style choices.
- One decision = one call; do not batch them at end of project.
- Tasks are created granular per verifiable unit of work, not one giant task.
- Sebelum `add_api_endpoint`, baca `project_state.apiEndpoints` dan cocokkan `method+path+collectionId` untuk hindari duplikat (cap 500 collections / 5000 endpoints).
- After syncing, verify with `project_state` if unsure (default cap is 200 rows
  per collection — use `limit: 0` to see all).

## UI Verification Rules (anti-ngeyel)

Aturan ini berlaku untuk semua pekerjaan UI di proyek apa pun.
Istilah generik: "dokumen token" = sumber tunggal nilai visual proyek
(mis. `design-tokens.md`); "guard" = linter/penjaga otomatis proyek;
`file:line` = referensi lokasi kode.

1. **Screenshot pengguna adalah kebenaran.** Bila kesimpulan dari kode
   bertentangan dengan screenshot, screenshot menang — audit ulang,
   jangan berdalih.
2. **Periksa rantai render penuh, bukan kelas elemen saja.** Setiap klaim
   visual wajib menelusuri: kelas/gaya elemen + SEMUA pembungkus ke atas
   sampai kontainer halaman (mekanisme layout yang dipakai, collapse vs
   gap, padding kontainer, breakpoint/media query yang aktif).
3. **Dilarang kata "identik/konsisten/sama" tanpa angka.** Setiap klaim
   kesetaraan wajib menyebut nilai terukur kedua sisi + `file:line`.
   Tanpa itu, tulis "belum terverifikasi".
4. **Salah = sebut spesifik yang terlewat.** Akui lokasi/baris
   pemeriksaan yang dilompati; dilarang menutup dengan spekulasi
   ("mungkin beda zoom/resolusi") tanpa bukti. Kegagalan audit = data,
   bukan aib — tapi kegagalan yang sama dua kali = pelanggaran.
5. **Pola yang dipakai ulang wajib cek berdampingan.** Setiap reuse pola
   (header, tampilan baca, toggle, kartu) harus dibandingkan render
   semua pemakainya; bila belum dicek, nyatakan terbuka sebagai utang.
6. **Standar lahir tertulis atau tidak lahir.** Pola/ritme/urutan baru
   langsung dicatat ke dokumen token di PR yang sama — "nanti" = tidak
   pernah.
7. **Mode cepat wajib lapor utang.** Bila pengguna minta "tanpa tes/build",
   akhiri dengan daftar eksplisit apa yang belum diverifikasi
   (lint/tipe/tes/visual) + risiko terbesarnya. Jangan biarkan
   "cepat" dibaca sebagai "aman".
