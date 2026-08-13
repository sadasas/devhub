# Product Requirements Document (PRD) — DevHub

| Field | Value |
|---|---|
| **Document status** | Active |
| **Version** | 1.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-09 |
| **Related documents** | [Charter](project-charter.md) · [Roadmap](roadmap.md) · [Technical Design](../02-architecture/technical-design.md) |

---

## 1. Introduction

### 1.1 Purpose

This PRD defines the functional and non-functional requirements for DevHub V1. It is the source of truth for *what* the product does; the [Technical Design Document](../02-architecture/technical-design.md) defines *how*.

### 1.2 Product Summary

DevHub is a hosted SaaS project management application for programming projects. It combines lightweight task/issue tracking with developer-specific modules — tech stack ledger, database schema + ERD, ADR decision log, test cases, and velocity stats — into one hosted application. Self-hosting is not supported; data portability is guaranteed via JSON export/import.

### 1.3 Personas

| Persona | Description | Needs |
|---|---|---|
| **Solo Dev** (primary) | Builds side projects; works alone; value: speed, low friction, technical depth | Track tasks/issues; remember stack, schema, decisions; estimate velocity |
| **AI Agent** (system) | Coding agents (opencode, Claude) that help build the project | Read current state; create/update tasks; report progress |

---

## 2. User Stories

### 2.1 Projects (P)

| ID | User story | Priority |
|---|---|---|
| P-1 | As a Solo Dev, I can create a project with name, description, and status, so that I can organize multiple side projects. | P0 |
| P-2 | As a Solo Dev, I can see all projects on a dashboard with progress, open issues, outdated dependencies, and nearest milestone, so that I can prioritize at a glance. | P0 |
| P-3 | As a Solo Dev, I can export/import the full state of a project as JSON, so that I can back up or move data. | P0 |

### 2.2 Board & Tasks (B)

| ID | User story | Priority |
|---|---|---|
| B-1 | As a Solo Dev, I can create tasks with title, status (Todo / In Progress / Review / Done), priority, estimate (h), and labels. | P0 |
| B-2 | As a Solo Dev, I can drag-and-drop tasks between Kanban columns, so that updates are fast and tactile. | P0 |
| B-3 | As a Solo Dev, I can mark a task as blocked by other tasks, so that dependencies are visible. | P0 |
| B-4 | As a Solo Dev, I can log actual hours on a task, so that estimates vs actuals can be compared. | P0 |

### 2.3 Issues (I)

