# Technical Design Document (TDD) — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Version** | 1.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-09-24 |
| **Related documents** | [PRD](../01-project/prd.md) · [ADR Log](adr.md) · [Security Design](security-design.md) · [MCP Guide](../03-engineering/mcp-integration.md) |

---

## 1. Introduction

### 1.1 Purpose

This document specifies the technical architecture for DevHub V1: system context, components, data model, API design, authentication, AI agent (MCP) integration, and future-proofing strategy.

### 1.2 Design Goals

| Goal | Priority | Rationale |
|---|---|---|
| Zero external UI dependencies (except one icon family) | High | Long-term maintainability; small bundle |
| Future-proof for collaboration (Phase 3) | High | Avoids rewrite; Base fields + provider boundary |
| AI agent operability via MCP | High | Locked product decision (Phase 0) |
| Simple, boring, reliable stack | High | Solo maintainer |
| Portable data | Medium | Export/import + documented backups |

---

## 2. System Context (C4 Level 1)

```
                     ┌──────────────────────────────┐
 Engineering Team ─► │  DevHub Web App              │
 (browser, solo →    │  Vite + React + TS (app/)    │
  large org)         └──────────────┬───────────────┘
                                    │ HTTPS /api
                                    │ (fetch, credentials: include)
                     ┌──────────────▼───────────────┐
                     │  DevHub API Server           │
    AI Agent  ─────► │  Node + Express (server/)    │
    (opencode,       │  • auth  • projects  • state  │
     Claude...)      │  • export/import • MCP (OAuth)│
                     └──────────────┬───────────────┘
                                    │ pg
                     ┌──────────────▼───────────────┐
                     │  PostgreSQL                   │
                     │  users · projects (JSONB)     │
                     └──────────────────────────────┘
```

**Actors:**
- **Engineering Team (human):** solo builder to large org (2 → 2,000 engineers); registers, logs in, manages projects across teams; complementary technical-memory layer to Jira/Linear.
- **AI Agent (machine):** connects to the MCP endpoint via OAuth 2.1 PKCE bearer token; reads/updates project state.

**Design note:** The AI agent does **not** read the database or files directly — it only uses MCP tools. This was a locked decision (ADR-003) to keep the data boundary clear.

---

## 3. Components (C4 Level 2)

### 3.1 Web App (`app/`)

| Component | Responsibility |
|---|---|
| `ApiProvider` | All server communication via `fetch` with `credentials: include`; JSON body; central error handling. Replaces the original StorageProvider concept — the only "provider" the UI talks to |
| `Store` | React Context + `useReducer` holding the current project state; optimistic updates where useful |
| `AuthPages` | Register / login / logout flows |
| `Layout` | Sidebar + content shell |
| `Dashboard` | Project cards: progress, open issues, outdated deps, nearest milestone |
| Feature tabs | `Board` (incl. `?view=due` calendar), `Issues`, `TestCases`, `Stack`, `Schema` (with ERD), `Decisions`, `Releases`, `API` (collections + endpoints, OpenAPI import/export), `Whiteboard` (ShapeLibrary 100 geometri/8 tab + FigJam panel + embed SVG), `Overview` (ex-Stats+About), `Templates`, `Billing`, `Integrations` (GitHub App + GCal) |
| `RowMenu` | Kebab standar ≤640px untuk Issues/Decisions/Tests/Releases/Whiteboard/Labels/Templates (`stopPropagation` fix); TemplatesPage icon-only + kebab |
| `i18n` | `i18next` + `react-i18next`, 6 ns (`common/shell/account/tracker/project/extras`), `defaultNS: common`, `LANG_STORAGE_KEY` (addendum ADR-046, overhaul P0+P1) |
| `Upload` | `tus-js-client` jalur utama TUS (chunk 6MB, `x-signature` + `x-upsert`, metadata `bucket/object`) + fallback PUT + `isUploadAuthError`; service-key tak ke browser |
| `SearchableSelect` | Mount-emit fix + test regresi; dipakai assignee/label/filter select |
| `CommandPalette` | Ctrl+K global command palette + keyboard shortcuts + create actions (deep-link `?tab=X&new=1`) |
| `components/` | Design-system primitives: Button, Input, Badge, Modal, Skeleton, EmptyState, Toast |
| `styles/` | `tokens.css` (CSS variables), `global.css` |

