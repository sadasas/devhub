# Roadmap — DevHub

| Field | Value |
|---|---|
| **Document status** | Active |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-19 |

---

## 1. Phase Overview

| Phase | Name | Goal | Status | Est. duration |
|---|---|---|---|---|
| 0 | Planning & Documentation | Full docs suite + locked scope | **Done** | 1 week |
| 1 | V1 Build | Working app | Done | 4–6 weeks (part-time) |
| 2 | Public Deploy | Multi-user hosting + hardening | Done | ~2 weeks |
| 3 | Collaboration & PWA | Sync, real-time, offline | In progress | TBD |

---

## 2. Phase 0 — Planning (Done)

**Deliverables:**
- [x] Market research & competitor analysis (Linear, Jira, GitHub Projects, ClickUp, Height, Shortcut, Plane)
- [x] Positioning decision: complementary "technical memory" tool, not team coordinator
- [x] Scope lock (V1 features, deferral log)
- [x] Architecture decision record (see [ADR Log](../02-architecture/adr.md))
- [x] Full documentation suite (this repo, `docs/`)
- [ ] Approval to start Phase 1

---

## 3. Phase 1 — V1 Build (Done)

### 3.1 Milestones

| Milestone | Scope | Exit criteria |
|---|---|---|
| M1 — Scaffold & Core | Monorepo, server (Express+pg), migrations, auth, projects CRUD, state API, app scaffold (Vite), design tokens + base components | Auth round-trip works; UI renders with design system |
| M2 — Core Tracking | Layout, sidebar, dashboard, Kanban (drag-drop + deps), issues, test cases | Board fully interactive; issues/test cases CRUD |
| M3 — Technical Memory | Stack ledger, Schema CRUD + ERD + versioning, Decisions (ADR), Releases | All 4 tabs functional |
| M4 — Insight & UX | Stats (SVG charts), command palette, keyboard shortcuts, export/import, polish | Full keyboard nav; export round-trip verified |
| M5 — AI Integration | Remote MCP server (streamable HTTP, API-key), tools, opencode.json sample, agent loop verified | Agent loop demo passes |
| M6 — Release | Dockerfile, runbook verify, `npm run build` clean, security review | Release criteria (PRD §5) met |

### 3.2 V1 Feature Set (locked)

Projects · Kanban with `blockedBy` dependencies · Issues · Test cases · Tech stack ledger · Schema + ERD + versioning · ADR log · Milestones/changelogs · Stats · Command Palette (Ctrl+K) · Export/import JSON · Auth (email+password) · MCP server.

---

## 4. Phase 2 — Production Service (Shipped)

**Drivers:** Hosting decision (Railway / Render / VPS — currently TBD), production Postgres, HTTPS domain, rate-limit tuning, backup automation (cron pg_dump), monitoring (health checks, logging, alerting), privacy policy + ToS publication (already drafted in `docs/06-compliance/`), account deletion flow verification.

