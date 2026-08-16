# Roadmap — DevHub

| Field | Value |
|---|---|
| **Document status** | Active |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-13 |

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
| Defer V2 | Port-based connector + port UI (visual handles tetap defer), auto-layout, per-element PATCH, MCP whiteboard tools, gzip compression middleware di server. ~~Snap grid/alignment~~, ~~refs entity lain~~ → dikerjakan di M18 (ADR-026) |

---

## 11b. Whiteboard Diagramming v2 (M18 — ADR-026)

M18 v0.12.0 (12 task, ~30h) — riset kebutuhan lintas-skenario (flowchart, backend architecture, mind map, wireframe, swimlane, deployment) menutup 12 gap dengan satu set schema extension zod (tanpa migrasi DB). Lihat [ADR-026](../02-architecture/adr.md#adr-026).

| Task | Isi |
|---|---|
| Schema & types | `shapeType` +cylinder/parallelogram/hexagon/roundedRect; edge +`label ≤200` +`arrowStyle` enum (compat: `arrowhead:true` → derived solid); text +`w?`; kind baru `boundary` (container visual dashed + label); mirror `app/src/lib/types.ts`; search collector +edge.label/boundary.label; round-trip + strip test server |
| Render label + popover edge | Fix bug label shape (tidak dirender); edge label midpoint + halo; popover edge (label/color/arrowStyle, double-click) |
| Orthogonal routing | `orthogonalPath()` pure di `edges.ts` (Manhattan 3/4/5 segmen sesuai port, render-time — tidak disimpan di schema); arrowhead ikut segmen terakhir; hit-test polyline; preview draft edge |
| Snap + alignment + distribute | Snap drag ke grid 32px (radius 8); alignment guides 4px saat drag; toolbar seleksi: Distribute H/V |
| Copy/paste + duplicate | Ctrl+C/V + Ctrl+D; clipboard internal JSON, `newId()`, remap edge dalam seleksi, drop edge lintas seleksi, offset +24, cap 1000 guard |
| Boundary container | Tool B, drag-to-size, render selalu di belakang, bukan target edge, popover label/color |
| Shape + arrowhead styles | Render 4 shape baru (`shapePath`); marker none/open/solid/diamond/circle (default solid utk edge baru) |
| Z-order + resize | Bring forward/Send backward di toolbar seleksi; resize handle bottom-right (shape/sticky/boundary, min size, ikut snap) |
| Text wrap | text `w?` → render multiline via wrapToWidth; popover Shift+Enter newline |
| Ref entity lain | RefPicker multi-entity (testCases/milestones/techEntries/decisions/tables/apiCollections/apiEndpoints); refDataMap meta per entity; `entityDeepLink` sudah support semua |
| Export PNG/SVG | Serialize SVG `viewBox` = bounds elemen + margin 32; PNG via canvas 2×; tombol Export (member-only) |
| Docs & verifikasi | ADR-026 + roadmap; server+app test suite; lint; build; e2e journey labeled edge + copy/paste |

Semua fitur edit di-gate `canEdit`/`readOnly` (public share aman). Port handles visual & auto-layout tetap defer.

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

*End of Roadmap.*