**Design constraints (locked):**
- Runtime UI deps: `@phosphor-icons/react`, `react-router` v7 (ADR-016), `i18next`/`react-i18next` (ADR-046/056), `yaml` (ADR-019 OpenAPI), `tus-js-client` (ADR-055 upload). Klaim zero-dep (ADR-007) sudah superseded.
- Kanban drag & drop: native HTML5 DnD (no library).
- Charts: hand-built SVG components.
- Light/Dark theme via `html[data-theme]` (ADR-047); whiteboard/ERD export theme-aware; canvas teks via `truncateToWidth`.
- Mobile: `RowMenu` kebab ≤640px; `LabelsSection` wrap + kebab mobile; drawer settings mobile (`Layout`/`Sidebar`); `project-card-title` `display:block`; grid `minmax`.

### 3.2 API Server (`server/`)

Backend disusun sebagai **modular monolith** ala big tech: kode dikelompokkan per bounded context (`modules/<domain>`), bukan per lapisan teknis. Setiap modul berlapis DDD:

```
server/src/
├── index.ts / app.ts / config.ts     # composition root (middleware, mount router)
├── shared/                           # cross-cutting tanpa business logic
│   ├── errors.ts                     #   ApiError
│   ├── http.ts                       #   SESSION_COOKIE
│   ├── db.ts                         #   withTransaction, parseOrThrow
│   ├── ids.ts                        #   newId, nowIso
│   └── logger.ts
├── db/                               # pg Pool + migrations/*.sql
└── modules/
    ├── auth/            # handlers/ · application/user-stats · infrastructure/jwt+password · middleware/
    ├── oauth/           # handlers/oauth.routes (DCR, authorize, token, revoke, discovery RFC8414/9728)
    ├── authorization/   # application/authz (role checks, dipakai lintas modul)
    ├── projects/        # handlers/(routes+v1/entity-router) · application/(projectService, entityService) · domain/(state, prd, sharing, hours, entities) · infrastructure/projectRepository
    ├── teams/           # handlers/(teams+chat) · application/(teamService, chat) · domain/chat · infrastructure/teamRepository
    ├── activity/        # handlers/v1/activity · application/activity (+recordActivity)
    ├── search/          # handlers/v1/search · application/search
    ├── templates/       # handlers/templates
    ├── public/          # handlers/public
    ├── mcp/             # handlers/(server, require-key) · application/(state-db, context, tools/*) · domain/entity
    └── realtime/        # handlers/ws-server · infrastructure/(rooms, broadcast)
```

**Aturan dependency:** `handlers → application → domain ← infrastructure`. Domain murni (zod + fungsi murni, tanpa express/pg). `shared/` boleh diimpor siapa saja; antar-modul hanya lewat domain/application publiknya.

| Component | Responsibility |
|---|---|
| `modules/auth` | register / login / logout; JWT issuance; httpOnly cookie management; social linking (`oauth_accounts`) |
| `modules/oauth` | OAuth 2.1 Authorization Server for MCP: DCR, PKCE authorize, token (code + refresh rotation), revoke, discovery, authorized-apps |
| `modules/projects` | CRUD project, state JSONB (GET/PUT), export/import, granular entity v1 |
| `modules/teams` | CRUD team, member & role management, invitations, team chat |
| `modules/mcp` | Model Context Protocol server (streamable HTTP) + tool implementations (OAuth bearer `scope mcp`/`mcp:read`/`mcp:write`) |
| `modules/realtime` | WebSocket server, room registry, broadcast diff/activity/sync |
| `modules/activity` | activity log: diff state → entries, prune, stats feed |
| `modules/search` | cross-entity search dalam satu project |
| `shared/` | ApiError, db helpers, logger, id util — tanpa business logic |
| `db` | pg Pool + migrations (users, teams, projects, invitations, oauth_clients/authorization_codes/access_tokens, activity_log, team_messages) |

