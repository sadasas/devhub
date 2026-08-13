# Architecture Decision Record (ADR) Log — DevHub

| Field | Value |
|---|---|
| **Document status** | Active (living document) |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-12 |

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

---

*End of ADR Log. New decisions append below; existing entries never edited.*
