# Architecture Decision Record (ADR) Log — DevHub

| Field | Value |
|---|---|
| **Document status** | Active (living document) |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-09 |

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
| [ADR-006](#adr-006) | MCP server: remote (streamable HTTP) with API-key auth | Accepted | 2026-08-09 |
| [ADR-007](#adr-007) | Zero UI runtime dependencies except @phosphor-icons/react | Accepted | 2026-08-09 |
| [ADR-008](#adr-008) | Design system: dark-tech, native CSS variables, emerald accent | Accepted | 2026-08-09 |
| [ADR-009](#adr-009) | Every entity extends Base { id, createdAt, updatedAt, authorId } | Accepted | 2026-08-09 |
| [ADR-010](#adr-010) | V1 deploys publicly (multi-user), not local-file mode | Accepted | 2026-08-09 |
| [ADR-011](#adr-011) | No in-app AI chat UI; AI integration via MCP tools only | Accepted | 2026-08-09 |
| [ADR-012](#adr-012) | Task dependencies, test cases, milestones promoted to V1 | Accepted | 2026-08-09 |

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

- **Status:** Accepted (2026-08-09)
- **Context:** opencode supports both local (stdio) and remote (HTTP) MCP servers. Public deploy means agents connect over the network.
- **Decision:** Remote MCP server implemented with `@modelcontextprotocol/sdk`, streamable HTTP transport at `/mcp`, authenticated with `Authorization: Bearer <MCP_API_KEY>`.
- **Consequences:** Positive — works from any agent anywhere; official SDK support. Negative — requires API-key management.

### ADR-007
**Zero UI runtime dependencies except @phosphor-icons/react**

- **Status:** Accepted (2026-08-09)
- **Context:** Long-term maintainability; design system skill mandates a single icon family and no hand-rolled icons.
- **Decision:** Runtime UI deps = `@phosphor-icons/react` only. Kanban DnD (native HTML5), charts (hand-built SVG), state (Context+useReducer).
- **Consequences:** Positive — tiny bundle, few breakages. Negative — some features take more code (accepted).

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

---

*End of ADR Log. New decisions append below; existing entries never edited.*