### 3.3 Database (PostgreSQL)

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Accounts | id (UUID PK), email (unique), password_hash, created_at, updated_at |
| `teams` | Collaboration workspaces | id (UUID PK), name, created_by (FK → users), created_at, updated_at |
| `team_members` | Team membership + role | team_id (FK → teams), user_id (FK → users), role (owner/admin/editor/viewer), joined_at, PK (team_id, user_id) |
| `projects` | Team-scoped projects | id (UUID PK), team_id (FK → teams, NOT NULL), name, description, status, data (JSONB), created_at, updated_at |
| `invitations` | Invite flow (email-only, registered users) | id (UUID PK), team_id (FK → teams), email, role, token (UUID, unique), status (pending/accepted/declined), expires_at (7-day TTL), created_by (FK → users), created_at |
| `oauth_clients` | OAuth DCR public clients | client_id (PK), redirect_uris (text[]), client_name, client_uri, created_at |
| `oauth_authorization_codes` | PKCE authorization codes | code (PK), client_id (FK), user_id (FK → users), redirect_uri, scope, code_challenge, code_challenge_method, resource, expires_at, used_at |
| `oauth_access_tokens` | Bearer tokens (rotation) | token (PK), client_id (FK), user_id (FK → users), scope, resource, expires_at, refresh_token (unique), refresh_expires_at, created_at |
| `activity_log` | Per-entity activity (REST + MCP parity) | project_id, entity, entity_id, action, changes, author_id, created_at; prune 500/project, 50/entity |
| `team_messages` | Team chat (viewer boleh tulis, ADR-038) | id, team_id, author_id, body, created_at |
| `billing_packages` / `billing_package_prices` | Paket dinamis DB-driven + Free kelolaan admin (grandfathered bila nonaktif) | package (max_members/max_projects NULL=unlimited), prices (duration_days+price_idr) |
| `team_payments` | Pakasir payments | order_id UNIQUE, team_id, package snapshot, period, amount, status |
| `github_installations` / `github_project_repos` / `github_webhook_events` / `github_outbox` | GitHub App (ADR-052): install, 1 repo/project, idempotency delivery_id, retry 1m/5m/30m | token sealed AES-256-GCM |
| `gcal_*` (`tokens` vault + `outbox`) | GCal (ADR-059, tandingan ADR-052): vault AES-256-GCM, outbox 1m/5m/30m, sync-service, scope `calendar` |

**Why JSONB?** See ADR-002. The 10-entity state model is a single JSON document per project. Indexed fields: `team_id` (projects), `user_id` (team_members), `email`+`status` (invitations).

**Migrations:** sequential SQL files in `server/src/db/migrations/`, applied via `npm run db:migrate`. Schema version recorded in a `schema_migrations` table.

---

## 4. Data Model (Project State)

All entities extend `Base`:

```ts
interface Base {
  id: string;              // UUID v4
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601 — enables last-write-wins merge in Phase 3
  authorId?: string;       // user id (self = own id)
}
```

