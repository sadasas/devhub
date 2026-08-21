# Architecture Decision Record (ADR) Log — DevHub

| Field | Value |
|---|---|
| **Document status** | Active (living document) |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-13 |

---

## 1. ADR Process

- Every significant architectural or product decision gets an ADR.
- Each ADR follows the template below and stays immutable except for status transitions.
- Statuses: **Proposed → Accepted | Rejected | Superseded**.
- To revisit a decision: write a new ADR referencing the old one, don't edit the old one.

### Template

```markdown
## ADR-XXX — Title

- **Status:** Accepted (date)
- **Context:** ...
- **Decision:** ...
- **Consequences:** positive / negative
- **Alternatives considered:** ...
```

---

## 2. ADR Index

| ID | Title | Status | Date |
|---|---|---|---|
| [ADR-001](#adr-001) | Scope & positioning: personal dev hub, not a team tool | Accepted | 2026-08-09 |
| [ADR-002](#adr-002) | Project state stored as JSONB in PostgreSQL | Accepted | 2026-08-09 |
| [ADR-003](#adr-003) | AI agents interact via MCP tools only (no direct DB/file access) | Accepted | 2026-08-09 |
| [ADR-004](#adr-004) | No Git CLI integration in V1 | Accepted | 2026-08-09 |
| [ADR-005](#adr-005) | Auth: email+password, bcryptjs, JWT in httpOnly cookie | Accepted | 2026-08-09 |
| [ADR-006](#adr-006) | MCP server: remote (streamable HTTP) with API-key auth | Superseded by [ADR-013](#adr-013) | 2026-08-09 |
| [ADR-007](#adr-007) | Zero UI runtime dependencies except @phosphor-icons/react | Superseded by [ADR-016](#adr-016) | 2026-08-09 |
| [ADR-008](#adr-008) | Design system: dark-tech, native CSS variables, emerald accent | Accepted | 2026-08-09 |
| [ADR-009](#adr-009) | Every entity extends Base { id, createdAt, updatedAt, authorId } | Accepted | 2026-08-09 |
| [ADR-010](#adr-010) | V1 deploys publicly (multi-user), not local-file mode | Accepted | 2026-08-09 |
| [ADR-011](#adr-011) | No in-app AI chat UI; AI integration via MCP tools only | Accepted | 2026-08-09 |
| [ADR-012](#adr-012) | Task dependencies, test cases, milestones promoted to V1 | Accepted | 2026-08-09 |
| [ADR-013](#adr-013) | MCP auth: per-user API keys, not a shared server secret | Accepted | 2026-08-10 |
| [ADR-016](#adr-016) | URL-based routing with react-router v7 | Accepted | 2026-08-11 |
| [ADR-017](#adr-017) | Public read-only project sharing (`/p/:projectId`) | Accepted | 2026-08-12 |
| [ADR-019](#adr-019) | API docs: collections + endpoints with OpenAPI import/export | Accepted | 2026-08-12 |
| [ADR-021](#adr-021) | Product positioning: hosted SaaS | Accepted | 2026-08-13 |
| [ADR-022](#adr-022) | Granular REST API per entity (design), replacing coarse PUT /state | Accepted | 2026-08-13 |
| [ADR-023](#adr-023) | Whiteboard entity terpadu: brainstorming + flowchart + entity ref cards | Accepted | 2026-08-14 |
| [ADR-024](#adr-024) | WebSocket real-time: `ws` dependency + generic room registry | Accepted | 2026-08-14 |
| [ADR-036](#adr-036) | Envelope respons API: resource tunggal bare, koleksi dibungkus (unifikasi ditunda ke v2) | Accepted | 2026-08-19 |
| [ADR-037](#adr-037) | Scope MCP: read/append-only, transport stateless POST-only, truncation project_state | Accepted | 2026-08-19 |
| [ADR-038](#adr-038) | Pengecualian produk: viewer boleh menulis chat; fail-closed public sharing; strip unknown fields | Accepted | 2026-08-19 |
| [ADR-039](#adr-039) | User stats endpoint: `GET /auth/me/stats` dari `activity_log` (GitHub-style profile stats) | Accepted | 2026-08-20 |
| [ADR-040](#adr-040) | Route-level code splitting + per-route contentful skeletons | Accepted | 2026-08-20 |
| [ADR-041](#adr-041) | Server modular monolith: struktur DDD per bounded context (`modules/<domain>`) | Accepted | 2026-08-21 |

---

## 3. ADR Details

### ADR-001
**Scope & positioning: personal dev hub, not a team tool**

- **Status:** Accepted (2026-08-09)
- **Context:** Market research (2026) shows PM software dominated by team tools (Linear, Jira, ClickUp). Solo developers are underserved; no tool tracks technical memory (stack, schema, ADRs, test cases).
- **Decision:** DevHub is positioned as a complementary "technical memory + lightweight tracker" for solo devs. Not built to compete with Linear/Jira. Monetization not a V1 goal.
- **Consequences:** Positive — clear scope, differentiated features. Negative — no immediate revenue path.
- **Alternatives:** Team-first tool (rejected: hopeless vs Linear/Jira); AI-native clone (rejected: commodity).

### ADR-002
**Project state stored as JSONB in PostgreSQL**

- **Status:** Accepted (2026-08-09)
- **Context:** Originally file-first (JSON on disk) for a local tool. Pivoted to public multi-user deploy (ADR-010), which requires a database-backed backend.
- **Decision:** One `projects` table with a JSONB `data` column holding the full project state (10 entities). Whole-document `GET/PUT /state` with zod validation.
- **Consequences:** Positive — simple, flexible, single-writer avoids races, JSONB supports indexing when needed. Negative — no relational queries across entities (not needed at this scale); full-document writes (fine for solo-scale data).
- **Alternatives:** Relational tables per entity (rejected: premature); plain files (rejected: unsafe for multi-user).

### ADR-003
**AI agents interact via MCP tools only**

- **Status:** Accepted (2026-08-09)
- **Context:** Agents like opencode could read files/db directly; that bypasses validation and blurs the data boundary.
- **Decision:** All agent access goes through MCP tools (`project_state`, `plan_project`, `create_task`, `update_task`, `add_issue`, `add_decision`, `update_milestone`). No direct file or DB reads.
- **Consequences:** Positive — single validated entry point, auditable. Negative — agents can't run raw queries (fine).

### ADR-004
**No Git CLI integration in V1**

- **Status:** Accepted (2026-08-09)
- **Context:** Web browsers cannot spawn a git CLI. Options: Node sidecar, Electron, Tauri, isomorphic-git.
- **Decision:** Skip Git integration in V1 entirely.
- **Consequences:** Positive — avoids architecture weight. Negative — no in-app git status; revisit in Phase 3 (optional Tauri desktop).
- **Alternatives:** Node sidecar (deferred); Electron/Tauri (over-engineering for V1).

### ADR-005
**Auth: email+password, bcryptjs, JWT in httpOnly cookie**

- **Status:** Accepted (2026-08-09)
- **Context:** Public deploy needs accounts. Pure-JS bcryptjs avoids native build issues on Windows dev machine.
- **Decision:** Register/login/logout with email+password; password hashed with bcryptjs (cost ≥ 10); JWT HS256 signed with `JWT_SECRET`, 24h expiry, delivered via httpOnly cookie (`SameSite=Lax; HttpOnly; Secure` in prod); express-rate-limit on auth endpoints.
- **Consequences:** Positive — safe, simple, no third-party auth dependency. Negative — password management burden for users (acceptable).

### ADR-006
**MCP server: remote (streamable HTTP) with API-key auth**

- **Status:** Superseded by [ADR-013](#adr-013) (2026-08-10)
- **Context:** opencode supports both local (stdio) and remote (HTTP) MCP servers. Public deploy means agents connect over the network.
- **Decision:** Remote MCP server implemented with `@modelcontextprotocol/sdk`, streamable HTTP transport at `/mcp`, authenticated with `Authorization: Bearer <MCP_API_KEY>`.
- **Consequences:** Positive — works from any agent anywhere; official SDK support. Negative — requires API-key management.
- **Superseded because:** the single shared `MCP_API_KEY` env secret could not attribute requests to a user, so MCP tools had no ownership enforcement and any key holder could read/write every user's projects. See ADR-013.

### ADR-013
**MCP auth: per-user API keys, not a shared server secret**

- **Status:** Accepted (2026-08-10)
- **Context:** ADR-006 used one global `MCP_API_KEY` env var for all MCP clients. With public multi-user deploy (ADR-010), that meant any holder of the key could read and modify **all** projects of **all** users — the MCP tools did not check `owner_id`, unlike the REST API. The REST side already had per-user identity (`requireAuth` → `req.userId`); MCP had none.
- **Decision:** MCP access uses per-user API keys:
  - New `mcp_keys` table: `id, user_id (FK → users, ON DELETE CASCADE), name, key_hash (SHA-256 of the raw key — raw key is never stored), prefix, created_at, last_used_at, revoked_at`.
  - New REST endpoints under `requireAuth`: `GET /api/keys` (list mine), `POST /api/keys` (create, raw key returned once), `DELETE /api/keys/:id` (soft revoke).
  - The `/mcp` middleware hashes the bearer token, looks up `key_hash` + `revoked_at IS NULL`, and binds `req.userId`. All MCP tool DB access is then scoped `owner_id = userId` (same rule as `getOwnedProject`).
  - `MCP_API_KEY` env var is removed entirely — no shared backdoor.
- **Consequences:** Positive — MCP tools are now user-scoped (closes cross-user access); keys can be revoked individually without restarting the server or editing agent configs; per-key `last_used_at` gives an audit trail; key rotation = create new + revoke old. Negative — users must create a key before agents can connect (small onboarding step); an extra table + endpoints to maintain.
- **Alternatives considered:** Per-project keys (rejected: friction — one key per project to manage, and keys would live in per-repo configs); keeping `MCP_API_KEY` as dev-only fallback (rejected: reintroduces an unscoped access path); admin key alongside per-user keys (rejected: least-privilege violation).

### ADR-007
**Zero UI runtime dependencies except @phosphor-icons/react**

- **Status:** Superseded by [ADR-016](#adr-016) (2026-08-11)
- **Context:** Long-term maintainability; design system skill mandates a single icon family and no hand-rolled icons.
- **Decision:** Runtime UI deps = `@phosphor-icons/react` only. Kanban DnD (native HTML5), charts (hand-built SVG), state (Context+useReducer).
- **Consequences:** Positive — tiny bundle, few breakages. Negative — some features take more code (accepted).
- **Superseded because:** URL-based routing became a hard requirement once DevHub grew beyond a solo tool (ADR-001 positioning changed); hand-rolling routing on Context would cost more than the dependency it saves. See ADR-016.

### ADR-008
**Design system: dark-tech, native CSS variables, emerald accent**

- **Status:** Accepted (2026-08-09)
- **Context:** tasteskill (design-taste-frontend) applied. Design read: developer-grade product UI, dark-tech language (Linear × GitHub Dark × terminal), cockpit-lean density.
- **Decision:** Dials VARIANCE 4 / MOTION 3 / DENSITY 7. Zinc off-black surfaces, hairline borders `rgba(255,255,255,0.08)`, one accent (emerald ~#10b981 desaturated), semantic status colors, Geist/Geist Mono via @fontsource, documented radius + z-index scales, WCAG AA, `prefers-reduced-motion` honored.
- **Consequences:** Positive — cohesive, non-templated UI. Negative — dark-only theme (locked).

### ADR-009
**Every entity extends Base { id, createdAt, updatedAt, authorId }**

- **Status:** Accepted (2026-08-09)
- **Context:** Future collaboration (Phase 3) requires merge-ready data.
- **Decision:** All 10 entities carry UUID `id`, ISO `createdAt`/`updatedAt`, optional `authorId`. `updatedAt` enables last-write-wins merging.
- **Consequences:** Positive — Phase 3 sync needs zero schema changes. Negative — a few extra bytes per entity (irrelevant).

### ADR-010
**V1 deploys publicly (multi-user), not local-file mode**

- **Status:** Accepted (2026-08-09)
- **Context:** Original plan was a local-first file tool. Owner chose public deploy with accounts.
- **Decision:** Single server, Postgres, auth (ADR-005). Local-file mode dropped. Hosting platform TBD (Railway/Render/VPS); design portable via env vars + Dockerfile.
- **Consequences:** Positive — real product, accessible anywhere. Negative — hosting cost, ops responsibility, legal obligations (privacy policy + ToS drafted in `docs/06-compliance/`).

### ADR-011
**No in-app AI chat UI; AI integration via MCP tools only**

- **Status:** Accepted (2026-08-09)
- **Context:** Owner wants AI agents (opencode) to work *on* the project, not a chatbot inside DevHub.
- **Decision:** No chat surface in V1. AI interacts exclusively through MCP tools.
- **Consequences:** Positive — keeps UI focused; agent loop is the product. Negative — no natural-language UI inside app (by design).

### ADR-012
**Task dependencies, test cases, milestones promoted to V1**

- **Status:** Accepted (2026-08-09)
- **Context:** Lifecycle review (idea → release) found V1 impossible without these: blocked work needs dependencies, release readiness needs test checklists, releases need milestones.
- **Decision:** `Task.blockedBy`, TestCase entity, Milestone entity all ship in V1 (previously deferred).
- **Consequences:** Positive — coherent lifecycle. Negative — slightly larger V1 (accepted).

### ADR-016
**URL-based routing with react-router v7**

- **Status:** Accepted (2026-08-11)
- **Context:** Navigation was state-based (a `View` union in a React context) with no URL routes. That prevented deep-linking, browser back/forward, and bookmarking — acceptable for a solo local tool, but DevHub now ships multi-user teams (ADR-010, ADR-013) and a public deploy, where shared URLs matter. Supersedes the dependency constraint in ADR-007.
- **Decision:** Adopt `react-router` v7 with URL routes:
  - `/` dashboard, `/project/:projectId` project, `/team/:teamId` team, `/invites`, `/keys`, `/docs/mcp` docs, unknown paths redirect to `/`.
  - `BrowserRouter` + `Routes`; `Layout` renders `<Sidebar/>` + `<Outlet/>`.
  - `useNavigate`/`useParams` replace the `NavigationContext` (deleted). Sidebar uses `NavLink`.
- **Consequences:** Positive — deep links, back/forward, shareable URLs, less app-owned navigation state. Negative — one new runtime dependency (react-router) and prod hosting needs an `index.html` fallback for SPA routes (dev Vite already does this; Phase 2 item).
- **Alternatives considered:** Hand-rolled history API on Context (rejected: reimplements what a battle-tested library does); hash-based routing (rejected: ugly URLs); keeping state-based nav (rejected: no deep links).

### ADR-017
**Public read-only project sharing (`/p/:projectId`)**

- **Status:** Accepted (2026-08-12)
- **Context:** DevHub projects were only visible to team members behind the login wall. Users wanted to share a project with anyone — no login, no team membership. Sharing must be opt-in per project and read-only; write access stays inside teams.
- **Decision:**
  - `projects.visibility` column (`private` default | `public`); new migration `006_project_visibility.sql`.
  - New unauthenticated router `/api/public` exposing `GET /api/public/projects/:projectId` (meta) and `GET /api/public/projects/:projectId/state` (full state) — both return 404 unless the project is public (no existence leak).
  - Route `/p/:projectId` in the app renders a read-only shell (board, issues, stack, milestones, about) outside the auth gate; the gate stays for every other route.
  - Visibility toggling is `PATCH /api/projects/:projectId { visibility }`, restricted to owner/admin (`assertAdmin`); the ProjectPage header shows the toggle and a copy-public-link button.
- **Consequences:** Positive — shareable public URLs with zero runner overhead. Negative — anyone with the link can read public project state (intended); MCP and member REST access are unchanged; prod hosting needs SPA fallback for `/p/*` too (Phase 2).
- **Alternatives considered:** Reusing `/project/:projectId` for anonymous viewers (rejected: couples public shell with the member flow); a per-project secret token (rejected: overhead without real gain for a hosted SaaS tool); read-only team invites (rejected: still requires accounts).

### ADR-019
**API docs: collections + endpoints with OpenAPI import/export**

- **Status:** Accepted (2026-08-12)
- **Context:** DevHub tracked tasks, stack and schema, but had no surface for documenting the project's HTTP API. Solo devs end up in Postman/Redoc side-by-side, duplicating state and cutting agents (MCP) off from the API surface. DEF-002 (API Endpoint Inventory) was previously deferred; a designer+research pass over Postman v12, Bruno, Hoppscotch and Redoc confirmed the universal grammar: collections tree + method-colored endpoints + tabs for headers/params/body/responses + read-only docs view.
- **Decision:**
  - Two new entities in the state document (JSONB arrays with `.default([])` — no DB migration, ADR-002): `apiCollections` (name ≤200, description ≤2k) and `apiEndpoints` (nullable `collectionId`, method enum GET/POST/PUT/PATCH/DELETE/OPTIONS, path ≤500, name ≤200, description ≤10k, `headers[]` {key,value,description}, `params[]` {name, in: path|query|header, required, description}, `body` ≤50k, `responses[]` {status, contentType, description, body}).
  - **API** tab in the project page: two-pane layout — resizable collections tree with search (220–360px) + workbench with tabs (Headers / Params / Body / Responses); read-only **preview** mode doubles as the docs view (default for viewers).
  - OpenAPI 3.0.3 import/export client-side in `app/src/lib/openapi.ts` (YAML via the `yaml` dependency, relaxed under the ADR-016 precedent): tags → collections, paths → endpoints; export writes tags/paths from state. Import merges by collection name (case-insensitive).
  - MCP tools `add_api_collection`, `add_api_endpoint`, `update_api_endpoint` (writes follow the PATCH pattern of `update_task`).
  - **Documentation only:** no request sending or mocking — Postman-style runner explicitly out of scope.
- **Consequences:** Positive — lifecycle completes (schema defines the model, tasks build the API, endpoints document it); exports feed Swagger UI/Redoc/Postman; agents can read and document the API via MCP. Negative — one new UI dependency (`yaml`); imported documents are reduced (paths keep example values only, not the full schema objects).
- **Alternatives considered:** External tool (Postman/Redoc) (rejected: extra account, duplicate state, no agent access); request runner UI (rejected: large scope, contradicts DEF-002 rationale); storing the raw OpenAPI blob (rejected: not queryable per-endpoint, no MCP granularity).

### ADR-021
**Product positioning: hosted SaaS**

- **Status:** Accepted (2026-08-13)
- **Context:** DevHub shipped V1 with a personal-tool positioning — solo developer, self-hosted, monetization explicitly deferred (ADR-001). The product grew multi-user foundations (teams, roles, invites — ADR-010, ADR-017), public registration is live, and projects can be shared publicly. The "self" positioning no longer matches the running service and contradicts user-facing copy ("local-first", "self-hosted").
- **Decision:**
  - DevHub is positioned as a **hosted, multi-user SaaS** project-management workspace for software projects — from solo projects to small teams.
  - **Self-hosting is not supported**; data portability is guaranteed via full project JSON export/import.
  - All user-facing copy and documentation use the SaaS glossary: *hosted SaaS*, *operator* (service owner), *workspace*. The terms *self-hosted*, *local-first*, and *single-user* no longer describe the product.
- **Consequences:** Positive — one coherent story across login page, README, docs, and legal text (ToS/Privacy); supersedes the self-hosted assumptions of ADR-001. Negative — user-data promises now sit on the operator's infrastructure: privacy policy and ToS §5 (data ownership) become load-bearing; requires operational discipline (backups, restore runbook).
- **Alternatives:** Keep self-hosted positioning (rejected: contradicts the running service and public sharing); hybrid self-hosted + SaaS (rejected: doubles the ops surface for an early-stage product); persona-specific "solo dev" (rejected: the product supports teams; copy should not narrow it).

### ADR-022
**Granular REST API per entity (design), replacing coarse PUT /state**

- **Status:** Accepted (2026-08-13) — implemented as the v1 REST surface.
- **Implementation notes (2026-08-13):** the whole API moved behind `/api/v1` (auth, teams, keys, public, projects); the legacy `/api` surface was **removed entirely** (deliberate deviation from "aliases kept" — no M7-era external clients exist, per ADR-021 self-hosting is unsupported). Granular routes in `server/src/api/v1/entity-router.ts` (generic factory over the 11 entities, zod schemas reused). Writes run in a transaction with `SELECT ... FOR UPDATE` row lock (per-project writer serialization); `If-Match: <version>` is **optional** — when present, a mismatch returns `409 CONFLICT` with `details.current.version` (same envelope as `PUT /state`); reads and writes return `ETag: "<version>"`. Create endpoints accept a client-supplied `id` (UI needs stable ids for optimistic rendering; duplicate ids are rejected). Cascade rules now live server-side. `PUT /state` remains as bulk/compat in v1. The frontend save pipeline was rewritten from full-document PUT to a coalesced per-entity mutation queue (debounced, flushed serially with `If-Match`; 409 surfaces the existing conflict banner; "Load latest" refetches the state).
- **Context:** The server audit 2026-08 (`docs/04-audit-server-2026-08.md`) found the coarse `PUT /api/projects/:projectId/state` (whole-document replace) to be a scalability ceiling: every save rewrites the entire JSONB document, read-modify-write races are only mitigated (not eliminated) by optimistic version locking (now `version` + 409), payloads grow with project size, and there is no way to write a single task without shipping the whole state. MCP tools already operate per-entity against a full-document read; the REST surface should offer the same granularity to UI and integrations.
- **Decision:** Design (not yet implement) a granular entity API mounted at a versioned prefix:
  - **Prefix /api/v1**: `GET|POST /api/v1/projects/:projectId/{tasks|issues|testCases|milestones|techEntries|decisions|tables|relations|schemaVersions|apiCollections|apiEndpoints}`, `GET|PATCH|DELETE .../{entityId}`. List responses support `?after=&limit=` cursor pagination; write payloads reuse the zod entity schemas from `server/src/schema/state.ts` (single source of truth).
  - **Conflicts**: `If-Match: <version>` + `ETag` on reads; `409 CONFLICT` with `details.current` (same envelope as today's state PUT). The whole-state `PUT /state` stays as a bulk/compat endpoint that also bumps `version`.
  - **Cascade rules move server-side** (frontend currently unlinks relations/issues/milestones in the reducer): deleting a table removes its relations, deleting a milestone clears `task.milestoneId`, deleting a task clears `issue.linkedTaskId`.
  - **MCP stays full-document** (`loadState` → mutate → `saveState`): the agent loop keeps a coherent snapshot model; granular REST is for UI/humans and integrations.
  - **Versioning policy**: when implemented, current routes move behind `/api/v1` with `/api` aliases kept for the M7 client; old aliases deprecated one minor release later.
- **Consequences:** Positive — partial writes, smaller conflict surface, cache-friendly reads, one canonical validation layer. Negative — more routes to test, frontend migration is incremental (project context keeps full-state polling; only hot write paths move to granular endpoints), and release scope grows post-M7.
- **Alternatives:** Keep only `PUT /state` (rejected: whole-document rewrites and payload growth, audit S2); per-entity CRUD without versioning (rejected: reintroduces lost updates); CRDTs per entity (rejected: overkill for current collaboration scale); GraphQL layer (rejected: new runtime dependency and tooling for a REST-shaped product).

### ADR-023
**Whiteboard entity terpadu: brainstorming + flowchart + entity ref cards**

- **Status:** Accepted (2026-08-14) — implementasi dijadwalkan **M17 v0.11.0** (milestone baru; sebelumnya dirancang sebagai workstream M11, dipindah saat M11 rilis tanpa whiteboard)
- **Follow-up (task 61b8f2aa, canvas core):** `app/src/features/whiteboard/geometry.ts` (view math `screenToWorld`/`worldToScreen`/`panBy`/`zoomAtPoint` clamp 0.3–3, `elementBounds` per 6 kinds, `wrapText`) + `WhiteboardCanvas.tsx` (SVG dot-grid via `<pattern>` userSpaceOnUse yang ikut zoom, `<g transform>` view, `ElementView` React.memo per kind, wheel zoom-at-cursor + pointer-capture pan dari pola `ERD.tsx`, tombol zoom aktif, zoom buttons + hint di dalam canvas; toolbar tools masih disabled menunggu tool task c2407cb4).
- **Follow-up (task c2407cb4, tools pen/eraser):** toolbar hidup untuk 3 tool pertama (Select/Pen/Eraser, `aria-pressed` + `.sub-tab-active`, keydown digit 1–3 dengan guard `isTypingTarget`/`isModalOrPaletteOpen`; 5 tool lain + Undo/Redo tetap disabled). `tools.ts` — `buildStroke(tool, points)` (pen `#e4e4e7`/2px, eraser `#8a8a93`/6px, thinning 2), `shouldCommitStroke` ≥2 titik. Canvas: tool select = pan; pen/eraser = draft layer ref-based (`draftRef` + polyline live), titik di-`screenToWorld`, commit SATU dispatch `whiteboard/update` per gesture di pointerup (merge `[...board.elements, stroke]`), <2 titik atau pointercancel → discard tanpa commit.
- **Follow-up (task f58fb26f, tools text/sticky/shape + popover + palette):** toolbar hidup untuk 6 tool pertama (Select/Pen/Eraser/Text/Sticky/Shape, digit 1–6). Klik di kanvas dengan tool text/sticky/shape = 1 gesture = 1 dispatch `whiteboard/update` yang menambah elemen (factory `buildSticky`/`buildText`/`buildShape` di `tools.ts`, default schema: sticky 200×120 `#e8b955`, text fontSize 16 `#e4e4e7`, shape 120×80 rect `#6ea8fe` fill false strokeWidth 2) lalu membuka `WhiteboardPopover` floating (posisi mengikuti pan/zoom via `worldToScreen`): text/sticky → edit teks (Enter commit `patch {text}`), shape → segmented rect/diamond/ellipse + label + toggle fill, semuanya dengan `ColorPalette` 8 warna token (`aria-pressed`/radiogroup). `patchElement` mengganti elemen dengan id popover; Esc pada elemen baru berteks kosong → `whiteboard/remove`. Re-edit elemen lama via select tool masuk task a82e0480.
- **Follow-up (task a82e0480, select + edge tool):** select tool kini bukan pan murni — hit-test `elementsAtPoint` (tol 8px, urutan terakhir = teratas, edge via jarak ke segmen), klik node → seleksi (outline accent dashed, `data-testid="wb-selection"`, Shift = multi-select), drag → 1 dispatch patch posisi per gesture (`commitDrag`), pan hanya pada klik kosong atau Space ditahan. Delete/Backspace menghapus seleksi + cascade edge insiden (`removeSelection`). Tool Edge (digit 7, `edges.ts` pure): drag node A → preview rubber-band dengan snap ke node hover (`edgeEndpoints` — port terdekat `portToward`, snap 12px ke port bbox target via `snapPointToBounds`), release di node B → commit edge `{sourceNodeId, targetNodeId, arrowhead: true}`. Endpoint edge ber-node di-derive saat render dari `elementBounds` (ikut drag node via `derivedEdges`), arrowhead dirotasi mengikuti arah (atan2); edge bebas (tanpa node) tetap pakai koordinat tersimpan.
- **Follow-up (task 061f3219, undo/redo):** history undo/redo LOKAL per sesi board via `useWhiteboardHistory` (in-memory, `HISTORY_LIMIT` 30, tidak persist lintas reload) — `record()` dipanggil sebelum 7 titik commit (`endDraw`, `removeSelection`, `placeElement`, `patchElement`, `closePopover`, `commitDrag`, `commitEdge`); `undo()`/`redo()` men-dispatch `whiteboard/update` snapshot (pipeline autosave If-Match tetap berlaku; 2 user kolaborasi → versi server menang via 409/LWW). Tombol Undo/Redo toolbar aktif (`disabled={!canUndo}`/`!canRedo`); shortcut `Mod+Z` undo, `Mod+Y`/`Mod+Shift+Z` redo via `historyRef` (guard `isTypingTarget`/`isModalOrPaletteOpen`); redo stack di-clear saat record baru.
- **Context:** Permintaan fitur "drawing untuk brainstorming" + "flowchart editor" untuk proyek DevHub. Analisis dua agent (Senior PM + Software Architect) menyimpulkan: kedua kebutuhan adalah **satu kontinum** (sketsa kasar → diagram rapi di kanvas yang sama), bukan dua domain; constraint `docs/04-audit-ui-ux.md:54` (A1: batasi 10 tab) membuat 2 entity/tab baru melanggar 2×; kanvas engine (pan/zoom/pointer/viewport) ≈ 70% kerumitan teknis dan dibangun sekali; pelajaran DEF-005 (roadmap.md:86 — fitur freeform tanpa semantik mati) mendorong satu entity terpadu dengan semantik node/edge yang bisa tumbuh. Library diagram (tldraw/Excalidraw) dievaluasi: melanggar ADR-007 (nol runtime dep selain @phosphor-icons/react), menambah 1–2 MB bundle, dan model data menjadi milik library — tanpa keuntungan untuk fitur ref/tagging (fitur data-model, bukan rendering). User juga meminta elemen yang **menampilkan entity DevHub secara live** (mis. kartu task sebagai sumber riset di kanvas).
- **Decision:**
  - Satu entity `whiteboards: Whiteboard[]` di state JSONB (ADR-002, `.default([])`, tanpa migrasi DB) — tab **Whiteboard** (tab ke-11, deviasi A1 yang dicatat) di project page.
  - Elemen = `z.discriminatedUnion('type')` dengan **id saja** (bukan Base penuh — elemen bukan entity, ADR-009): `stroke` {tool pen|eraser, color hex, width, points ≤2.000 + thinning 2px saat draw}, `sticky` {x,y,w,h,color,text ≤500}, `text` {x,y,color,fontSize,text ≤1.000}, `shape` {rect|diamond|ellipse, x,y,w,h,color,fill?,strokeWidth,label ≤200}, `edge` {x1,y1,x2,y2,color,width,arrowhead, sourceNodeId?/targetNodeId? nullable — endpoint direkomputasi ulang saat render dari bbox node}, `ref` {entity: tasks|issues (V1), entityId — kartu live menampilkan judul+status dari state project, klik → deep-link ke modal}.
  - Caps: **1.000 elemen/board, 2.000 titik/stroke, 5 board/project**, koordinat ±100.000.
  - Eraser = **deletion tool** (elemen yang dipersist selalu `tool:'pen'`).
  - Canvas **hand-built SVG** (nol dependency baru): view `{x,y,s}` + `<g transform>` (pola `ERD.tsx`), draft layer ref-based (tanpa re-render semua elemen), commit **1× per gesture** (pointerup) → pipeline save existing (debounce 800ms + If-Match queue, ADR-014/022).
  - Edge V1 = **free-hand + snap-ke-node** (toleransi 12px); port-based connector, snap grid, multi-select, auto-layout, per-element PATCH → V2.
  - Activity: diff `elements` sebagai **summary-count** (`Elements: 37 → 41`) bukan JSON raksasa; clustering 60s existing tetap berlaku.
  - Search: collector kustom — `name` (weight 3) + `sticky.text`/`text.text`/`shape.label`/judul task di `ref` (weight 1); tanpa noise hex/uuid.
  - Public share read-only: tab whiteboard di `/p/:id` (sharing.ts + PublicProjectPage, renderer reuse).
  - Supersedes rencana lama "FlowchartsTab M14 T4 / New flowchart M15 T5" (`docs/04-audit-ui-ux.md:268`).
- **Consequences:** Positive — satu kanvas untuk brainstorming & diagram alir; ref cards menghidupkan kanvas (task live, deep-link); granular API/activity/search/export/import/MCP `project_state` otomatis ikut (backward compatible); nol dependency baru. Negative — payload `projects.data` membesar (skenario sedang ~2.8× baseline, cap membatasi); tab ke-11 melanggar A1 (dicatat sebagai deviasi; solusi Overview/overflow tetap backlog); konflik If-Match lebih sering saat kanvas aktif (banner existing menangani); undo/redo terbatas in-memory (snapshot cap 30).
- **Alternatives:** Dua entity `whiteboards` + `flowcharts` terpisah (ditolak: 2 tab = A1 dilanggar 2×, duplikasi kanvas engine ~3.5h + integrasi 2×, transisi sketsa→alur putus); library tldraw/Excalidraw (ditolak: ADR-007, bundle +1–2 MB, data model milik library, ref cards tetap harus custom); tagging refs terpisah tanpa elemen `ref` (ditolak: user butuh tampilan live, bukan sekadar label).

### ADR-024
**WebSocket real-time: `ws` dependency + generic room registry**

- **Status:** Accepted (2026-08-14) — M12 real-time collaboration, task 1 (WS server)
- **Context:** Roadmap Phase 3 (DEF-011) menempatkan real-time collaboration di V3; M12 membawa WebSocket pertama. Kebutuhan: server push state-diff ke member proyek yang online (broadcast), presence, dan nanti room team untuk chat (M13). Constraint `coding-standards.md:174` (no new runtime dependencies, or ADR-recorded) mengharuskan keputusan tercatat; server saat ini tidak punya WebSocket/HTTP-server apeks selain `app.listen` (`server/src/index.ts:10`) dan tidak ada library realtime apa pun. Session auth berbasis cookie JWT httpOnly (`devhub_session`) dengan `jwt_version` di DB — handshake WS harus memverifikasi cookie + version terhadap DB (pola `requireAuth.ts`), karena `cookie-parser` hanya berjalan pada request HTTP Express.
- **Decision:**
  - Pustaka **`ws`** (runtime dep server) — minimal, battle-tested, tanpa transpor/event layer bawaan; room abstraction dibangun sendiri sebagai `RoomRegistry` generik (`server/src/realtime/rooms.ts`): `Map<roomKey, Set<WebSocket>>` dengan `join/leave/leaveAll/size/broadcast`, room key string (`project:{id}` sekarang, `team:{id}` di M13), satu socket boleh di banyak room.
  - `createRealtimeServer(httpServer, rooms)` (`server/src/realtime/ws-server.ts`): `WebSocketServer({ server, path: '/ws' })`; auth di event `connection` — parse manual header `Cookie` (tanpa cookie-parser), `verifySession(token)` (helper baru di `auth/jwt.ts`: `verifyToken` + cek `users.jwt_version`, di-refactor dari `requireAuth`), gagal → `close(4001, 'UNAUTHORIZED')`.
  - Protokol JSON minimal: client→server `{type:'join', projectId}` (uuid), `{type:'leave'}`, `{type:'ping'}`; server→client `hello {userId}`, `pong`, `joined {projectId, role, teamId}`, `left`, `error {code, message}`. `join` diverifikasi `getProjectWithRole(userId, projectId)` → bukan member: frame `error 403` (koneksi tetap hidup); sukses: join room + frame `joined` (role dijawab server, bukan client — defense-in-depth sama seperti REST).
  - Heartbeat: ping interval 30s + flag `isAlive` (pola standar `ws`), socket mati di-`terminate`; `httpServer` dibuat eksplisit di `index.ts` (`http.createServer(app)`), shutdown menutup semua client WS lalu `server.close`.
  - Scope M12 task 1 = server infra saja (handshake/rooms/protokol/heartbeat/shutdown + test dasar); broadcast state-diff, client WS, presence, test suite penuh → task M12 2–5.
- **Consequences:** Positive — `ws` satu paket tanpa transitif; room registry generik dipakai M13 (team room) tanpa perubahan; auth satu sumber (JWT cookie) untuk REST + WS; frame JSON sesuai gaya envelope REST. Negative — dependency runtime baru (dictatat, precedent ADR-016/019); handshake auth async berarti koneksi sempat terbentuk sebelum ditutup untuk token invalid (tidak ada data dikirim sebelum `hello`); protokol/presence masih harus dibangun sendiri.
- **Alternatives:** socket.io (ditolak: ~10 paket transitif, rooms/namespaces built-in menduplikasi registry sendiri, event-layer berat untuk skala ini); hand-rolled raw WebSocket (ditolak: implementasi RFC 6455 — handshake, masking, fragmentation, ping/pong — risiko bug tinggi tanpa benefit); implementasi di M13 (ditolak: chat butuh room infrastructure yang sama, M12 mendahului).
- **Follow-up (2026-08-14, task M12 2):** broadcast protokol state-diff ditambahkan via `server/src/realtime/broadcast.ts` — bridge `attachRoomRegistry` + `broadcastDiff`/`broadcastSync` (no-op aman bila registry null). Setiap POST/PATCH/DELETE granular (`entity-router.ts`) → frame `{type:'state:diff', projectId, version, ops:[{entity, id, op:'created'|'updated'|'deleted', after?}]}` (after = entity lengkap untuk created/updated); PUT `/state` bulk + `saveState` MCP → frame kasar `{type:'state:sync', projectId, version}` (klien refetch). Server tidak mengecualikan socket penulis 1:1 (penulis HTTP ≠ socket WS; klien memfilter operasinya sendiri). Import restore tidak di-broadcast (jarang, tanpa version RETURNING).
- **Follow-up (2026-08-14, task M12 3):** presence — `RoomRegistry.members(room)` (daftar socket per room) + `leaveAll` mengembalikan daftar room yang ditinggal. `ws-server.ts` `broadcastPresence`: kumpulkan `socket.userId` per room `project:{id}` → `SELECT id, display_name FROM users WHERE id = ANY($1::uuid[])` → frame `{type:'presence', projectId, users:[{userId, name}]}` (display_name kosong bila belum diisi). Broadcast pada join sukses, leave, dan close (best-effort: error DB di-log, koneksi tetap hidup). Klien: `PresenceUpdate`/`onPresence` di `realtime-client.ts`, state `presence` di `project-context.tsx`, chip `PresenceChip.tsx` di header ProjectPage (badge-info "N online" + tooltip nama, dedupe).

### ADR-025
**Realtime sync: WS primary, polling fallback hanya saat socket disconnected**

- **Status:** Accepted (2026-08-17) — M12 follow-up
- **Context:** Setelah M12 selesai, semua jalur tulis (entity-router POST/PATCH/DELETE, `PUT /state`, MCP `saveState`) sudah di-broadcast sebagai `state:diff`/`state:sync` (ADR-024 follow-up), dan `RealtimeSocket` punya reconnect backoff + resync-on-join. Namun `ProjectProvider` masih menjalankan `setInterval` 5 detik (`POLL_INTERVAL_MS`) `GET /api/v1/projects/:id/state` tanpa syarat — Network tab menampilkan request berulang tiap 5 detik walau WS terhubung: trafik redundan (setiap perubahan di-push lalu di-poll ulang). Polling awalnya jaring pengaman untuk missed-diff, tapi kini berjalan paralel dengan push.
- **Decision:**
  - WS jadi **primary**: `RealtimeSocket` mengekspos `onOpen`/`onClose` (dipanggil di event `open` dan `onSocketClose`; `onClose` hanya saat socket pernah terbuka, tidak pada never-connected).
  - `ProjectProvider` menyimpan status koneksi di `wsConnectedRef` (ref, bukan state — dibaca interval tanpa re-render); interval polling 5 detik **di-skip saat socket connected** (`if (wsConnectedRef.current) return;`).
  - Saat WS re-connect, `onJoined` → `resyncFromServer()` sudah menutup gap, sehingga tidak ada state yang terlewat.
  - Polling kembali aktif **otomatis** saat socket putus — tetap jadi fallback untuk missed-broadcast / half-open connection / mode test (MODE=test tidak connect, polling tetap berjalan seperti sebelum).
- **Consequences:** Positive — nol trafik polling saat operasi normal; tetap tangguh saat WS down; diff kecil dan terlokalisir (guard tunggal di interval + 2 callback). Negative — bila broadcast hilang selagi socket terlihat connected (crash server antara commit DB dan broadcast), perubahan baru terserap saat reconnect/resync berikutnya (risiko kecil; sifat ini sudah ada sejak resync-on-join).
- **Alternatives:** Hapus polling total (ditolak: kehilangan jaring pengaman missed-diff tanpa kondisi apa pun); poll interval panjang 30–60s (ditolak: masih ada trafik periodik, guard saat disconnected lebih eksplisit dan nol-request saat normal).

### ADR-026
**Whiteboard diagramming v2: schema extension, render-time orthogonal, boundary container, export**

- **Status:** Accepted (2026-08-17) — M18
- **Context:** Riset kebutuhan whiteboard untuk berbagai skenario (flowchart, backend architecture, mind map, wireframe, swimlane, deployment) menyimpulkan dasar diagramming sudah lengkap sejak M17 (shape rect/diamond/ellipse, edge snap + `sourcePort`/`targetPort` + endpoint recompute saat drag, multi-select marquee, undo/redo). Gap lintas-skenario yang ditemukan (terverifikasi di kode): (1) **bug** — shape `label` tersimpan & diedit di popover tapi tidak pernah dirender (`WhiteboardCanvas.tsx` case `'shape'` hanya render `<path>`); (2) edge tanpa label — flowchart butuh kondisi (Yes/No), arsitektur butuh protokol (HTTP/gRPC/MQ); (3) edge garis lurus saja — arsitektur kompleks butuh routing orthogonal; (4) tanpa snap grid/alignment/distribute (dot grid 32px hanya visual); (5) tanpa copy/paste; (6) tanpa container/system boundary; (7) shape terbatas (tak ada cylinder/parallelogram); (8) `arrowhead` boolean saja; (9) tanpa export PNG/SVG; (10) ref card hanya tasks/issues; (11) text single-line tanpa wrap; (12) tanpa z-order/resize. ERD tidak perlu — sudah ada tab Schema sendiri.
- **Decision:**
  - **Schema (zod, state JSONB — tanpa migrasi DB, backward-compatible):** `shapeType` + `cylinder`/`parallelogram`/`hexagon`/`roundedRect`; edge + `label ≤200 default ''` + `arrowStyle enum ['none','open','solid','diamond','circle'] default 'none'` (elemen lama `arrowhead:true` di-derive `solid`); text + `w?` nullable (wrap); kind baru **`boundary`** — container visual `{id, x, y, w, h, color, label ≤200}` (bukan group semantics: tanpa child refs, tanpa refactor drag/delete/hit-test; render selalu di belakang elemen lain; bukan target edge).
  - **Orthogonal routing = render-time:** `orthogonalPath()` pure di `edges.ts` — Manhattan 3/4/5 segmen diturunkan dari endpoints + `sourcePort`/`targetPort`; **tidak** menyimpan path di schema (undo/redo, public share, dan edit port tetap konsisten). Arrowhead dirotasi mengikuti segmen terakhir; hit-test seleksi pakai distToSegment per segmen.
  - **Edit & UX:** popover diperluas ke edge (label, color, arrowStyle — double-click edge); snap drag ke grid 32px (radius 8) + alignment guides (4px) + toolbar seleksi (Distribute H/V, z-order); copy/paste Ctrl+C/V + duplicate Ctrl+D (clipboard internal JSON, `newId()`, remap edge dalam seleksi, drop edge lintas seleksi, cap 1000); resize handle bottom-right untuk shape/sticky/boundary; Shift+Enter newline di text; RefPicker multi-entity (testCases/milestones/techEntries/decisions/tables/apiCollections/apiEndpoints — `entityDeepLink` sudah support semua); export PNG/SVG client-side (serialize SVG `viewBox` = bounds elemen + margin 32; PNG via canvas 2×; member-only).
  - Semua fitur edit tetap di-gate `canEdit`/`readOnly` (public share read-only aman).
- **Consequences:** Positive — satu set schema extension menyelesaikan 12 gap; tanpa migrasi DB; export tanpa dependency baru (native SVG serialization + canvas); boundary sederhana tapi memenuhi arsitektur/swimlane. Negative — canvas makin kompleks (~+1.500 LOC di estimasi 30h/12 task); orthogonal routing & snap butuh unit test ekstra; cap 1000 elemen tetap; label/boundary/arrowStyle baru ikut index search collector (ditambahkan).
- **Alternatives:** Group semantics asli (selection → group berisi child refs; ditolak: refactor besar tanpa kebutuhan nyata); library diagram tldraw/Excalidraw (ditolak: ADR-007, bundle +1–2 MB, data model milik library); simpan path orthogonal di schema (ditolak: undo/redo, public share, dan edit port jadi tidak konsisten — cukup derive saat render).

---

*End of ADR Log. New decisions append below; existing entries never edited.*

### ADR-027
**MCP mutations tercatat di activity feed — diff state generik di `saveState`**

- **Status:** Accepted (2026-08-17) - M13.12
- **Context:** Mutasi REST (`entity-router.ts` `mutateProject`) menulis `activity_log` dalam transaksi yang sama (insert per entity + `pruneActivity`) dan `broadcastActivity` post-commit — daftar aktivitas per item (mis. ActivityList di modal detail task) dan feed project terisi otomatis. Jalur MCP berbeda: 15 tool mutasi (`create_task`, `update_task`, `update_issue`, `update_test_case`, `update_milestone`, `update_api_endpoint`, `add_*` (issue/decision/tech/table/relation/test-case/api-collection/api-endpoint), `delete_relation`, `plan_project`) semuanya memanggil `loadState` → mutasi in-memory → `saveState` (`server/src/mcp/state-db.ts:34`) yang hanya menjalankan `UPDATE projects SET data = ...` + `broadcastSync` — **tidak pernah `insertActivity`**, sehingga perubahan via MCP tidak muncul di list aktivitas per item maupun feed project. Identitas author tersedia: key MCP → `req.userId = row.user_id` (`mcp/require-key.ts:20`) → `getMcpUserId()` (key owner); `display_name` dari tabel `users`. `saveState` adalah satu choke point untuk semua tool MCP.
- **Decision:**
  - **`server/src/lib/activity.ts`** — export baru `diffStateDrafts(before: State, after: State): ActivityDraft[]`: diff by-id untuk 12 koleksi state (`tasks`, `issues`, `testCases`, `techEntries`, `tables`, `relations`, `schemaVersions`, `decisions`, `milestones`, `apiCollections`, `apiEndpoints`, `whiteboards`). Hanya di after → `created`; hanya di before → `deleted`; beda JSON → `updated`. Summary identik dengan REST (`entitySummary(entity, row)` untuk created/deleted; `entitySummary(entity, before, before, after)` untuk updated). Draft `updated` yang `diffEntities(...)`-nya kosong (hanya bump `updatedAt`) di-skip agar tidak menghasilkan baris aktivitas kosong.
  - **`server/src/mcp/state-db.ts` `saveState`** — diubah menjadi transaksi (`pool.connect()` + `BEGIN`…`COMMIT`/`ROLLBACK`, `SELECT data, version ... FOR UPDATE`): parse state lama → `diffStateDrafts(prev, next)` → `UPDATE projects SET data, version+1` → per draft `insertActivity(client, {projectId, draft, authorId: getMcpUserId(), authorName})` (cluster-merge 60s tetap berlaku untuk edit MCP beruntun) → `pruneActivity`. Post-commit: `broadcastSync(version)` (existing) + `broadcastActivity(projectId, entry)` per entry — paritas live-activity dengan REST.
- **Consequences:** Positive - paritas penuh REST vs MCP di activity feed; satu choke point menutup semua 15 tool termasuk `plan_project` (multi-entity dalam satu panggilan); tanpa perubahan client (ActivityList sudah merender author apa pun). Negative - biaya diff JSON per entity per panggilan `saveState` (kecil — sebanding full-state `UPDATE` yang sudah ada); `saveState` tetap tanpa optimistic locking (perilaku lama, tidak berubah).
- **Alternatives:** Draft eksplisit per tool (ditolak: 15 tool harus disentuh, `plan_project` multi-entity jadi rumit); MCP memanggil ulang REST `mutateProject` (ditolak: refactor invasif, MCP diizinkan mengedit state penuh).

---

### ADR-028
**Due date pada task + Calendar sebagai view di Board (bukan tab ke-12)**

- **Status:** Accepted (2026-08-17) — M19 v0.14.0
- **Context:** Riset platform (Linear/Plane/Todoist/Height/LinCal, M19): Linear tidak punya calendar view (gap diisi LinCal pihak ketiga) tapi due date first-class — icon warna merah = due hari ini/overdue, oranye ≤7 hari, abu-abu normal; filter Overdue/1d/1w/3m/no-date; sort by due date. Plane (OSS, analogi struktur terdekat) menjadikan Calendar salah satu dari 5 **layout** (List/Board/Calendar/Table/Timeline) — bukan halaman terpisah — dan hanya menampilkan item ber-due-date. LinCal (kalender Linear pihak ketiga): klik sel → quick-create dengan due date preset, drag reschedule, drop ke bottom bar = hapus due date, strip Unscheduled. Todoist natural-language date parsing (defer — jalur AI DevHub via MCP). DevHub saat ini: task **tanpa** `dueDate`; milestone punya `targetDate`; zod strip-mode mengharuskan schema extension + round-trip test (precedent M17 whiteboard); audit A1 membatasi jumlah tab (sudah 11 dengan whiteboard sebagai deviasi tercatat) — tab ke-12 dihindari.
- **Decision:**
  - **Schema (zod, state JSONB — tanpa migrasi DB, backward-compatible):** `taskSchema` + `dueDate: isoDate.nullable().optional()`; mirror `lib/types.ts` app; test round-trip (cegah silent strip).
  - **UI:** chip tanggal di task card dengan warna mengikuti pola Linear (merah = due hari ini/overdue, oranye = ≤7 hari, abu-abu = normal); input tanggal di `TaskModal`/`NewTaskModal`; sort within column by due date.
  - **View:** kalender = **view ke-3 di Board** (`?view=due`) — kolom Overdue · Today · Tomorrow · This Week · Next Week · Later · No date; drag antar kolom = set/ubah `dueDate` (drag native HTML5, precedent kanban) → granular PATCH (realtime + activity gratis via M12/M13.12).
  - **MCP:** `create_task`/`update_task` menerima `dueDate` (ISO `YYYY-MM-DD`).
  - **Phase 2 (M19 P2):** month grid hand-built (ADR-007, tanpa dependency baru; Monday-start, today highlight, nav prev/next/today, toggle week view); klik sel → quick-create dengan dueDate preset; drag chip antar hari → PATCH; drop-zone bawah = hapus dueDate; strip Unscheduled (pola LinCal); diamond milestone di `targetDate`; toggle tampilkan completed; deep-link `?view=due`; public share read-only aman (gate `canEdit`).
  - **Defer:** natural-language date parsing (Todoist-style), recurring dates, filter engine, shortcut per-item (`Shift+D`), dependensi reschedule otomatis (ClickUp-style).
- **Consequences:** Positive — tanpa tab baru (audit A1); primitif `dueDate` membuka sort/filter/stats masa depan; view di Board konsisten dengan pola Plane layouts dan workflow keyboard-first; PATCH granular → realtime/presence/activity tanpa kerja ekstra. Negative — task lama tanpa dueDate memerlukan kolom "No date" yang tetap tampil; kalender bulan + drag = kompleksitas baru di BoardPage (dibatasi phase 2); chip warna perlu kontras a11y (WCAG AA).
- **Alternatives:** Tab ke-12 Calendar (ditolak: audit A1, tab sudah 11); modal/panel kalender terpisah (ditolak: kurang discoverable); library kalender react-big-calendar/FullCalendar (ditolak: policy no new runtime deps, ADR-007 — bundle besar, data model milik library); natural-language parser (ditolak: overkill untuk solo dev + jalur AI sudah via MCP).

---

### ADR-029
**Start date pada task (mirror pola `dueDate` M19)**

- **Status:** Accepted (2026-08-17) — M20 v0.15.0
- **Context:** Setelah M19 menambahkan `dueDate`, task belum punya `startDate` — gap untuk timeline kerja (kapan pekerjaan mulai vs kapan harus selesai). Riset platform M19 (Linear/Plane/Todoist/Height) menunjukkan start date sebagai primitif standar task. Tidak ada view/tab baru — cukup field + chip.
- **Decision:**
  - **Schema (zod, state JSONB — tanpa migrasi DB, backward-compatible, precedent ADR-028):** `taskSchema` + `startDate: isoDate.nullable().optional()`; mirror `lib/types.ts` app; round-trip test (cegah silent strip).
  - **MCP:** `create_task`/`update_task` menerima `startDate` (ISO `YYYY-MM-DD`, `null` untuk clear).
  - **UI:** input type=date di `TaskModal` (edit + `DetailRow` read-mode) dan `NewTaskModal`; chip neutral `Starts <date>` (class `.task-start`, gaya baseline `.task-due`) di `TaskCard`; label activity `startDate` → "Start date".
  - **Warning (soft, UI-only):** `startAfterDue(startDate, dueDate)` → InlineError "Start date is after the due date." saat start > due. Tanpa block di server (M19 tidak memvalidasi relasi tanggal; hard-block menambah kompleksitas tanpa kebutuhan pengguna).
- **Consequences:** Positive — primitif `startDate` membuka sort/filter/timeline masa depan; konsisten dengan pola M19 (zod-only, granular PATCH → realtime/activity gratis); warning non-blocking tidak menghalangi workflow. Negative — tanpa hard validation, data start > due tetap bisa tersimpan; chip tambahan menambah padatnya card meta (dibatasi satu chip neutral kecil).
- **Alternatives:** Hard-block startDate > dueDate di schema/MCP (ditolak: perlu error handling khusus di semua jalur, bertentangan dengan sifat soft M19); ekstensi view Timeline sekaligus (ditolak: scope M20 = primitif field saja, timeline menyusul); natural-language parsing (ditolak: sudah di-defer ADR-028).

---

### ADR-030
**Sort control per tab — dropdown key + arah, persist URL (`?sort=&dir=`), murni client-side**

- **Status:** Accepted (2026-08-17) — M21 v0.16.0
- **Context:** Seluruh tab list DevHub (board, issues, tests, stack, schema, decisions, releases, api, whiteboard) menampilkan urutan yang tidak terkontrol: sebagian state-array order (insertion order dari provider), sebagian comparator hardcoded inline (`.sort()` per page). Tidak ada satupun sort UI di app (audit grep: nol pemakaian ikon sort/funnel). Pengguna tidak bisa mengubah urutan — mis. issue by severity, task by priority di kolom kanban, endpoint by name. M19/M20 menambahkan primitif tanggal (`dueDate`, `startDate`) yang belum bisa dijadikan basis sort.
- **Decision:**
  - **Komponen reusable:** `SortControl.tsx` — dropdown (pola popover `PresenceChip`/`SearchableSelect`, tanpa dependency baru, policy ADR-007): trigger ghost button + `ArrowUpDown` + label key aktif + `CaretDown`; menu berisi pilihan key + toggle arah Ascending/Descending; outside-click + Escape + arrow-key nav; `aria-haspopup="menu"` + `aria-expanded`.
  - **Lib testable:** `lib/sort.ts` — comparator helpers (`byString`/`byNumber`/`byDate`/`byPriority`/`bySeverity`/`byStatus`/`byTitle`) + `applySort<T>(items, key, dir, getValue)`; semua `.sort()` hardcoded dipindah ke sini (satu sumber kebenaran urutan).
  - **Persistence:** URL param `?sort=<key>&dir=<asc|desc>` via `setSearchParams(…, {replace:true})` — precedent `?view=` (Board M19) / `?schemaView=` (Schema). Back/forward + share link bekerja; tidak ada state server.
  - **Cakupan 9 tab:** Board (By Status/Milestone: priority, estimate, title, createdAt, dueDate — default none), Issues (severity, status, createdAt, title), Tests (status, name, createdAt), Stack (category, name, status, version), Schema (tables: name, createdAt; versions: appliedAt), Decisions (date, status, title), Releases (targetDate, name, version), API (name, method, path), Whiteboard (updatedAt, name, createdAt). Default setiap tab = urutan eksisting. View By Due (Board) tetap sort `dueDate` asc (semantik bucket).
  - **Skip:** Stats, About, editor Whiteboard (bukan list). Tidak ada perubahan server/schema/zod.
- **Consequences:** Positive — urutan jadi bisa dijelaskan & di-share (URL); pola dropdown reusable mencegah 9 implementasi berbeda; comparator terpusat memudahkan key baru (startDate dari M20 langsung bisa); zero server work (view state murni). Negative — satu kontrol per toolbar menambah padat header list; URL param bertambah (dibersihkan otomatis saat key default); sort per-kolom kanban hanya memengaruhi urutan dalam kolom, bukan antar kolom (di luar scope).
- **Alternatives:** Segmented toggle asc/desc terpisah + menu key (ditolak: dua klik lebih banyak, dua kontrol per toolbar); localStorage (ditolak: tidak shareable, tidak konsisten dengan precedent `?view=`/`?schemaView=`); server-side sort param (ditolak: state JSONB sudah dimuat penuh client-side, sort server menambah round-trip tanpa manfaat); library sort/table (ditolak: policy no new runtime deps, ADR-007).

---

### ADR-031
**Completion-aware overdue — field `completedAt` + chip `Done on time` / `Done late Nd`**

- **Status:** Accepted (2026-08-17) — M22 v0.16.1
- **Context:** `dueBucket`/`dueLabel` (M19) murni berbasis tanggal: task berstatus `done` yang jatuh tempo sudah lewat tetap menampilkan "Overdue Nd" ber-tone danger — salah sinyal (pekerjaan selesai, tidak ada aksi lagi), dan task yang selesai tepat waktu tidak mendapat penanda apa pun. Untuk membedakan "selesai tepat waktu vs telat" dibutuhkan timestamp penyelesaian; `updatedAt` tidak bisa diandalkan (berubah pada edit apa pun setelah done). `completedAt` adalah primitif standar (Linear/Asana/Todoist mencatat completion time).
- **Decision:**
  - **Schema (zod, state JSONB — tanpa migrasi DB, precedent ADR-028/ADR-029):** `taskSchema` + `completedAt: isoDate.nullable().optional()`; mirror `lib/types.ts`; round-trip test.
  - **Derivasi otomatis (bukan manual):** choke point reducer app (`task/update`) dan jalur MCP (`update_task`/`create_task`): status → `done` tanpa `completedAt` eksplisit → set `nowIso()`; status keluar `done` → `null`. Satu sumber kebenaran, semua jalur UI (modal, drag, arrow-key) konsisten tanpa perubahan per-situs.
  - **Label & tone:** chip task sadar status via `taskDueChip(task)` — `Done on time` (success) bila `completedAt ≤ dueDate`; `Done late Nd` (warn, `completedAt` date − `dueDate` date, **fixed** tidak bertambah) bila `completedAt > dueDate`; task aktif tidak berubah (`Overdue Nd` danger, `Due …`). N = 0 saat sama hari → on time.
  - **View By Due Date & bucket eksisting tidak berubah:** done-late tetap di kolom Overdue (chip warn), done-on-time tetap di kolom tanggalnya (chip success) — tanpa perubahan struktur view.
- **Consequences:** Positive — sinyal overdue akurat per status (done-late warn bukan danger); primitif `completedAt` membuka filter/stat "selesai tepat waktu vs telat" di masa depan; derivasi terpusat menjamin konsistensi UI/MCP. Negative — satu field lagi di task schema (backward-compatible, nullable); pengguna yang mengedit task setelah done tidak menggeser label late (completedAt tetap, sesuai semantik "kapan selesai"); tanpa completedAt (task lama) label fallback ke perilaku aktif berbasis `dueDate` vs hari ini.
- **Alternatives:** Tanpa schema change — `done` + `dueDate` vs hari ini (ditolak: task on-time yang selesai beberapa hari lalu salah label "late"); `updatedAt` sebagai proxy completion (ditolak: berubah oleh edit lain); kolom terpisah "Done late" di view By Due (ditolak: perubahan struktur view tanpa manfaat, chip warn sudah cukup); hard-block dueDate sebelum completedAt (ditolak: tidak perlu, label sudah mengkomunikasikan).

---

### ADR-032
**Pinned items — shared server-side field `pinned`**

- **Status:** Accepted (2026-08-18) — M13.7 v0.13.7 (keputusan DevHub `293c719d`, 2026-08-16)
- **Context:** Pengguna ingin menandai item penting agar mengapung ke atas list/kolom. Alternatif per-user (localStorage) membuat pin tidak terlihat rekan satu tim dan tidak sinkron lintas perangkat; pendekatan server-side memanfaatkan infrastruktur yang sudah ada.
- **Decision:**
  - **Schema (zod, state JSONB — tanpa migrasi DB, precedent ADR-028/029/031):** `pinned: z.boolean().default(false)` di task/issue/testCase/decision schema; mirror `lib/types.ts`; entity lama parse `false`.
  - **PATCH normal:** pin/unpin adalah update entity biasa → `entity-router` + `broadcastDiff` realtime + activity log gratis, tanpa jalur khusus.
  - **MCP parity (ADR-027):** `create_task`/`update_task`/`add_issue`/`update_issue`/`add_test_case`/`update_test_case`/`add_decision` menerima `pinned`.
  - **UI:** `PinButton` (icon `PushPin`, `aria-pressed`, `stopPropagation`) di task card (Board) dan `.data-row-side` (Issues/Tests/Decisions); pinned-first **stable** sort via `applySort(items, spec, dir, pinnedFirst?)` (M21) — berlaku juga saat tanpa sort spec; dalam grup pinned urutan mengikuti spec/urutan eksisting.
- **Consequences:** Positive — satu field shared, semua member melihat pin yang sama; sinkron lintas perangkat via PATCH yang sudah ada; rapid toggle ter-cluster di activity log; kompatibel dengan SortControl M21. Negative — member lain bisa mem-pin/unpin item (sesuai desain kolaboratif, gate `canEdit` tetap berlaku); tanpa UI dedikasi untuk "unpin semua" (defer); icon hover-reveal di task card kurang discoverable untuk pengguna baru (dikompensasi aria-label + title).
- **Alternatives:** Per-user pins di localStorage (ditolak: invisible ke rekan tim, tidak sinkron perangkat); field `pinnedAt` timestamp (ditolak: boolean cukup, urutan antar-pinned tidak perlu presisi); pinned per-entity terpisah non-shared (ditolak: kompleksitas tanpa manfaat).

---

### ADR-033
**Gabung tab Stats + About → satu tab "Overview" (11 tab → 10)**

- **Status:** Accepted (2026-08-18) — M23 v0.16.2
- **Context:** Stats (chart/kpi) dan About (deskripsi, counter, PRD) adalah dua tab kecil dengan konten tumpang tindih (open issues, milestones, task totals muncul di keduanya). Audit A1 membatasi jumlah tab; 11 tab sudah di batas. Pengguna harus pindah tab untuk melihat "sehat vs kenapa proyek ini ada" — keduanya bagian dari satu pertanyaan "overview proyek". Riset desain (UI Designer pass) menyimpulkan struktur terbaik: identity → size → health → narrative.
- **Decision:**
  - **Satu tab `overview`** (label "Overview", icon `Gauge` — phosphor, diverifikasi tersedia) menggantikan `stats` + `about` di ProjectPage. `StatsPage.tsx`/`AboutPage.tsx` dihapus; `OverviewPage.tsx` baru di `features/overview/`.
  - **Legacy redirect:** `?tab=stats` dan `?tab=about` dipetakan ke `overview` (URL bookmark/shared tidak 404).
  - **Struktur:** header (Edit PRD, gate `canEdit`) → hero (description + meta chips, reuse `.about-hero`) → 8 counter tile **terdedupe** (Tasks `done/total`, Open issues, Outdated deps, Test cases, Stack, Tables, Decisions, Milestones `released/total`) → group **Charts** (donut status + bars priority/severity/hours, `stat-note` next milestone) → group **Product brief** (5 PRD cards). Zona dipisah hairline divider `.overview-group` (~10 baris CSS baru); heading h2 per group, h3 per card (hierarki a11y).
  - **Empty state baru:** chart zone → `EmptyState` "Nothing to chart yet" bila tasks & issues kosong; counter 0 = data, PRD kosong tetap "Not set yet."
  - **Public share TIDAK mendapat charts:** tab publik tetap id `'about'` (PublicTab), label "Overview" + Gauge; konten publik tetap counters + PRD (telemetry internal — outdated deps/hours — tidak diekspos; bundle publik tanpa SVG chart).
  - **Tab count 11 → 10** (audit A1: deviasi whiteboard tetap satu-satunya).
- **Consequences:** Positive — satu tempat untuk "status + alasan" proyek; dedupe konten; tab lebih sedikit (A1); URL lama tetap jalan via redirect; public surface tidak berubah kontennya. Negative — `?tab=stats/about` lama tidak lagi mengaktifkan tab terpisah (redirect ke overview); peta shortcut Alt+digit bergeser (Alt+9 = Overview, Alt+0 = Whiteboard); pengguna yang mencari label "Stats"/"About" harus belajar label baru.
- **Alternatives:** Pertahankan 2 tab (ditolak: 11 tab di batas A1, konten tumpang tindih); merge ke "About" tanpa rename (ditolak: label "About" menyembunyikan statistik — pengguna pencari Stats tidak menemukan apa pun); public ikut charts (ditolak: telemetry internal + beban a11y di surface publik); layout bento asimetris (ditolak: grid existing `auto-fit` sudah cukup, tanpa CSS baru yang signifikan).

---

### ADR-036
**Envelope respons API: resource tunggal bare, koleksi dibungkus (unifikasi ditunda ke v2)**

- **Status:** Accepted (2026-08-19) - audit 2026-08b, REST-1
- **Context:** Audit menemukan envelope respons tidak konsisten antar route: resource tunggal kadang bare (`GET/POST/PATCH /projects`, `GET /auth/me`, `POST /keys`), kadang dibungkus (`{team}`, `{template}`). Koleksi sudah konsisten dibungkus (`{projects}`, `{teams}`, `{keys}`, `{messages}`). Integrator tidak bisa menebak bentuk tanpa membaca per-endpoint. Perubahan bentuk respons = breaking change untuk semua client (app + MCP + agent eksternal).
- **Decision:**
  - Konvensi eksplisit: **resource tunggal = bare object, koleksi = dibungkus** (dokumentasikan di ADR ini sebagai kontrak saat ini).
  - Unifikasi (semua resource tunggal dibungkus `{project}`/`{user}`/`{key}`) **ditunda ke v2** - perubahan breaking dijadwalkan bersama deprecation PUT /state (ADR-022) dan diberi header deprecation.
  - Error shape tetap seragam: `{ error: { code, message, details? } }` (sudah konsisten).
- **Consequences:** Positive - kontrak sekarang terdokumentasi, klien baru tidak menebak; tidak ada churn breaking sekarang. Negative - inkonsistensi tetap ada sampai v2; konvensi ganda harus dijaga di code review.
- **Alternatives:** Langsung unifikasi semua route (ditolak: breaking tanpa jalur migrasi); dokumentasi OpenAPI penuh (ditolak: ADR-022/audit menghapus OpenAPI docs - keputusan user).

---

### ADR-037
**Scope MCP: read/append-only, transport stateless POST-only, truncation project_state**

- **Status:** Accepted (2026-08-19) - audit 2026-08b, MCP-5/MCP-6/MCP-7
- **Context:** Permukaan tool MCP asimetris vs REST (tidak ada delete task/issue/decision, tidak ada update_decision/update_table); GET /mcp mengembalikan 404 (Streamable HTTP spec mengharapkan SSE atau 405); project_state mengembalikan seluruh koleksi tanpa batas (boros token untuk project besar).
- **Decision:**
  - **Scope MCP = read/append-only** (satu-satunya tool destructive: `delete_relation` untuk perbaikan skema). Agent yang membuat kesalahan memperbaikinya via update tool; tool delete task/issue/decision ditunda sampai ada kebutuhan nyata (dokumentasi resmi: docs/03-engineering/mcp-integration.md).
  - **Transport stateless POST-only**: GET /mcp menjawab `405 + Allow: POST` (bukan 404). SSE tidak didukung - instance server per-request dengan `close()` di finally; keamanan lebih sederhana (tanpa session server-side), cocok dengan beban tool-call saat ini.
  - **project_state default `limit: 200` per koleksi** (`limit: 0` = semua; `counts` selalu mencerminkan state penuh).
- **Consequences:** Positive - permukaan MCP dapat dijelaskan dan diaudit; diagnostik klien tidak menyesatkan; token cost project_state terkendali. Negative - agent tidak bisa menghapus entity (bila dibutuhkan, tambah tool delete + test); klien berbasis SSE tidak kompatibel.
- **Alternatives:** Menambah 6 tool delete + update_decision/update_table (ditolak: scope creep, setiap tool butuh test + dokumentasi; belum ada permintaan); mendukung SSE (ditolak: kompleksitas session state tanpa manfaat untuk agent tool-call); project_state selalu full (ditolak: ratusan KB JSON per panggilan).

---

### ADR-038
**Pengecualian produk: viewer boleh menulis chat; fail-closed public sharing; strip unknown fields**

- **Status:** Accepted (2026-08-19) - audit 2026-08b, AUTHZ-1/PUB-2/REST-7
- **Context:** Tiga temuan audit yang diselesaikan sebagai keputusan produk/dokumentasi, bukan perubahan kode:
  - AUTHZ-1: viewer bisa menulis chat team (HTTP + WS) padahal model role menyatakan "viewer read-only".
  - PUB-2: default `public_tabs` fail-open (6 tab publik saat tidak di-set) + `normalizeTabs` parse-error -> semua tab publik.
  - REST-7: unknown fields pada state PUT di-strip diam-diam oleh zod (tanpa error).
- **Decision:**
  - **Viewer boleh menulis chat** - chat dianggap kanal sosial, bukan project state; pengecualian didokumentasikan di matriks role (docs/02-architecture/team-collaboration-design.md). Akses tulis lain (state, PRD, template, keys) tetap diblokir untuk viewer.
  - **Public sharing fail-closed**: `normalizeTabs` mengembalikan `[]` untuk nilai invalid; default kolom `public_tabs` diubah ke `[]` (migrasi 015); proyek yang di-publish tanpa `publicTabs` eksplisit tidak menampilkan tab apa pun sampai admin memilihnya via ShareModal.
  - **Unknown fields di-strip** - perilaku zod `z.object` default dipertahankan dan didokumentasikan sebagai kontrak (bukan di-refactor ke `.strict()`; forward-compat klien lebih penting). PRD publik digate di belakang tab `about` (PUB-1).
- **Consequences:** Positive - satu kesalahan konfigurasi sharing tidak lagi membuka semua data; perilaku strip tidak lagi kejutan; chat tetap ramah untuk kontributor ringan. Negative - admin harus eksplisit memilih tab publik (satu langkah lagi di ShareModal - UX dikompensasi default yang jelas); proyek lama yang di-publish tanpa tabs menjadi "kosong" sampai ShareModal diisi.
- **Alternatives:** Blokir viewer di chat (ditolak user 2026-08-19: chat sosial, bukan state); mempertahankan fail-open (ditolak: eksposur data); `.strict()` pada jalur tulis (ditolak: memecah forward-compat klien offline-first, ADR-009).

---

### ADR-039
**User stats endpoint: `GET /auth/me/stats` — agregasi per-user dari `activity_log`**

- **Status:** Accepted (2026-08-20) - M27
- **Context:** Profil butuh statistik gaya GitHub (total kontribusi, contribution heatmap 365 hari, tasks completed, issues resolved, streaks). Entity di `projects.data` punya `authorId` namun **client-supplied dan selalu null** — server tidak men-stamp-nya (entity-router dan MCP tidak mengirim), jadi tidak bisa dipakai untuk hitungan per-user. Satu-satunya jejak per-user yang dicap server adalah `activity_log.author_id` (+ `author_name`), dicatat untuk semua REST create/update/delete dan MCP saveState.
- **Decision:**
  - Endpoint baru `GET /api/v1/auth/me/stats` (auth-required, bare object per ADR-036) di `auth.routes.ts`, dihitung `lib/user-stats.ts`.
  - Daily counts 365 hari (zero-filled via `generate_series`); `totalContributions` = jumlah window, `activeDays`, `currentStreak` (run berakhir hari ini; bila hari ini kosong mundur ke kemarin), `longestStreak`.
  - `taskCompletions` = `entity='tasks' AND action='updated' AND changes @> '{"status":{"to":"done"}}'`; `issuesResolved` analog dengan status `resolved`. Menangkap transisi status dari activity — akurat untuk "kamu menyelesaikan N task", bukan status akhir.
  - Index baru migrasi 017 `(author_id, created_at DESC)` untuk performa agregasi.
- **Consequences:** Positive - statistik berbasis jejak server-authoritative, konsisten untuk REST + MCP, tanpa field baru di `projects.data`. Negative - angka dibatasi pruning activity (500/project, 50/entity) dan cluster-merge per menit → mencerminkan aktivitas terbaru, bukan audit all-time; heatmap tidak mencakup periode sebelum fitur activity (migrasi 011) atau sebelum user bergabung.
- **Alternatives:** Menghitung dari `authorId` di `projects.data` (ditolak: tidak dapat diandalkan, null di semua jalur); scan `projects.data` per assignee untuk "tasks done by me" (ditolak: atribusi ke assignee ≠ kontributor, butuh scan semua project); loop `fetchActivity` per-project × N (ditolak: N request, limit 100/item, tidak scalable).

---

### ADR-040
**Route-level code splitting + per-route contentful skeletons**

- **Status:** Accepted (2026-08-20) - M28 v0.21.1
- **Context:** Entry bundle `index-*.js` 558 kB raw / 148 kB gz — di atas budget ~200 kB gz first-paint. Semua halaman top-level (Dashboard, Keys, Profile, Docs, McpDocs, Team, Invites, Templates, Project, PublicProject) + CommandPalette diimpor statis di `App.tsx`; ~96 modul ikon @phosphor-icons ikut di entry. `@phosphor-icons/react@2.1.10` tidak menyediakan subpath per-weight (`dist/csr/*` selalu membawa 6 weight), jadi optimasi per-icon tidak mungkin tanpa dependency baru.
- **Decision:**
  - **Route-level `React.lazy`** untuk 10 halaman top-level + CommandPalette, masing-masing dibungkus `<Suspense>` dengan fallback skeleton yang meniru layout halaman asli (`PageSkeletons.tsx`), memakai CSS class existing + `.skeleton-btn`/`.skeleton-tab`/`.skeleton-avatar` baru.
  - `AuthPage` + `Layout`/`Sidebar` tetap eager (login = first paint); `Splash` hanya untuk auth bootstrap.
  - Skeleton container `role="status"` + `aria-busy`; blok dekoratif `aria-hidden`.
  - Duplikasi kecil antara `PageSkeletons` dan `TabSkeleton` ProjectPage **disengaja** — mengimpor TabSkeleton ke App.tsx akan menarik chunk ProjectPage ke entry.
- **Consequences:** Positive - entry 558 → 263 kB raw (148 → 80 kB gz); tiap halaman + ikonnya pindah ke chunk sendiri; ikon ter-dedupe ke shared chunk per-icon (CaretDown.es, ArrowLeft.es, …); first-load jauh di bawah budget. Negative - flash skeleton singkat saat chunk pertama dimuat (sekali saja; selanjutnya di-cache + service worker); skeleton ~10 komponen kecil harus dirawat agar tidak ketinggalan layout halaman.
- **Alternatives:** Refactor import ikon ke per-weight (ditolak: versi paket tidak mendukung subpath); `manualChunks` vendor react/react-router (ditunda: hanya caching, tidak mengecilkan first-paint); `unplugin-icons` + `phosphor-src` (ditolak: dependency baru + API `<Icon name>` berbeda dari named imports eksisting).

---

### ADR-041
**Server modular monolith: struktur DDD per bounded context (`modules/<domain>`)**

- **Status:** Accepted (2026-08-21)
- **Context:** Struktur `server/src/` sejak V1 disusun layered-by-technology (`api/`, `auth/`, `db/`, `lib/`, `mcp/`, `realtime/`, `schema/`). Audit internal saat riset struktur menemukan empat masalah: (1) **`lib/` grab-bag** — service domain (`activity`, `chat`, `search`, `user-stats`) bercampur utility murni (`ids`, `logger`), tidak ada sinyal kepemilikan; (2) **business logic tersebar di route files dengan SQL inline** — `projects.routes.ts` 394 baris, `teams.routes.ts` 381, `entity-router.ts` 357, sulit dites terpisah dan duplikat (blok transaksi activity terduplikasi di PUT /state dan import); (3) **circular dependency** `lib/db.ts → app.ts` dan `requireAuth → app.ts` (ApiError + SESSION_COOKIE hidup di app.ts); (4) **tanpa boundary modul** — semua file bebas mengimpor semua. Riset praktik big tech untuk backend: monorepo Google/Meta dikelompokkan per domain bisnis dengan OWNERS per folder; Shopify memeluk modular monolith (Rails engines + Packwerk untuk boundary dependency); konvensi Nx (`apps/`+`libs/`) menyarankan grouping by business scope, bukan technical type; DDD/hexagonal menuntut domain murni tanpa dependensi framework.
- **Decision:**
  - Restrukturisasi penuh ke **modular monolith per bounded context**: `server/src/modules/<domain>/{handlers,application,domain,infrastructure}` untuk 11 modul (auth, authorization, projects, teams, activity, search, keys, templates, public, mcp, realtime).
  - **Aturan dependency:** `handlers → application → domain ← infrastructure`. Domain murni (zod + fungsi murni, tanpa express/pg). `shared/` (errors, http, db, ids, logger) boleh diimpor siapa saja; antar-modul hanya melalui domain/application publiknya.
  - **ApiError + SESSION_COOKIE keluar dari `app.ts`** → `shared/errors.ts` + `shared/http.ts`; circular dep putus. `getUserEmail` pindah ke modul authorization.
  - **Tiga file besar dipecah:** `projects.routes.ts` → `infrastructure/projectRepository.ts` (SQL) + `application/projectService.ts` (orkestrasi) + handler tipis; `entity-router.ts` → `domain/entities.ts` (config entity murni) + `application/entityService.ts` (`mutateProject` transaksional) + handler tipis; `teams.routes.ts` → `teamRepository` + `teamService` + handler tipis. Handler kini hanya HTTP concern (parse req, status code, header); urutan error dipertahankan (404→403→400 — validasi body pindah ke service setelah auth check).
  - **Dedup:** blok transaksi activity (BEGIN → insertActivity per draft → pruneActivity → COMMIT) yang terduplikasi di PUT /state dan import diekstrak jadi `recordActivity()` di modul activity.
  - `db/migrations/` tidak berubah (postbuild.mjs aman); 25 tool MCP direlokasi utuh sebagai use cases (`modules/mcp/application/tools/`).
- **Consequences:** Positive — kepemilikan kode jelas per domain (siap CODEOWNERS per folder ala big tech); business logic terpisah dari HTTP sehingga bisa dites tanpa supertest; duplikasi hilang; boundary siap ekstraksi microservice bila suatu saat dibutuhkan; navigasi cepat ("cari logika team? modules/teams"). Negative — diff besar sekali jalan (56 file rename + ~60 file import rewrite); path di dokumen historis roadmap §8–24 tidak lagi akurat (dicatat, tidak diedit); developer baru harus paham aturan dependency layer.
- **Alternatives:** Pertahankan struktur layered + rapikan `lib/` saja (ditolak: tidak menyelesaikan SQL-inline dan tersebarnya logic); repository pattern penuh dengan interface + impl per entity (ditolak: boilerplate tanpa manfaat — codebase langsung pakai pg pool, satu implementasi); ekstraksi microservice sekarang (ditolak: skala belum membutuhkan; modular monolith adalah titik tengah yang bisa diekstrak nanti).
