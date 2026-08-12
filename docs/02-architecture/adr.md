# Architecture Decision Record (ADR) Log — DevHub

| Field | Value |
|---|---|
| **Document status** | Active (living document) |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-11 |

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

---

*End of ADR Log. New decisions append below; existing entries never edited.*