**V2 features (deferred from V1) — all shipped in [M10](#10-v2-features-m10):**
- [x] API Endpoint Inventory (document endpoints used by the app)
- [x] Project Templates
- [x] Release Tracker improvements (version history detail)
- [x] Project Notes (free-form per project) — **removed in M16** (lihat DEF-005)
- [x] Schema snapshot diffing

---

## 5. Phase 3 — Collaboration & PWA (Partially shipped)

**Shipped (collaboration core):** team workspaces (one team → many projects), email invites for registered users with accept/decline flow + 7-day expiry, roles owner/admin/editor/viewer (viewer read-only enforced at API, UI, and MCP layers), per-team sidebar grouping, migration 003 backfill moved existing projects into a per-user "Personal" team. See [Team Collaboration Design](../02-architecture/team-collaboration-design.md).

**Remaining drivers:** Multi-device sync (IndexedDB provider + sync service), real-time collaboration (WebSocket + CRDT or last-write-wins merge — LWW already chosen for conflict handling, prepared via `Base.updatedAt`), PWA offline, WebDAV/Nextcloud backup option, ntfy.sh push notifications, real-time presence.

**Prerequisite:** StorageProvider abstraction already designed in [Technical Design](../02-architecture/technical-design.md) — adding sync requires one new provider, zero component changes.

---

## 6. Deferral Log

Every item intentionally postponed, with rationale. Items cannot return without a scope-change record.

| ID | Feature | Deferred from | Rationale | Revisit |
|---|---|---|---|---|
| DEF-001 | Git CLI integration (run git commands, show branches) | V1 | Web browsers cannot spawn a git CLI; Node sidecar/Electron/Tauri rejected as over-engineering for V1 | Phase 3 (optional Tauri desktop) |
| DEF-002 | API Endpoint Inventory | ~~removed~~ | **Reinstated:** promoted to V1 — shipped as API docs (collections + endpoints with OpenAPI import/export, ADR-019) | — |
| DEF-003 | Project Templates | V1 | **Shipped (M10):** team-scoped template storage (`project_templates`), save/list/instantiate | — |
| DEF-004 | Release Tracker (rich version history) | V1 | **Shipped (M10):** per-milestone task list detail | — |
| DEF-005 | Project Notes | V1 | **Shipped (M10):** free-form notes entity with autosave — **removed (M16):** fitur tidak terpakai (tumpang tindih dengan entity lain), entitas dihapus dari schema/API/UI; data notes lama di-drop (zod strip-mode) | — |
| DEF-006 | Task dependencies | ~~removed~~ | **Reinstated:** promoted to V1 after lifecycle review (blocking order impossible without them) | — |
| DEF-007 | Test case checklists | ~~removed~~ | **Reinstated:** promoted to V1 after lifecycle review (release readiness) | — |
| DEF-008 | Milestones/Releases | ~~removed~~ | **Reinstated:** promoted to V1 after lifecycle review | — |
| DEF-009 | PWA / offline | V1 | Needs IndexedDB provider + service worker | V3 |
| DEF-010 | Multi-device sync | V1 | Needs sync service + auth scope | V3 |
| DEF-011 | Real-time collaboration | V1 | Needs CRDT/WebSocket; architecture prepared | V3 |
| DEF-012 | In-app AI chat UI | V1 | AI integration via MCP tools only (locked decision) | Never (by design) |
| DEF-013 | Integrations (GitHub import, Discord/Slack webhooks, ntfy, Sentry, WakaTime, WebDAV backup, Todoist sync, Ollama) | V1 | Core first; integration layer kept separate from core data | V3+ |
| DEF-014 | SaaS pricing/per-seat selling | — | Pricing model TBD for the hosted SaaS; free tier first, per-seat revisited later | Deferred |

---

## 7. Release Management Process

1. Feature freeze per milestone; changes recorded here.
2. Manual smoke test against [Release Criteria (PRD §5)](prd.md#5-release-criteria-definition-of-done-for-v1).
3. Tag release `vX.Y.Z` (SemVer); milestone changelog updated in-app.
4. Backup taken before any deploy (see [Backup & Recovery](../05-operations/backup-recovery.md)).
5. Post-release: monitor health endpoint; update docs if behaviors changed.

---

## 8. Server Audit 2026-08 (M7)

Audit server & platform 6-peran (lihat [dokumen audit](../04-audit-server-2026-08.md)) menghasilkan 12 temuan (1 critical, 4 high) — seluruhnya di-track di DevHub sebagai issues + 6 task fix di milestone M7:

| Batch | Lingkup | Status |
|---|---|---|
| B1 | CORS+topologi, helmet, health+logging, migrasi 008 (version/CHECK/UNIQUE/jwt_version), optimistic locking 409, JWT versioning, runbook | ✅ Done |
| B2 | Hapus dokumen OpenAPI (openapi.yaml, api-guide, ApiDocsPage, `/docs/api`) — DevHub internal | ✅ Done |
| B3 | Lint server, helper transaksi/parse, envelope respons, advisory lock migrasi, state GET 500 | ✅ Done |
| B4 | Helper mutasi entitas MCP + refactor 18 tools | ✅ Done |
| — | Audit keamanan penuh (threat model, auth, MCP, npm audit, XSS, secrets scan) → `docs/04-audit-security-2026-08.md`; key MCP ter-commit dirotasi | ✅ Done |
| — | ADR-022 + desain granular API (`/api/v1`) | ✅ Done (ADR Proposed) |

---

## 9. Granular API v1 (M8)

Implementasi ADR-022: seluruh permukaan API pindah ke /api/v1 (auth, teams, keys, public, projects) - permukaan /api lama dihapus. Endpoint granular per-entitas (11 entity) di server/src/api/v1/entity-router.ts dengan row-lock transaksional, If-Match/ETag opsional (409 + banner konflik), cascade server-side, dan pipeline save frontend berbasis mutation queue (coalesced + debounce + flush serial). PUT /state tetap sebagai bulk/compat. Verifikasi: server 91/91 test, app 27/27 test, lint+build hijau.

---

## 10. V2 Features (M10)

Implementasi V2 (v0.4.0) — 51 task (V2 inti ~31h + 3 workstream baru: Global Search, Activity Timeline, E2E/CI), seluruhnya selesai di track via MCP:

| Fokus | Isi |
|---|---|
| Sharing per-tab | Migrasi `009_project_public_tabs.sql` (kolom `public_tabs` jsonb, default 5 tab); `PATCH /projects/:id` `publicTabs` (admin only); meta publik mengembalikan `tabs`; endpoint `GET /api/v1/public/projects/:id/state` memfilter state sesuai tab publik (tanpa kebocoran data tab privat); UI: satu tombol **Share** di header proyek → modal segmented Private/Public + 5 checkbox tab + link publik dengan fallback tab pertama publik |
| Project Templates | Migrasi `010_project_templates.sql` (tabel team-scoped); REST `POST /templates` (save dari proyek), `GET /templates`, `GET /templates/:id` (dengan state), `POST /templates/:id/instantiate` (proyek baru), `DELETE /templates/:id` (admin); halaman `/templates` + modal Save as template & Use template |
| Project Notes | ~~Entity baru `notes` di state~~ — **diimplementasikan lalu dihapus (M16):** entitas tidak terpakai, dihapus dari schema/API/UI; data lama di-drop |
| Release Tracker | Detail milestone menampilkan **Tasks in this release** (task via `milestoneId` + status badge + short id) |
| Schema snapshot diffing | `schemaVersions.snapshot` (tables+relations) ditangkap saat simpan versi; tombol **Diff versions** di Schema → modal bandingkan 2 versi (tabel/kolom/relasi ditambah-dihapus, ringkasan) |
| Code-splitting | `React.lazy` per tab proyek; chunk utama 717 kB → 427 kB; warning >500 kB hilang |
| Global Search | `GET /api/v1/search` (member-scoped, 9 entity: tasks/issues/testCases/decisions/techEntries/notes/apiEndpoints/apiCollections/milestones; ranking title>body, prefix>substring, caps 50/20/5) — `server/src/lib/search.ts` + `search.routes.ts`; UI: hasil di CommandPalette (Ctrl+K) dengan `<mark>` highlight, debounce 250ms + AbortController; deep-link `?tab=&entity=&id=` via `useEntityDeepLink` → auto-open modal di 8 halaman |
| Activity Timeline | Migrasi `011_activity_log.sql` (tabel server-authoritative di luar `projects.data`); `server/src/lib/activity.ts` (diff top-level, clustering merge 60s, retention 500/50); hook di `mutateProject` (created/updated/deleted + author_name, txn sama, rollback-consistent); `GET /projects/:id/activity` (member-scoped, limit/cursor); UI `ActivityList` di read-mode 8 modal detail |
| E2E (Playwright) | Workspace `e2e/` — 14 journey (auth, project, board keyboard, save+reload, issues, done-block, public share, stack+schema, palette, ADR, invite 2-context); infra: webServer 2 proses (server :3100 + vite :5174), globalSetup TRUNCATE + owner register, X-Forwarded-For bypass limiter, `waitForSaved` via version poll (no sleeps); `140/140` dengan `--repeat-each=10`, flake 0% |
| CI | `.github/workflows/ci.yml` — job `unit` (postgres service :5433, lint, build, server 118 test, app 68 test) merge-blocking + job `e2e` (2 shard, playwright chromium, trace/screenshot artifact on failure) |

**Verifikasi:** server 118/118 test (11 file), app 68/68 test (11 file), e2e 14/14 journey (140/140 @ repeat-each=10), lint + build hijau di kedua package, CI unit+e2e merge-blocking.

---

## 11. Whiteboard (M17 — milestone sendiri, ADR-023)

Workstream Whiteboard awalnya direncanakan sebagai workstream kedua M11 v0.5.0; saat M11 rilis (Sync & Offline saja, 2026-08-14), whiteboard dipindah ke **milestone M17 v0.11.0** (13 task, ~54.5h) — lihat [ADR-023](../02-architecture/adr.md#adr-023). Keputusan kunci: satu entity `whiteboards` terpadu (brainstorming + flowchart + entity ref cards), bukan dua entity terpisah.

| Fokus | Isi |
|---|---|
| Entity `whiteboards` | JSONB di `projects.data` (tanpa migrasi DB, `.default([])` backward compatible); elemen `z.discriminatedUnion`: `stroke` (cap 2.000 titik + thinning 2px), `sticky`, `text`, `shape` (rect/diamond/ellipse), `edge` (free-hand + snap-ke-node 12px, `sourceNodeId`/`targetNodeId` nullable, endpoint direkomputasi saat render), `ref` (kartu live tasks/issues: judul + status dari state project, klik → deep-link modal); caps 1.000 elemen/board, 5 board/project |
| Canvas | Hand-built SVG nol dependency (ADR-007, pola `ERD.tsx`): view pan/zoom wheel + `<g transform>`, draft layer ref-based, commit 1× per gesture → pipeline save existing (debounce 800ms + If-Match queue); eraser = deletion tool; undo/redo in-memory (snapshot 30) + shortcut Ctrl+Z/Y, Delete, Esc, Space-pan |
| Toolset | Pen, warna (palet design tokens), eraser, sticky notes, text (floating popover), shapes, edge/arrow (arrowhead `<marker>` hand-built), select (drag-move, delete, cleanup edge), pan/zoom |
| Integrasi | Granular CRUD/If-Match/activity/search/export/import/MCP `project_state` otomatis ikut; activity diff `elements` = summary-count; search collector kustom (name 3×, teks sticky/text/shape.label/ref 1× — tanpa noise hex/uuid); tab ke-11 (deviasi A1 tercatat); public share read-only `/p/:id` |
| Tests | Server: schema round-trip (cegah silent strip), CRUD, activity, search; App: reducer/geometry murni + interaksi jsdom (stub rect/pointer capture); E2E: 2 journey (draw→save→reload; drag node → edge ikut) |
| Defer V2 | Port-based connector + port UI (visual handles tetap defer), auto-layout, per-element PATCH, gzip compression middleware di server. ~~Snap grid/alignment~~, ~~refs entity lain~~, ~~MCP whiteboard tools~~ → dikerjakan (Snap/refs di M18 ADR-026; MCP tools di 11c) |

---

## 11b. Whiteboard Diagramming v2 (M18 — ADR-026)

M18 v0.12.0 (12 task, ~30h) — riset kebutuhan lintas-skenario (flowchart, backend architecture, mind map, wireframe, swimlane, deployment) menutup 12 gap dengan satu set schema extension zod (tanpa migrasi DB). Lihat [ADR-026](../02-architecture/adr.md#adr-026).

| Task | Isi |
|---|---|
| Schema & types | ✅ `shapeType` +cylinder/parallelogram/hexagon/roundedRect; edge +`label ≤200` +`arrowStyle` enum (compat: `arrowhead:true` → derived solid); text +`w?`; kind baru `boundary` (container visual dashed + label); mirror `app/src/lib/types.ts`; search collector +edge.label/boundary.label; round-trip + strip test server |
| Render label + popover edge | ✅ Fix bug label shape (tidak dirender); edge label midpoint + halo; popover edge (label/color/arrowStyle, double-click) |
| Orthogonal routing | ✅ `orthogonalPath()` pure di `edges.ts` (Manhattan 3/4/5 segmen sesuai port, render-time — tidak disimpan di schema); arrowhead ikut segmen terakhir; hit-test polyline; preview draft edge |
| Snap + alignment + distribute | ✅ Snap drag ke grid 32px (radius 8); alignment guides 4px saat drag; toolbar seleksi: Distribute H/V |
| Copy/paste + duplicate | ✅ Ctrl+C/V + Ctrl+D; clipboard internal JSON, `newId()`, remap edge dalam seleksi, drop edge lintas seleksi, offset +24, cap 1000 guard |
| Boundary container | ✅ Tool B, drag-to-size, render selalu di belakang, bukan target edge, popover label/color |
| Shape + arrowhead styles | ✅ Render 4 shape baru (`shapePath`); marker none/open/solid/diamond/circle (default solid utk edge baru) |
| Z-order + resize | ✅ Bring forward/Send backward di toolbar seleksi; resize handle bottom-right (shape/sticky/boundary, min size, ikut snap) |
| Text wrap | ✅ text `w?` → render multiline via wrapToWidth; popover Shift+Enter newline |
| Ref entity lain | ✅ RefPicker multi-entity (testCases/milestones/techEntries/decisions/tables/apiCollections/apiEndpoints); refDataMap meta per entity; `entityDeepLink` sudah support semua |
| Export PNG/SVG | ✅ `export.ts` murni: `serializeWhiteboard` (viewBox = bounds elemen + margin 32, per-kind serialize: stroke/sticky/text wrap/shape label/edge orthogonal + arrowhead + label/boundary dashed/ref card expand+collapse); PNG via canvas 2×; tombol Export di toolbar shell (member-only, disabled saat kosong, menu PNG/SVG); `buildRefDataMap` diekstrak ke `ref-data.ts` (dipakai canvas + export) |
| Docs & verifikasi | ✅ ADR-026 + roadmap; server+app test suite; lint; build; e2e journey labeled edge + copy/paste (journey ke-3 `whiteboard.spec.ts`) |

**Verifikasi:** app 630/630 test (68 file), server 218/218 test (27 file), e2e whiteboard 3/3 journey, lint + build hijau.

**Bug fix (ditemukan saat e2e M18):** zod v4 `.partial()` menerapkan `.default()` untuk key yang tidak dikirim — PATCH parsial (mis. `{elements}`) mereset field defaulted lain (mis. nama board → "Whiteboard"). Diperbaiki di `entity-router.ts` PATCH: merge hanya key yang hadir di request body + regression test (v1-granular: partial PATCH task/whiteboard mempertahankan field lain).

Semua fitur edit di-gate `canEdit`/`readOnly` (public share aman). Port handles visual & auto-layout tetap defer.

---

## 11c. MCP Whiteboard Tools (ADR-023 follow-up)

Menutup deferral ADR-023 ("MCP whiteboard tools"): agent AI kini bisa membuat & mengisi board whiteboard melalui MCP — 2 tool baru (total 20):

| Tool | Isi |
|---|---|
| `create_whiteboard` | `projectId`, `name ≤100`, `description? ≤2000`, `elements[]? ≤1000` — elemen tanpa `id` otomatis diberi UUID server; validasi `whiteboardElementSchema` (discriminated union 7 kind: stroke/sticky/text/shape/edge/boundary/ref); cap 5 board/project → toolError |
| `update_whiteboard` | `projectId`, `whiteboardId`, `{ name?, description?, elements[]? }` — `elements` = full replacement (per-element PATCH tetap defer); no-op update tidak menulis activity row (diff kosong) |

- `LIMITS` schema + `WHITEBOARD_*` (anti-drift, pola audit MCP-2); `whiteboardSchema` di-state.ts kini memakai `LIMITS`.
- Integrasi otomatis tanpa kerja ekstra: `saveState` transaksional (activity diff + broadcastSync) + viewer gate.
- Verifikasi: server test suite (mcp-whiteboard.test.ts, 11 test: create/empty/rename/replace/no-op/caps 5-board/1000-elemen/malformed/unknown/viewer), lint, build hijau.

---

## 12. WebSocket real-time (M12)

M12 v0.6.0 — real-time collaboration: server push state-diff ke member proyek online + presence. Runtime dep `ws` dicatat di [ADR-024](../02-architecture/adr.md#adr-024) (room registry generik + auth cookie JWT di handshake).

| Task | Isi |
|---|---|
| WS server (done) | `server/src/realtime/`: `rooms.ts` (RoomRegistry generik — `join/leave/leaveAll/size/broadcast`, key `project:{id}`) + `ws-server.ts` (`/ws`, auth `verifySession` di handshake — close 4001; protokol `join`/`leave`/`ping`↔`hello`/`joined`/`pong`/`error`; join diverifikasi `getProjectWithRole`, role dijawab server; heartbeat 30s; shutdown tutup semua client); `index.ts` refactor `http.createServer` eksplisit |
| Broadcast state-diff (done) | `server/src/realtime/broadcast.ts` — `attachRoomRegistry` + `broadcastDiff` (ops granular `created`/`updated`/`deleted` + after) / `broadcastSync` (bulk PUT /state + saveState MCP); entity-router POST/PATCH/DELETE + projects.routes PUT /state + mcp/state-db di-hook (ADR-024 follow-up) |
| Client WS (done) | `app/src/lib/realtime-client.ts` — `RealtimeSocket` (connect `/ws`, join, ping 25s, reconnect backoff 1→15s, MODE!=test), `applyStateDiff` pure (skip op sendiri via pending queue + gating version), `realtimeWsUrl`; `ProjectProvider` wiring (apply diff, resync saat joined/state:sync); proxy `/ws` di vite dev |
| Polling fallback-only (done) | ADR-025 — `RealtimeSocket` expose `onOpen`/`onClose`; interval 5s `GET /projects/:id/state` di `project-context.tsx` di-skip saat socket connected (`wsConnectedRef`); polling kembali aktif otomatis saat WS putus (safety net missed-diff, mode test) |
| Presence (done) | Frame `{type:'presence', projectId, users:[{userId,name}]}` pada join/leave/close (display_name dari `users`); klien: state `presence` di ProjectContext + `PresenceChip` di header ("N online" + tooltip) |
| Test suite | Server: auth handshake (no-cookie/tamper/stale jwt_version), join member/non-member, leave, ping/pong, registry; App: reducer apply-diff, reconnect |

---

## 13. MCP activity logging (M13.12)

M13.12 — mutasi via MCP kini tercatat di activity feed (list aktivitas per item + feed project), paritas penuh dengan REST. Sebelumnya `saveState` MCP hanya `UPDATE projects.data` tanpa menulis `activity_log` (ADR-027).

| Task | Isi |
|---|---|
| Diff generik | `diffStateDrafts()` di `server/src/lib/activity.ts` — diff by-id 12 koleksi state (created/deleted/updated), summary identik REST (`entitySummary`), skip no-op update (hanya bump `updatedAt`) |
| saveState transaksional | `server/src/mcp/state-db.ts` — BEGIN…COMMIT/ROLLBACK + `FOR UPDATE`; `insertActivity` per draft (author = pemilik MCP key, cluster-merge 60s tetap jalan) + `pruneActivity`; post-commit `broadcastActivity` per entry (live-activity parity) |
| Tests | `server/test/mcp-activity.test.ts` — create/update/delete via `/mcp` → baris activity benar (entity/action/summary/authorName), filter per-item `?entity=&entityId=`, no-op update tanpa baris baru |
| Verifikasi | `npm run test:server` + `build -w server`; DevHub M13.12 + issue |

---

## 14. Calendar & Due Dates (M19 — ADR-028)

M19 v0.14.0 (11 task, ~24h) — riset platform (Linear/Plane/Todoist/Height/LinCal) menutup gap: DevHub belum punya `dueDate` di task; milestone sudah punya `targetDate`. Keputusan kunci: kalender = **view ke-3 di Board** (`?view=due`), BUKAN tab ke-12 (audit A1); `dueDate` zod-only tanpa migrasi DB (precedent M17). Lihat [ADR-028](../02-architecture/adr.md#adr-028).

| Task | Isi |
|---|---|
| P1.1 Schema | `taskSchema` + `dueDate: isoDate.nullable().optional()`; mirror `lib/types.ts`; round-trip/strip test server |
| P1.2 UI dasar | Input tanggal `TaskModal`/`NewTaskModal`; chip tanggal task card warna Linear (merah due hari ini/overdue, oranye ≤7 hari, abu-abu normal) |
| P1.3 Board view | View ketiga **By Due Date** (`?view=due`): kolom Overdue · Today · Tomorrow · This Week · Next Week · Later · No date; drag antar kolom = set/ubah dueDate (granular PATCH → realtime/activity gratis); sort within column |
| P1.4 MCP | `create_task`/`update_task` + `dueDate` (ISO) + tes |
| P1.5 Docs P1 | DocsPage, README, lint/test/build |
| P2.1 Grid | Month grid hand-built (ADR-007, Monday-start, today highlight, nav prev/next/today, toggle week view) |
| P2.2 Interaksi | Klik sel → quick-create dueDate preset; drag chip antar hari → PATCH; drop-zone bawah = hapus dueDate; strip Unscheduled (pola LinCal) |
| P2.3 Marker | Diamond milestone di `targetDate`; toggle tampilkan completed |
| P2.4 A11y | Keyboard nav bulan saat sel fokus; deep-link `?view=due`; public share read-only (gate `canEdit`) |
| P2.5 Verifikasi | Tests (server round-trip, app grid/geometry, e2e journey), ADR-028 + roadmap ini |
| Riset | Riset platform → keputusan (ADR-028); defer natural-language dates, recurring, filter engine, reschedule dependensi |

**Phase 1 selesai (2026-08-17):** P1.1–P1.5 ✅ — `dueDate` aktif di schema/UI/MCP, view By Due Date + chip warna ship.

**Phase 2 selesai (2026-08-17):** P2.1–P2.5 ✅ — calendar month/week grid (sub-tab Buckets | Calendar, `?view=due&cal=1`), quick-create per hari, drag reschedule + drop-zone hapus dueDate, strip Unscheduled, diamond milestone + hide completed, keyboard nav (arrows/PageUp/PageDown/Enter), public share `?view=due` read-only; fix WS created-op dedupe (duplikat task saat broadcast tiba setelah POST resolve); e2e journey `due.spec.ts` (quick-create → drag → reload persist).

**Verifikasi:** server + app test suite, lint, build hijau; e2e journey drag reschedule + quick-create (phase 2).

---

## 15. Task Start Date (M20 — ADR-029)

M20 v0.15.0 — mirror pola `dueDate` M19: task mendapat `startDate` (ISO `YYYY-MM-DD`, nullable) tanpa migrasi DB (zod-only, precedent ADR-028). Tidak ada view baru; start date tampil sebagai chip neutral di task card + input di modal edit/create.

| # | Item | Detail |
|---|------|--------|
| P1.1 Schema | `taskSchema` + `startDate: isoDate.nullable().optional()`; mirror `lib/types.ts`; round-trip/strip/invalid test server | 
| P1.2 MCP | `create_task`/`update_task` + `startDate` (ISO, null untuk clear) + tes |
| P1.3 UI | Input "Start date" (type=date) di `TaskModal`/`NewTaskModal`; chip `Starts <date>` di `TaskCard` (class `.task-start`, neutral); `DetailRow` di read-mode; label `startDate` → "Start date" di activity |
| P1.4 Warning | Soft warning UI "Start date is after the due date." (`startAfterDue`) — tanpa block server |
| P1.5 Verifikasi | Tests (server round-trip + MCP, app helper `start-dates`, modal, card), lint, build |

**Selesai (2026-08-17):** P1.1–P1.5 ✅ — `startDate` aktif di schema/UI/MCP, chip "Starts" + soft warning tanggal, activity label.

**Verifikasi:** server + app test suite, lint, build hijau.

---

## 16. Sortable Lists (M21 — ADR-030)

M21 v0.16.0 — setiap tab list mendapat **sort control** (dropdown: pilih key + toggle arah). Saat ini semua list pakai urutan state-array atau comparator hardcoded (`.sort()` inline per page); tidak ada sort UI sama sekali. Murni client-side view state (URL param) — tanpa perubahan server/schema.

| # | Item | Detail |
|---|------|--------|
| P1.1 Komponen | `SortControl.tsx` — dropdown reusable (pola popover `PresenceChip`, tanpa dependency baru): trigger `btn btn-ghost btn-sm` + `ArrowUpDown` + label key + `CaretDown`; menu pilih key + toggle Ascending/Descending (`SortAscending`/`SortDescending`); outside-click + Escape + arrow-key nav; `aria-haspopup="menu"`/`aria-expanded` |
| P1.2 Lib | `lib/sort.ts` — comparator helpers (`byString`/`byNumber`/`byDate`/`byPriority`/`bySeverity`/`byStatus`/`byTitle`) + `applySort<T>(items, key, dir, getValue)`; semua `.sort()` hardcoded pindah ke sini |
| P1.3 Persistence | URL param `?sort=<key>&dir=<asc|desc>` via `setSearchParams(…, {replace:true})` — precedent `?view=` (Board) / `?schemaView=` (Schema) |
| P1.4 Board | Sort di kolom By Status & By Milestone: priority, estimate, title, createdAt, dueDate (default: none = state order); view By Due tetap sort dueDate asc |
| P1.5 Issues & Tests | Issues: severity, status, createdAt, title; Tests: status, name, createdAt (default: none) |
| P1.6 Stack/Schema/Decisions/Releases | Comparator hardcoded jadi param: Stack (category, name, status, version), Schema tables (name, createdAt) + versions (appliedAt), Decisions (date, status, title), Releases (targetDate, name, version) — default = urutan eksisting |
| P1.7 API & Whiteboard | API: collections + endpoints per collection (name, method, path); Whiteboard: updatedAt, name, createdAt (default: updatedAt desc) |
| P1.8 Verifikasi | Tests (`sort.test.ts` comparators, `SortControl.test.tsx` menu/aria, assertion per page yang berubah), lint, build hijau |

**Selesai (2026-08-18):** P1.1–P1.8 ✅ — `SortControl` dropdown reusable (trigger ghost + icon arah + menu key + toggle Ascending/Descending, Escape/outside-click, aria menu); `lib/sort.ts` comparator terpusat (string/number/date, null-last, enum order); `useSortParam` persist `?sort=<key>&dir=<asc|desc>` (replace, param custom `sortv` untuk schema versions); 9 tab ter-wire (Board sort dalam kolom By Status/Milestone, Issues, Tests, Stack, Schema tables+versions, Decisions, Releases, API collections+endpoints+ungrouped, Whiteboard); semua `.sort()` hardcoded pindah ke `applySort`; default tiap tab = urutan eksisting. Skip: Stats, About, editor Whiteboard (bukan list).

**Verifikasi:** app 522 tests (16 baru: sort.ts 8, SortControl 8), lint, build hijau.

---

## 17. Completion-Aware Overdue (M22 — ADR-031)

M22 v0.16.1 — task yang sudah `done` tidak lagi tampil "Overdue" (danger) membabi-buta. Field baru `completedAt` (zod-only, tanpa migrasi DB — precedent M19/M20) dicatat saat task pindah ke `done`; label chip jadi sadar status: `Done on time` (success) bila `completedAt ≤ dueDate`, `Done late Nd` (warn) bila `completedAt > dueDate` (N = hari keterlambatan, **fixed** di `completedAt`, tidak bertambah). Task aktif tetap `Overdue Nd` (danger) / `Due …` seperti eksisting.

| # | Item | Detail |
|---|------|--------|
| P1.1 Schema | `taskSchema` + `completedAt: isoDate.nullable().optional()`; mirror `lib/types.ts`; round-trip/strip/invalid test server |
| P1.2 MCP | `create_task`/`update_task` + `completedAt` opsional; derivasi otomatis server-side: status→done tanpa completedAt → `nowIso()`, keluar done → `null` (paritas reducer app) + tes |
| P1.3 Reducer | `project-context.tsx` `task/update`: `patch.status='done'` (prev ≠ done, tanpa patch.completedAt) → `completedAt=nowIso()`; keluar done → `null`; `task/add` status done → set juga + tes |
| P1.4 Lib | `due-dates.ts` + `taskDueChip(task)` → `{label, tone}`: `Done on time` (success) · `Done late Nd` (warn) · aktif → `dueLabel`/`dueTone` eksisting |
| P1.5 UI | Chip TaskCard + DetailRow TaskModal + PublicProjectPage pakai `taskDueChip`; CSS `.task-due-success`; view By Due & bucket **tidak berubah** (done-late tetap kolom Overdue chip warn, done-on-time tetap kolom tanggalnya) |
| P1.6 Verifikasi | Tests (app: due-dates, project-context, TaskCard; server: completedAt + MCP), lint, build hijau |

**Selesai (2026-08-17):** P1.1–P1.6 ✅ — `completedAt` aktif di schema/UI/MCP dengan derivasi otomatis (reducer + MCP), chip `Done on time` (success) / `Done late Nd` (warn, fixed), task aktif tidak berubah, view By Due & bucket tetap.

**Verifikasi:** server 189 + app 501 tests, lint, build hijau.

---

## 18. Pinned Items (M13.7 — ADR-032)

M13.7 v0.13.7 — task/issue/test case/decision mendapat field `pinned: boolean` (default `false`, zod-only tanpa migrasi DB — precedent ADR-028/029/031); item pinned mengapung ke atas list/kolom (stable sort, kompatibel dengan SortControl M21). Pin/unpin adalah PATCH biasa → realtime + activity gratis via broadcastDiff.

| # | Item | Detail |
|---|------|--------|
| P1.1 Schema | `pinned: z.boolean().default(false)` di task/issue/testCase/decision schema; mirror `lib/types.ts`; round-trip/default/strip test server |
| P1.2 MCP | `create_task`/`update_task`/`add_issue`/`update_issue`/`add_test_case`/`update_test_case`/`add_decision` + param `pinned` + tes |
| P1.3 Komponen | `PinButton.tsx` (icon PushPin, `aria-pressed`, `stopPropagation`) + CSS `.task-card-wrap`/`.task-card-pin` (hover reveal) |
| P1.4 Sort | `applySort(items, spec, dir, pinnedFirst?)` — pinned-first stable (berlaku juga tanpa spec) |
| P1.5 Integrasi | Board (pin di task card, kolom By Status/Milestone pinned-first), Issues/Tests/Decisions (pin di `.data-row-side`, list pinned-first) |
| P1.6 Verifikasi | Tests (server round-trip + MCP 5 skenario, app PinButton/sort/TaskCard/3 page), lint, build hijau |

**Selesai (2026-08-18):** P1.1–P1.6 ✅ — `pinned` aktif di schema/UI/MCP, PinButton di card + row list, pinned-first stable di 4 tab, default `false` untuk entity lama.

**Verifikasi:** server + app test suite, lint, build hijau.

---

## 19. Overview Tab — merge Stats + About (M23 — ADR-033)

M23 v0.16.2 — tab `stats` + `about` digabung jadi satu tab **Overview** (icon `Gauge`); 11 tab → 10 (audit A1). Struktur: header (Edit PRD) → hero (description + meta) → 8 counter tile terdedupe → Charts (donut + bars + next milestone) → Product brief (5 PRD cards), dipisah hairline divider `.overview-group`. Legacy redirect `?tab=stats|about → overview`. Public share tetap counters + PRD (tanpa charts).

| # | Item | Detail |
|---|------|--------|
| P1.1 Komponen | `OverviewPage.tsx` (merge Stats+About; Donut/Bars/StatCard; dedupe counter: Tasks `done/total`, Milestones `released/total`); hapus `StatsPage.tsx`/`AboutPage.tsx`; CSS `.overview-group*` (~10 baris) |
| P1.2 Wiring | `ProjectTab` + `overview`; legacy redirect; `OverviewPageLazy project={project}`; presence label; TabSkeleton case overview |
| P1.3 Public | Label "Overview" + Gauge (id tetap `about`) di PublicProjectPage + ShareModal; tanpa charts |
| P1.4 Empty | `EmptyState` "Nothing to chart yet" bila tasks & issues kosong; counter 0 = data; PRD "Not set yet." |
| P1.5 Verifikasi | Update test (useTabShortcuts/useNewItemShortcut), tsc, lint, build; docs ADR-033 + roadmap |

**Selesai (2026-08-18):** P1.1–P1.5 ✅ — tab Overview aktif (Gauge), redirect lama jalan, public tanpa charts, counter terdedupe, charts + PRD dalam satu alur baca.

**Verifikasi:** app test suite (39 terkait hijau), lint; build penuh diblokir WIP whiteboard sesi lain (tsc error di WhiteboardCanvas/geometry — bukan M23).

---

## 20. Member Stats & Assignee (M24 — ADR-034)

M24 v0.16.3 — task mendapat field `assigneeId` (zod-only, tanpa migrasi DB — precedent M19-M23) sebagai prasyarat statistik member; Overview mendapat group **Members** (list rows: avatar+inisial, bar stacked open/done, open·done·est h·overdue·% completion, row Unassigned). Riset platform (Linear user views/cycle sidebar, Asana dashboards "Tasks by owner" + Workload View, Jira workload pie) — semua berbasis field assignee; DevHub sebelumnya hanya punya `authorId` (pencipta).

| # | Item | Detail |
|---|------|--------|
| P1.1 Schema | `taskSchema` + `assigneeId: z.string().uuid().nullable().optional()`; mirror `lib/types.ts`; round-trip/null/strip test server |
| P1.2 MCP | `create_task`/`update_task` + `assigneeId` (null = clear) + tes |
| P1.3 Picker | TaskModal edit "Assignee" — `SearchableSelect` dari `api.teamMembers(project.teamId)` + opsi None; TaskCard chip avatar+inisial (reuse `lib/avatar`) |
| P1.4 Overview | Group **Members** (rows, hairline divide — kontras vs Charts cards): `MemberBars` stacked open(`--status-info`)/done(`--status-success`), kolom mono tabular open·done·est h·overdue(danger bila >0)·% completion; sort open desc; row Unassigned terakhir (muted); member-only (public tanpa stats); loading skeleton rows |
| P1.5 Verifikasi | Tests (server 2 file, app: TaskModal picker, TaskCard chip, Overview aggregation, MemberBars), lint, build hijau |

**Selesai (2026-08-18):** P1.1–P1.5 ✅ — `assigneeId` aktif di schema/UI/MCP (zod-only, null-clear); TaskModal picker (SearchableSelect + api.teamMembers) + chip avatar TaskCard; Overview group **Members** (rows: avatar, MemberBars stacked open/done, open·done·est·late·%, sort open desc, Unassigned muted, skeleton); public tanpa Members.

**M24.1 (2026-08-19):** Redesign UI Overview Members (riset Linear/GitHub/Asana/ClickUp) — grid `20px minmax(100px,1fr) minmax(120px,1.4fr) 152px 48px` (bar dominan), kolom angka mono tabular **rata kanan** (Open · Done · Est h · Late · % Done — unit `h` di header), bar stacked **rasio per-row** (segmen = open/done member itu sendiri, `min-width:2px`, tooltip `X open · Y done`), row hover subtle, padding 6px. Fix head row alignment (spacer avatar — label geser 1 kolom, "Member" terpotong "M…") + `.member-nums` 34/34/42/34px gap 2px. Fix pin TaskCard (regresi `a5fdc17`): PinButton terima prop `className`, TaskCard oper `task-card-pin` → overlay top-right pulih (bukan flow di bawah kartu).

**Verifikasi:** server 202 + app 569 tests, lint hijau; build penuh masih diblokir WIP whiteboard sesi lain (tsc error di WhiteboardCanvas/geometry — bukan M24).

---

## 21. Profile Redesign (M26 — v0.17.0)

M26 v0.17.0 — redesign halaman `/profile` (ProfilePage + ProfileEditModal + CSS `.profile-*`/`.account-section` di `global.css`), tetap dalam design system yang ada (`tokens.css`, accent emerald, radius card 8px, hairline border). Riset awal: page lama 1 kolom datar (kartu identitas + form password terpisah tanpa hierarki); acuan pola redesign terbaru `KeysPage` (header + data-list + skeleton + EmptyState).

| # | Item | Detail |
|---|------|--------|
| P1.1 Identity hero | Band flat (non-box, hairline bawah): avatar inisial 80px + accent ring + inset highlight, nama 28px, email (bila displayName ada), bio, meta chip `Joined <date>` (pill hairline); tombol Edit profile kanan atas; empty-state bio jadi tombol inline "Add a bio — tell your team what you build." → buka edit modal |
| P1.2 Tabs | Hero + tab `Profile / Security / Account` (pola `.sub-tabs` existing, `role="tablist"`/`tab` + `aria-selected`, URL `?tab=` via `useSearchParams` default `profile`): **Profile** = stats strip (3 item: Teams/Projects/Active API keys, ikon duotone flat + angka tabular, divider vertikal) + related links (API keys/MCP guide); **Security** = action row Password + desc + tombol Change password → modal; **Account** = rows Email/Member since/Account ID (`font-mono` + `title`); stats dari `useTeams`/`useProjects`/`api.listKeys` (filter `!revokedAt`), skeleton saat loading, `—` bila gagal |
| P1.3 Modal | ChangePasswordModal baru (reset via `useEffect([open])`, `width="sm"`, footer Cancel + "Update password", disabled bila field kosong, sukses → state sukses role=status + tombol Done; toggle show/hide Eye/EyeSlash di field New + Confirm via prop `rightSlot` baru di `Input`); ProfileEditModal: bio char counter `n / 500 characters` |
| P1.4 Tests | `ProfilePage.test.tsx` (11 kasus, pola `KeysPage.test.tsx`): identitas, stats (teams/projects/keys aktif + revoked excluded), error keys → `—`, empty-bio → modal, save edit, switch tab + `aria-selected`, buka modal via tab Security, mismatch password error, sukses ganti password + modal tetap terbuka, toggle reveal, Account ID + links |
| P1.5 MCP | Tool baru `add_milestone` (projectId, name, status? default `planned`, version?, targetDate?, changelog?) — milestone M26 dibuat lewat tool ini; test `mcp-milestone.test.ts` (4 kasus: default planned, lengkap, empty name `-32602`, round-trip add→update); docs tabel tools di `mcp-integration.md`/`README.md`/`prd.md`/`technical-design.md` |

**Selesai (2026-08-19):** P1.1–P1.5 ✅ — page `/profile` = hero band + tab Profile/Security/Account (URL `?tab=`), stats + links di Profile, change password di modal (toggle show/hide), account rows di tab Account; 11 test baru ProfilePage, tool MCP `add_milestone` (21 tools total) + 4 test, docs sinkron.

**Verifikasi:** server 236 + app 663 tests, lint hijau, build app + server hijau.

---

## 22. Whiteboard Tools (M26b — v0.20.x)

Sekuel whiteboard setelah M17/M18 (v0.11/0.12): kenaikan limit + serangkaian tool editing & navigasi + perbaikan render, diikuti fitur Releases (filter version + input mask). Schema extension zod-only (tanpa migrasi DB — precedent M17-M25); `LIMITS.WHITEBOARDS_PER_PROJECT` 5 → 50 (stateSchema `.max` ikut sinkron, single-source).

| # | Item | Detail |
|---|------|--------|
| W1 Limit boards | `LIMITS.WHITEBOARDS_PER_PROJECT: 50` + `MAX_BOARDS` UI + test MCP (board ke-51 ditolak); stateSchema `.max(LIMITS...)` (lapis kedua yang sempat hardcode 5) |
| W2 Render fixes | Sticky auto-wrap proporsional tinggi (`wrapTextLines` + `truncateToWidth`, ganti potong mentah 6 baris/27 char); chip label boundary kontras (font 12, `fillOpacity .25`, teks primary, faktor ukuran 7.5px/char) + clamp ke lebar boundary tanpa truncate normal; sinkron `export.ts` (SVG) |
| W3 Align | `alignSelection` pure di `geometry.ts` (6 arah: left/centerX/right/top/middleY/bottom) + tombol di selection bar (≥2 elemen) |
| W4 Templates | Modal New Board + picker (blank/kanban/CI-CD/roadmap/release-train/gitflow); preset elemen frontend (`templates.ts`), tanpa schema |
| W5 Schema batch-2 | `edge.dash` (solid/dashed/dotted), `rotation` (shape/sticky/text, preset 0/90/180/270 + input), `locked` (semua kind; move/resize/delete/distribute/align/reorder skip), `groupId` (drag member = seluruh grup; Group/Ungroup di selection bar) — zod-only, MCP desc ikut |
| W6 Batch-3 | Minimap (klik untuk pan), Ctrl+A select all (skip locked), snap toggle (`MagnetStraight`), export PDF (print dialog); tombol zoom UI mendapat style + state aktif |
| W7 View only | Tool `view` (shortcut `V`, ikon `HandPointing`, posisi pertama toolbar): pan + zoom murni — klik tidak menyeleksi, drag tidak mengedit, double-click popover nonaktif; `TOOL_CURSOR` grab |
| W8 Releases version | Input version hanya `[0-9.]` (New/MilestoneModal; `inputMode="decimal"`); normalisasi prefix `v` saat tampil (fix `vv0.20.0`); **sort Version semver-aware** (`compareVersions` numeric per segmen di `lib/compare-version.ts`, `SortSpec.compare` opsional). Filter by version dicoba lalu dihapus (tidak dipakai) |

**Selesai (2026-08-19):** W1–W7 ✅ (v0.20.0 + v0.20.1) — commit `97a35fd` & `0e9c3a8`; milestone "Whiteboard tools" v0.20.0 released (16 task). W8 (v0.20.2) in progress.

**Verifikasi:** app 663+ tests, server 236 tests, lint + `tsc -b` + build hijau (per commit).

---

## 23. Profile Stats — GitHub-style (M27 — ADR-039)

M27 v0.21.0 — `/profile` di-redesign dua kolom (sidebar kartu identitas sticky + konten tab) dan tab **Profile** mendapat statistik gaya GitHub: **contribution heatmap** 7×53 (365 hari), total "N contributions in the last year", tile Tasks completed / Issues resolved / Active days / Current streak / Longest streak, plus kartu "Your teams" & "Your projects" dari data yang sudah ada. Riset platform: GitHub (heatmap + sidebar stats), Linear (profil/account split), shadcn Settings Profile 4 + Starwind (layout sidebar dua kolom). Data dari endpoint server baru `GET /api/v1/auth/me/stats` (ADR-039) yang menghitung dari `activity_log.author_id` (dicap server) — `authorId` entity di `projects.data` client-supplied dan tidak bisa diandalkan.

| # | Item | Detail |
|---|------|--------|
| P1.1 Server | `lib/user-stats.ts` `computeUserStats` — query daily `activity_log` (generate_series 365 hari, zero-filled), `taskCompletions` (`entity='tasks' AND action='updated' AND changes @> '{"status":{"to":"done"}}'`), `issuesResolved` (status `resolved`); `computeStreaks` (current = run berakhir hari ini/kemarin, longest); endpoint `GET /auth/me/stats` di `auth.routes.ts` (bare object, ADR-036) |
| P1.2 DB | Migrasi 017: index `activity_log (author_id, created_at DESC)` untuk agregasi per-user |
| P1.3 App API | `UserStats`/`ActivityDay` di `lib/types.ts`; `api.meStats()` |
| P1.4 Komponen | `ProfileStats.tsx` — heatmap CSS grid (level 0–4 skala accent emerald: `rgba(52,195,142, .22/.45/.72)` + `--accent`, cell 10px + tooltip + aria-label + tabIndex, label bulan + Mon/Wed/Fri, legend Less/More), header total, tile 5 statistik (skeleton loading, `—` bila error) |
| P1.5 Layout | `ProfilePage.tsx` + CSS `.profile-*` — grid `280px 1fr` (collapse ≤860px), sidebar sticky: avatar 88px (`avatarColor(id)`), nama/email/bio + "Add a bio", chip Joined + role tertinggi (teams), tombol Edit full-width; tab Profile = heatmap + stats tiles (Teams/Projects/API keys tetap) + kartu Your teams/Your projects (link `/team/:id`, `/project/:id`) + related links; Security/Account dalam kartu `.profile-panel` |
| P1.6 Tests | Server `stats.routes.test.ts` (6 kasus: 401, window 365 hari zero, counts per user, isolasi user, streak current/longest, streak dengan hari ini); app `ProfilePage.test.tsx` +2 (stats GitHub render, fallback `—`) |
| P1.7 Docs | ADR-039 (sumber data `activity_log`, caveat pruning, index 017), roadmap M27, README row fitur |

**Selesai (2026-08-20):** P1.1–P1.7 ✅ — endpoint `me/stats` + index 017 + 6 test server; ProfilePage dua kolom (sidebar sticky + tab konten) + heatmap emerald + 5 tile statistik + kartu teams/projects; app 674 + server 242 tests hijau, lint + build hijau.

**Verifikasi:** server 242 + app 674 tests, lint, build app + server hijau.

---

*End of Roadmap.*