| Entity | Fields |
|---|---|
| `Project` | name, description, status, createdAt |
| `Task` | title, status (Todo/In Progress/Review/Done), priority, estimate (h), actualHours (h), labels: string[], blockedBy: taskId[], `dueDate?`, `startDate?`, `completedAt?` (auto-derive), `pinned`, `parentTaskId?` (subtask 1-level), `githubLinks[]` (max 20, dedupe repo+kind+ref, `ciState`/`reviewState`) |
| `Issue` | title, severity (Critical/High/Med/Low), status (Open/Reproduced/Fixing/Resolved/Won't fix), reproduction, linkedTaskId?, `fixPr?`, `pinned` |
| `TestCase` | taskId? / issueId?, name, steps, expected, status (Pass/Fail/Pending), `pinned` |
| `TechEntry` | name, version, category (Frontend/Backend/DB/Tooling), status (Current/Update available/Major upgrade), notes |
| `Table` | name, comment, columns: Column[], indexes: string[] |
| `Column` | name, type, nullable, primaryKey, default, comment |
| `Relation` | fromTableId+fromColumnId, toTableId+toColumnId, cardinality ('1:1'/'1:N'/'N:M'), onDelete (CASCADE/SET NULL/RESTRICT) |
| `SchemaVersion` | version, appliedAt, notes |
| `Decision` | title, status (Proposed/Accepted/Rejected/Superseded), context, options: string[], decision, consequences, date, `pinned` |
| `Milestone` | name, version?, targetDate, status (Planned/In Progress/Released), changelog? |
| `ApiCollection` | name ≤200, description ≤2k |
| `ApiEndpoint` | collectionId?, method (GET/POST/PUT/PATCH/DELETE/OPTIONS), path ≤500, name ≤200, description ≤10k, headers[], params[] (path/query/header), body ≤50k, responses[] |
| `Whiteboard` | name, elements[] (≤1000/board, ≤5/project): `stroke`/`sticky`/`text` (w? wrap)/`shape` (+cylinder/parallelogram/hexagon/roundedRect)/`edge` (label ≤200, arrowStyle none/open/solid/diamond/circle)/`boundary`/`ref` (multi-entity)/`embed` (SVG AI, ≤20/board); koordinat ±100.000 |

**State shape (per project):**

```jsonc
{
  "tasks": [...],          // dueDate/startDate/completedAt/pinned/parentTaskId/githubLinks
  "issues": [...],         // fixPr/pinned
  "testCases": [...],      // pinned
  "techEntries": [...],
  "tables": [...],         // columns inline per table
  "relations": [...],
  "schemaVersions": [...],
  "decisions": [...],      // pinned
  "milestones": [...],
  "apiCollections": [...],
  "apiEndpoints": [...],
  "whiteboards": [...]     // elements stroke/sticky/text/shape/edge/boundary/ref/embed
}
```

**Integrity rules (validated in zod schema, enforced by reducer):**
- `Task.blockedBy` entries must reference existing task ids; deleting a task removes it from all `blockedBy` arrays.
- `Relation` references must exist; deleting a Table cascades its Relations.
- `TestCase` references a task or an issue (at most one).
- Card ordering in Kanban columns stored as an explicit `order` array per status (or implicit array order in state).

---

## 5. API Design

Base URL: `/api/v1`. All endpoints JSON. Auth via httpOnly cookie `devhub_session`. Granular entity routes via `entity-router.ts` factory (zod reuse, `SELECT ... FOR UPDATE` per-project writer serialization, `ETag: "<version>"` on reads, optional `If-Match: <version>` → `409 CONFLICT` + `details.current.version`); `PUT /state` remains bulk/compat; cascade server-side (delete table → relations, milestone → `task.milestoneId`, task → `issue.linkedTaskId`).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login, set cookie |
| POST | `/api/auth/logout` | Yes | Clear cookie |
| GET | `/api/auth/me` | Yes | Current user info |
| GET | `/api/teams` | Yes | List my teams + my role + member count |
| POST | `/api/teams` | Yes | Create team (creator becomes owner) |
| GET | `/api/teams/invitations` | Yes | List my pending invitations |
| GET | `/api/teams/:teamId` | Yes | Team detail (member) |
| PATCH | `/api/teams/:teamId` | Yes | Rename team (admin+) |
| DELETE | `/api/teams/:teamId` | Yes | Delete team (owner) |
| GET | `/api/teams/:teamId/members` | Yes | List members (member) |
| PATCH | `/api/teams/:teamId/members/:userId` | Yes | Change member role (admin+; owner immutable) |
| DELETE | `/api/teams/:teamId/members/:userId` | Yes | Remove member (admin+, or self-leave; owner immutable) |
| POST | `/api/teams/:teamId/invitations` | Yes | Invite registered user by email (admin+) |
| POST | `/api/teams/:teamId/invitations/:invitationId/accept` | Yes | Accept invite (invitee only, 7-day TTL) |
| DELETE | `/api/teams/:teamId/invitations/:invitationId` | Yes | Decline/revoke invite (invitee or admin+) |
| GET | `/api/projects` | Yes | List projects across my teams (with team + role) |
| POST | `/api/projects` | Yes | Create project (must be member of target team) |
| GET | `/api/projects/:id` | Yes | Project meta |
| PATCH | `/api/projects/:id` | Yes | Update meta |
| DELETE | `/api/projects/:id` | Yes | Delete project |
| GET | `/api/projects/:id/state` | Yes | Full state (JSONB) |
| PUT | `/api/projects/:id/state` | Yes | Replace state (zod-validated) |
| GET | `/api/projects/:id/export` | Yes | Download JSON snapshot |
| POST | `/api/projects/:id/import` | Yes | Import JSON snapshot |
| GET | `/.well-known/oauth-authorization-server` | No | OAuth discovery (RFC 8414) |
| GET | `/.well-known/oauth-protected-resource` | No | Protected resource metadata (RFC 9728) |
| POST | `/oauth/register` | No | DCR — register public client (PKCE) |
| GET | `/oauth/authorize` | No* | Authorize — `code_challenge` + S256, redirects to login if no session |
| POST | `/oauth/token` | No | Token — `authorization_code` + `code_verifier` / `refresh_token` (rotation) |
| POST | `/oauth/revoke` | No | Revoke token |
| GET | `/oauth/authorized-apps` | Yes | List authorized clients (session) |
| DELETE | `/oauth/authorized-apps/:clientId` | Yes | Revoke client (session) |
| GET | `/api/v1/health` | No | Health check (monitoring) |
| GET | `/api/v1/projects/:projectId/{tasks\|issues\|testCases\|milestones\|techEntries\|decisions\|tables\|relations\|schemaVersions\|apiCollections\|apiEndpoints}` | Yes | Granular list (`?after=&limit=` cursor) + `ETag` |
| GET\|PATCH\|DELETE | `/api/v1/projects/:projectId/{entity}/{entityId}` | Yes | Granular read/write (editor+; `If-Match` optional → 409) |
| POST | `/billing/checkout` | Yes | Pakasir checkout admin-only `{teamId, packageId, priceId}` → payment URL |
| POST | `/billing/webhook` | No | Pakasir webhook publik (verify server-to-server `transactiondetail`, idempoten per order_id) |
| GET | `/billing/packages` | No | Daftar paket aktif (DB-driven) |
| POST | `/webhooks/github` | No | GitHub App webhook (`express.raw`, HMAC sha256, dedupe `delivery_id`) |
| * | `/integrations/gcal/*` | Yes | Google Calendar sync-service (vault AES-256-GCM, outbox 1m/5m/30m, scope `calendar`) |

`*` `GET /oauth/authorize` requires an active session cookie; otherwise 302 to login with `returnTo`.

**Note:** all project state mutations (`PUT /state`, MCP write tools, import restore) require a member role of `owner`/`admin`/`editor`; `viewer` is read-only at both the API and MCP layers. MCP scopes: `mcp` (full), `mcp:read` (read-only tools), `mcp:write` (write tools).

Versioning contract, request/response examples, and error format: see the in-app API reference (`app/src/features/api/`), the server route contracts under `server/src/api/`, and the zod schemas in `server/src/schema/`.

---

## 6. Authentication & Authorization

**Flow (see [Security Design](security-design.md) for full detail):**

1. `register`: validate email + password (zod), hash password with bcrypt (cost 12), insert user, set cookie.
2. `login`: verify credentials, issue JWT signed with `JWT_SECRET` (HS256), payload `{ sub: userId, iat, exp }` (24h), delivered in httpOnly cookie: `SameSite=Lax; Path=/; HttpOnly; Secure` (Secure in production).
3. `logout`: clear cookie.
4. Team authorization: every project query is scoped via `team_members` (project must belong to a team the user belongs to). Roles: `owner` (team admin, member management, team deletion) → `admin` (renames, invites, member roles) → `editor` (project writes) → `viewer` (read-only). Every project query returns the caller's `role`; `PUT /state` and MCP write tools require `owner`/`admin`/`editor`.
5. Invites are email-based for **registered users only**, carry a role, expire after 7 days, and must be accepted (or declined) by the invitee; invitations can be revoked by an admin+ at any time.

---

## 7. AI Agent Integration (MCP)

### 7.1 Protocol

- **Transport:** Model Context Protocol, streamable HTTP (remote server).
- **Auth:** OAuth 2.1 PKCE public client via `Authorization: Bearer <access_token>` — scope `mcp` (full) / `mcp:read` / `mcp:write`. Discovery at `/.well-known/oauth-authorization-server` + `/.well-known/oauth-protected-resource`. DCR at `POST /oauth/register`, authorize `GET /oauth/authorize` (PKCE S256), token `POST /oauth/token` (15m access + 30d refresh rotation). See ADR-049.
- **Endpoint:** `POST /mcp` (exposed on the same Express server or a dedicated port in production).
- **Authorization:** every MCP tool access is team-member-scoped exactly like the REST API — a token can only access projects in teams the owning user belongs to, and write tools are rejected for `viewer` role + scope check (`mcp`/`mcp:write`).

### 7.2 Tools

| Tool | Description | Scope |
|---|---|---|
| `project_state` | Returns the full state of a project by id (tasks, issues, milestones, tech stack, schema tables/columns/relations) plus project meta (name, description, status, PRD) | `mcp` or `mcp:read` |
| `update_prd` | Edits the product brief (purpose, goals, features, scope, out-of-scope) | `mcp` / `mcp:write` |
| `plan_project` | Given a brief, proposes tasks with estimates + milestones (pure suggestion — does not write) | `mcp` or `mcp:read` |
| `create_task` | Creates a task (zod-validated) | `mcp` / `mcp:write` |
| `update_task` | Updates status and/or actualHours of a task | `mcp` / `mcp:write` |
| `add_issue` | Creates an issue | `mcp` / `mcp:write` |
| `update_issue` | Updates an issue (status, severity, title, description, reproduction, linked task) | `mcp` / `mcp:write` |
| `add_decision` | Creates an ADR decision entry | `mcp` / `mcp:write` |
| `add_milestone` | Creates a milestone (default status `planned`) | `mcp` / `mcp:write` |
| `update_milestone` | Updates milestone status/changelog | `mcp` / `mcp:write` |
| `add_table` | Creates a schema table with columns/indexes | `mcp` / `mcp:write` |
| `add_relation` | Creates a schema relation between two tables (rejects identical duplicates) | `mcp` / `mcp:write` |
| `delete_relation` | Deletes a schema relation by id | `mcp` / `mcp:write` |
| `add_tech` | Creates a tech stack entry | `mcp` / `mcp:write` |
| `add_test_case` | Creates a test case (optionally linked to a task or issue) | `mcp` / `mcp:write` |
| `update_test_case` | Updates a test case (status, steps, expected, linked task/issue) | `mcp` / `mcp:write` |
| `add_api_collection` | Creates an API collection | `mcp` / `mcp:write` |
| `add_api_endpoint` | Documents an API endpoint (method+path+collection) | `mcp` / `mcp:write` |
| `update_api_endpoint` | Patches endpoint contract (method/path/params/body/responses/collection) | `mcp` / `mcp:write` |
| whiteboard tools (`create_whiteboard`/`update_whiteboard`/`patch_whiteboard`/`list_whiteboards`/`validate_whiteboard`) | Granular board edit incl. `embed` SVG wireframes; validator cegah overlap | `mcp` / `mcp:write` (`list` = read) |

Transport stateless **POST-only** (`GET /mcp` → `405 + Allow: POST`); `project_state` default `limit: 200`/koleksi (`limit: 0` = semua, `counts` penuh). All tools return normalized responses with `updatedAt` so agents can detect external changes.

### 7.3 Example Agent Loop (opencode)

```
1. Agent:  opencode mcp auth devhub                       → OAuth PKCE browser login, token stored + auto-refreshed
2. Agent:  mcp__devhub__project_state({ projectId })          → sees current board
3. Agent:  mcp__devhub__plan_project({ projectId, brief })    → proposes plan
4. Agent:  mcp__devhub__create_task({...})                    → writes tasks
5. Agent:  implements code (outside DevHub)
6. Agent:  mcp__devhub__update_task({ status: "Done", actualHours }) → board updates
7. Browser: WebSocket state:diff/sync → UI reflects changes (polling fallback only)
```

Client configuration (opencode.json) — OAuth, no header:

```jsonc
{
  "mcp": {
    "devhub": {
      "type": "remote",
      "url": "https://devhub.nrawangbatin.my.id/mcp",
      "enabled": true
    }
  }
}
// then: opencode mcp auth devhub  → browser → login via custom form → token auto-rotated
```

Full spec: [MCP Integration Guide](../03-engineering/mcp-integration.md).

---

## 8. Future-Proofing (Phase 3 readiness)

| Mechanism | Now (V1) | Later (V3) |
|---|---|---|
| `Base.updatedAt` on all entities | Traceability | Last-write-wins merge across devices |
| `Base.authorId` | Current user id | Author attribution in shared teams |
| API server | Single region | Stateless server → multiple instances behind LB |
| State payload | Whole-document PUT | Patch/delta updates (WebSocket) |
| Auth | ~~Single user~~ Teams shipped: invites (email-only, 7-day TTL), roles owner/admin/editor/viewer | Real-time presence, granular per-project roles |
| Storage | Postgres JSONB | Same schema; sync service reads CDC/event log |

**Explicitly NOT planned:** Yjs/CRDT libraries in V1. Merge conflict handling begins with LWW on `updatedAt`; CRDT only if collaboration demands it.

---

## 9. Deployment Architecture

FE static di **Cloudflare Workers** (Workers Builds, `assets.directory: ./dist`, `not_found_handling: single-page-application`); API prod di **Suga**; DB **Neon** (Postgres). Lokal: `docker-compose.yml` (postgres:16-alpine :5432) untuk dev/test.

```
Workers (app static) ──HTTPS /api (same-origin proxy)──► Suga (Express) ──pg──► Neon
```

| Env var | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon `postgres://user:pass@host:5432/devhub` |
| `JWT_SECRET` | Yes | ≥ 32 random chars |
| `PORT` | No | Default 3000 |
| `NODE_ENV` | No | `development` / `production` (cookie Secure flag) |
| `COOKIE_SECURE` | No | Force Secure cookies when behind TLS proxy |
| `COOKIE_DOMAIN` | No | Parent domain prod (single login app+admin, ADR-051); kosong = host-only dev |
| `TRUST_PROXY` | No | `true` when behind reverse proxy (required for OAuth discovery origin) |
| `APP_PUBLIC_URL` | Yes (billing) | Origin publik untuk redirect Pakasir + OAuth `frontendOrigin()` |
| `PAKASIR_ENABLED` / `PAKASIR_SANDBOX` / `PAKASIR_SLUG` / `PAKASIR_API_KEY` | Billing | Pakasir payment link IDR (ADR-044/045) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth login | Social login Google (ADR-048) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` (+ App env) | OAuth + App | Social login + GitHub App integration (ADR-048/052) |

See [Deployment Runbook](../05-operations/deployment-runbook.md).

---

## 10. Technology Choices Summary

| Concern | Choice | Rationale / ADR |
|---|---|---|
| Frontend build | Vite + React 18 + TS | Fast, standard |
| UI deps | `@phosphor-icons/react`, `react-router` v7, `i18next`/`react-i18next`, `yaml`, `tus-js-client` | Icons (ADR-007 sisa) + routing (ADR-016) + i18n 6ns (ADR-046/056) + OpenAPI (ADR-019) + TUS upload (ADR-055) |
| Styling | Native CSS variables | Skill-driven design system; light/dark via `html[data-theme]` (ADR-047) |
| Server | Node 22 + Express | Simple, huge ecosystem |
| Realtime | `ws` + RoomRegistry generik | WS primary, polling fallback saat disconnected (ADR-024/025) |
| Validation | zod | Typed schemas shared between API + MCP |
| DB | PostgreSQL + JSONB | Reliability + flexible payload (ADR-002) |
| Auth | bcryptjs + jsonwebtoken + cookie-parser | Pure-JS (Windows-safe), httpOnly cookie (ADR-005) |
| Rate limit | express-rate-limit | Brute-force defense |
| AI | @modelcontextprotocol/sdk | Official SDK (ADR-049 OAuth) |

---

## 11. Testing Strategy (summary)

| Layer | Scope | Tooling |
|---|---|---|
| Server unit | auth, zod schemas, state rules | vitest + supertest |
| Server integration | API round-trips, auth flow, OAuth PKCE | vitest + test Postgres (docker) |
| MCP | tool contracts, OAuth scope rejection | vitest |
| UI | reducer logic, export/import | vitest |
| E2E (Phase 2) | critical paths | Playwright |

Full detail: [Testing Strategy](../03-engineering/testing-strategy.md).

---

*End of Technical Design Document.*