| ID | User story | Priority |
|---|---|---|
| I-1 | As a Solo Dev, I can file an issue with severity (Critical / High / Medium / Low) and lifecycle status (Open / Reproduced / Fixing / Resolved / Won't fix). | P0 |
| I-2 | As a Solo Dev, I can write reproduction steps for an issue, so that I can debug later with full context. | P0 |
| I-3 | As a Solo Dev, I can link an issue to a task, so that bugfix work appears on the board. | P1 |

### 2.4 Test Cases (T)

| ID | User story | Priority |
|---|---|---|
| T-1 | As a Solo Dev, I can attach a test case checklist to a task or issue (name, steps, expected result). | P0 |
| T-2 | As a Solo Dev, I can mark each test case Pass / Fail / Pending, so that release readiness is visible. | P0 |

### 2.5 Tech Stack (S)

| ID | User story | Priority |
|---|---|---|
| S-1 | As a Solo Dev, I can record a tech entry (name, version, category: Frontend/Backend/DB/Tooling). | P0 |
| S-2 | As a Solo Dev, I can flag upgrade status (Current / Update available / Major upgrade) with notes, so that I never lose track of dependency health. | P0 |

### 2.6 Schema (C)

| ID | User story | Priority |
|---|---|---|
| C-1 | As a Solo Dev, I can define tables with columns (name, type, nullable, PK, default, comment) and indexes. | P0 |
| C-2 | As a Solo Dev, I can define relations between columns with cardinality (1:1 / 1:N / N:M) and onDelete behavior. | P0 |
| C-3 | As a Solo Dev, I can view the schema as a visual ERD (SVG, pan & zoom), so that I can reason about the data model. | P0 |
| C-4 | As a Solo Dev, I can snapshot schema versions with notes, so that schema evolution is traceable. | P1 |

### 2.7 Decisions (D)

| ID | User story | Priority |
|---|---|---|
| D-1 | As a Solo Dev, I can record an ADR (title, status, context, options, decision, consequences, date). | P0 |
| D-2 | As a Solo Dev, I can mark decisions Proposed / Accepted / Rejected / Superseded, so that history is honest. | P0 |

### 2.8 Releases (R)

| ID | User story | Priority |
|---|---|---|
| R-1 | As a Solo Dev, I can create milestones (name, version, target date, status: Planned / In Progress / Released). | P0 |
| R-2 | As a Solo Dev, I can write a changelog on a released milestone, so that release history is documented. | P1 |

### 2.9 Stats (A)

| ID | User story | Priority |
|---|---|---|
| A-1 | As a Solo Dev, I can view estimates vs actuals per task/period, so that future estimates improve. | P1 |
| A-2 | As a Solo Dev, I can view issue aging and task throughput charts (SVG), so that I can see progress. | P1 |

### 2.10 Global / UX (G)

| ID | User story | Priority |
|---|---|---|
| G-1 | As a Solo Dev, I can open a command palette with Ctrl+K, so that I can navigate and create without mouse. | P0 |
| G-2 | As a Solo Dev, I can use keyboard shortcuts for common actions. | P0 |
| G-3 | As a user, I can register/login with email + password, so that my data is private. | P0 |

### 2.11 AI Agent (MCP) (M)

| ID | User story | Priority |
|---|---|---|
| M-1 | As an AI agent, I can read a project's full state (`project_state`). | P0 |
| M-2 | As an AI agent, I can plan a project from a brief into tasks/estimates/milestones (`plan_project`). | P0 |
| M-3 | As an AI agent, I can create tasks, update status + actual hours, add issues, add decisions, and update milestone changelogs. | P0 |

---

## 3. Functional Requirements

### 3.1 Data Model (10 entities)

All entities extend a `Base` shape for future collaboration:

```
Base { id: string (UUID), createdAt: ISO, updatedAt: ISO, authorId?: string }
```

| Entity | Key fields |
|---|---|
| Project | name, description, status, createdAt |
| Task | title, status (Todo/In Progress/Review/Done), priority, estimate, actualHours, labels, blockedBy: taskId[] |
| Issue | title, severity (Critical/High/Med/Low), status (Open/Reproduced/Fixing/Resolved/Won't fix), reproduction, linkedTaskId? |
| TestCase | taskId/issueId?, name, steps, expected, status (Pass/Fail/Pending) |
| TechEntry | name, version, category (Frontend/Backend/DB/Tooling), status (Current/Update available/Major upgrade), notes |
| Table | name, comment, columns[], indexes |
| Column | name, type, nullable, primaryKey, default, comment |
| Relation | fromTableId+fromColumnId, toTableId+toColumnId, cardinality ('1:1'/'1:N'/'N:M'), onDelete |
| SchemaVersion | version, appliedAt, notes |
| Decision (ADR) | title, status (Proposed/Accepted/Rejected/Superseded), context, options, decision, consequences, date |
| Milestone | name, version?, targetDate, status (Planned/In Progress/Released), changelog? |

**Deletion rules:** deleting a Table cascades its Relations; deleting a Task unlinks `blockedBy` references.

### 3.2 UI Structure

- **Layout:** Sidebar (navigation) + content area. Dark theme, keyboard-first.
- **Dashboard:** project cards (progress, open issues, outdated deps, nearest milestone).
- **Project Detail — 8 tabs:**
  1. Board (Kanban + dependencies)
  2. Issues
  3. Test Cases
  4. Stack
  5. Schema (CRUD + ERD SVG + versioning)
  6. Decisions (ADR)
  7. Releases (milestones + changelog)
  8. Stats

### 3.3 API Requirements

| Endpoint group | Requirements |
|---|---|
| Auth | `POST /api/auth/register`, `login`, `logout`; JWT in httpOnly cookie; brute-force protection |
| Projects | CRUD scoped to authenticated user |
| State | `GET /api/projects/:id/state`, `PUT /api/projects/:id/state` (full JSONB payload, zod-validated) |
| Export/Import | `GET/POST /api/projects/:id/export`, `.../import` |

### 3.4 MCP Tools

| Tool | Signature (brief) |
|---|---|
| `project_state` | (projectId) → full state |
| `update_prd` | (projectId, {purpose, goals, features, scope, outOfScope}) → PRD |
| `plan_project` | (projectId, brief) → tasks + estimates + milestones |
| `create_task` | (projectId, task) → task |
| `update_task` | (projectId, taskId, {status, actualHours}) → task |
| `add_issue` | (projectId, issue) → issue |
| `update_issue` | (projectId, issueId, {status, severity, linkedTaskId}) → issue |
| `add_decision` | (projectId, adr) → adr |
| `update_milestone` | (projectId, milestoneId, {changelog, status}) → milestone |
| `add_table` | (projectId, name, columns[]) → table |
| `add_relation` | (projectId, tableIds, columnIds, cardinality) → relation (duplicates rejected) |
| `delete_relation` | (projectId, relationId) → deleted relation |
| `add_tech` | (projectId, name, version, category) → tech entry |
| `add_test_case` | (projectId, name, taskId?, issueId?, steps?, expected?, status?) → test case |
| `update_test_case` | (projectId, testCaseId, {name, status, steps, expected, taskId, issueId}) → test case |

---

## 4. Non-Functional Requirements

| Category | Requirement | Acceptance criteria |
|---|---|---|
| **Performance** | UI feels instant for solo-scale data (< 5k tasks) | Interactions respond < 100ms; initial load < 2s on localhost |
| **Availability** | Hosted SaaS; no SLA beyond operator's uptime | Health endpoint at `/api/v1/health` |
| **Security** | Passwords never stored in plaintext | bcrypt (cost ≥ 10); JWT httpOnly+Secure cookies; zod validation on all inputs; rate limit auth endpoints |
| **Privacy** | No third-party tracking/analytics in V1 | No external network calls from UI except API |
| **Accessibility** | WCAG AA for all interactive elements | Contrast ≥ 4.5:1 body; keyboard operable; `prefers-reduced-motion` honored |
| **Portability** | Data not locked in | Full JSON export/import; documented restore from pg_dump |
| **Compatibility** | Modern desktop browsers | Chrome/Edge/Firefox/Safari latest 2 versions |
| **Extensibility** | Collaboration-ready | Base fields on all entities; storage behind provider boundary |

---

## 5. Release Criteria (Definition of Done for V1)

1. All P0 user stories implemented and manually verified.
2. Export → wipe → import round-trip preserves data integrity.
3. MCP agent can execute the full loop: plan → create task → update → read back.
4. `npm run build` passes with zero TypeScript errors.
5. Auth endpoints pass security review (rate limit, cookie flags, zod).
6. Both light and dark reading of the UI? **No** — dark-only theme is a locked design decision; contrast verified in dark.
7. Keyboard: every primary action reachable; Ctrl+K opens palette.
8. README quickstart works from clean clone in < 15 minutes.

---

## 6. Out of Scope (V1)

See [Charter §5.2](project-charter.md#52-out-of-scope-deferred). Highlights: Git CLI integration, API endpoint inventory, templates, PWA, sync, collaboration, billing.

---

## 7. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Hosting platform (Railway / Render / VPS)? | Owner | Deferred |
| 2 | License (MIT / proprietary)? | Owner | Deferred |
| 3 | Public registration open or invite-only? | Owner | Resolved: open registration (live on Auth page) |
| 4 | Domain name? | Owner | Deferred |

---

*End of PRD. Scope changes require updating this document and the Deferral Log.*
