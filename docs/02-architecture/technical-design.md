# Technical Design Document (TDD) — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Version** | 1.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-09-02 |
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
   Solo Dev  ─────► │  DevHub Web App              │
   (browser)        │  Vite + React + TS (app/)    │
                    └──────────────┬───────────────┘
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
- **Solo Dev (human):** registers, logs in, manages projects via the web app.
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
| Feature tabs | `Board`, `Issues`, `TestCases`, `Stack`, `Schema` (with ERD), `Decisions`, `Releases`, `Stats` |
| `CommandPalette` | Ctrl+K global command palette + keyboard shortcuts + create actions (deep-link `?tab=X&new=1`) |
| `components/` | Design-system primitives: Button, Input, Badge, Modal, Skeleton, EmptyState, Toast |
| `styles/` | `tokens.css` (CSS variables), `global.css` |

**Design constraints (locked):**
- No runtime UI dependencies except `@phosphor-icons/react`.
- Kanban drag & drop: native HTML5 DnD (no library).
- Charts: hand-built SVG components.
- Dark theme only; CSS variables; Geist/Geist Mono self-hosted via `@fontsource`.

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
| `Task` | title, status (Todo/In Progress/Review/Done), priority, estimate (h), actualHours (h), labels: string[], blockedBy: taskId[] |
| `Issue` | title, severity (Critical/High/Med/Low), status (Open/Reproduced/Fixing/Resolved/Won't fix), reproduction, linkedTaskId? |
| `TestCase` | taskId? / issueId?, name, steps, expected, status (Pass/Fail/Pending) |
| `TechEntry` | name, version, category (Frontend/Backend/DB/Tooling), status (Current/Update available/Major upgrade), notes |
| `Table` | name, comment, columns: Column[], indexes: string[] |
| `Column` | name, type, nullable, primaryKey, default, comment |
| `Relation` | fromTableId+fromColumnId, toTableId+toColumnId, cardinality ('1:1'/'1:N'/'N:M'), onDelete (CASCADE/SET NULL/RESTRICT) |
| `SchemaVersion` | version, appliedAt, notes |
| `Decision` | title, status (Proposed/Accepted/Rejected/Superseded), context, options: string[], decision, consequences, date |
| `Milestone` | name, version?, targetDate, status (Planned/In Progress/Released), changelog? |

**State shape (per project):**

```jsonc
{
  "tasks": [...],
  "issues": [...],
  "testCases": [...],
  "techEntries": [...],
  "tables": [...],
  "columns": [...],      // referenced by tables + relations
  "relations": [...],
  "schemaVersions": [...],
  "decisions": [...],
  "milestones": [...]
}
```

**Integrity rules (validated in zod schema, enforced by reducer):**
- `Task.blockedBy` entries must reference existing task ids; deleting a task removes it from all `blockedBy` arrays.
- `Relation` references must exist; deleting a Table cascades its Relations.
- `TestCase` references a task or an issue (at most one).
- Card ordering in Kanban columns stored as an explicit `order` array per status (or implicit array order in state).

---

## 5. API Design

Base URL: `/api`. All endpoints JSON. Auth via httpOnly cookie `devhub_session`.

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

All tools return normalized responses with `updatedAt` so agents can detect external changes.

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

```
Dockerfile (node:22-alpine)
  ├── server build (dist/)
  └── app static build served by Express (or CDN in Phase 2)

docker-compose.yml (local dev):  postgres:16-alpine on :5432
```

| Env var | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | `postgres://user:pass@host:5432/devhub` |
| `JWT_SECRET` | Yes | ≥ 32 random chars |
| `PORT` | No | Default 3000 |
| `NODE_ENV` | No | `development` / `production` (cookie Secure flag) |
| `COOKIE_SECURE` | No | Force Secure cookies when behind TLS proxy |
| `TRUST_PROXY` | No | `true` when behind reverse proxy (required for OAuth discovery origin) |

See [Deployment Runbook](../05-operations/deployment-runbook.md).

---

## 10. Technology Choices Summary

| Concern | Choice | Rationale / ADR |
|---|---|---|
| Frontend build | Vite + React 18 + TS | Fast, standard |
| UI deps | `@phosphor-icons/react` only | Zero-dep policy, single icon family (ADR-007) |
| Styling | Native CSS variables | Skill-driven design system; no framework needed |
| Server | Node 22 + Express | Simple, huge ecosystem |
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
