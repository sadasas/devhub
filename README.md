# DevHub

> Developer-grade project management for programming projects. Track tasks, bugs, test cases, your tech stack, database schema, architectural decisions, releases, and velocity — everything your project needs, in one workspace.

> **Your data stays yours.** Export or import the full state of any project as JSON, anytime.

**Status:** In development (Milestone 7, v0.2.0 target). See [Roadmap](docs/01-project/roadmap.md).

**DevHub is a hosted, multi-user project-management workspace. Self-hosting is not supported; data portability is guaranteed via JSON export/import.**

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Documentation](#documentation)
- [AI Agent Integration (MCP)](#ai-agent-integration-mcp)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

DevHub is a project management application designed specifically for **programming projects**. Unlike general-purpose PM tools (Linear, Jira, ClickUp) that assume teams, DevHub captures the *technical memory* of a project:

- **Tech Stack Ledger** — what versions of what dependencies you use, and when a major upgrade is due.
- **Database Schema Manager** — define tables, columns, and relations, with a visual ERD and schema versioning.
- **API Documentation** — collections and endpoints with headers, params, body and responses, plus OpenAPI 3.0.3 import/export.
- **Decision Log (ADR)** — why you chose this library or architecture, so you remember in 6 months.
- **Dev-style tracking** — tasks with estimates, issues with reproduction steps, test case checklists, milestones with changelogs.

**Target user:** developers building software projects who want a lightweight but *technically deep* tracker.

---

## Features

### V1 (in development)

| Area | Capability |
|---|---|
| Projects | Project cards on dashboard; per-project workspace |
| Board | Kanban (Todo / In Progress / Review / Done), HTML5 drag-and-drop, task dependencies (`blockedBy`) |
| Issues | Severity (Critical/High/Med/Low), lifecycle (Open → Reproduced → Fixing → Resolved / Won't fix), reproduction steps, link to task |
| Test Cases | Checklist per task/issue, status (Pass / Fail / Pending) |
| Tech Stack | Ledger of dependencies: name, version, category, upgrade status |
| Schema | Table/Column/Relation CRUD, visual ERD (SVG, pan & zoom), schema versioning |
| Decisions | ADR log: Proposed / Accepted / Rejected / Superseded |
| Releases | Milestones with target dates, changelogs |
| API Docs | Collections + endpoints inventory (headers, params, body, responses), read-only docs preview, MCP tools, OpenAPI 3.0.3 import/export (YAML/JSON) |
| Stats | Estimates vs actuals, velocity, issue aging — SVG charts |
| Global | Command Palette (Ctrl+K, `?`), keyboard shortcuts (`N` for new task), export/import JSON, URL routing (react-router) |
| Auth | Email + password, JWT httpOnly cookie, rate limiting, change password |
| Teams | Workspaces with roles (owner/admin/editor/viewer), email invites (registered users only, 7-day expiry, accept/decline), member management, team-scoped project lists |
| Sharing | Public read-only project pages at `/p/:projectId` — no login needed; per-project visibility toggle (owner/admin) with copy-link |
| Docs | In-app docs hub (`/docs`): overview with keyboard shortcuts, MCP integration guide, API reference |

### V2 / V3 (deferred — see [Roadmap](docs/01-project/roadmap.md))

Templates, release tracker improvements, project notes, PWA, multi-device sync, real-time collaboration.

---

## Architecture

```
Browser UI (Vite + React + TS)
        │  HTTPS /api (fetch with credentials)
        ▼
Express API server (auth, projects, state CRUD, export/import)
        │  pg
        ▼
PostgreSQL (users + projects with JSONB state payload)
        │  MCP (streamable HTTP, per-user API key)
        ▼
AI agents (opencode, Claude, etc.)
```

See [Technical Design Document](docs/02-architecture/technical-design.md) for the full design, including the data model (10 entities) and the AI agent integration strategy.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite, React 19, TypeScript, CSS variables (native), @phosphor-icons/react, react-router |
| Backend | Node.js, Express, zod |
| Data | PostgreSQL (JSONB state payload) |
| Auth | bcryptjs, jsonwebtoken, cookie-parser, express-rate-limit |
| AI | @modelcontextprotocol/sdk (remote MCP server) |
| Infra | Docker Compose (local Postgres), Dockerfile (deploy) |

**Design system:** Dark-tech (Linear × GitHub Dark × terminal). Self-hosted Geist / Geist Mono via @fontsource. One accent color (emerald). CSS token scales documented in [Coding Standards](docs/03-engineering/coding-standards.md).

---

## Repository Structure

```
devhub/
├── app/                  # Browser UI (Vite + React + TS)
│   ├── src/
│   │   ├── components/   # Design-system components (Button, Input, Badge, Modal, ...)
│   │   ├── features/     # Feature modules (board, issues, schema, stats, ...)
│   │   ├── lib/          # ApiProvider, types, utils
│   │   └── styles/       # tokens.css, global.css
├── server/               # Express API + MCP server
│   ├── src/
│   │   ├── api/          # Route handlers
│   │   ├── auth/         # register/login/logout, JWT, rate limiting
│   │   ├── db/           # pg pool, migrations
│   │   └── mcp/          # MCP server + tools
├── docs/                 # This documentation suite
├── docker-compose.yml    # Local Postgres
├── Dockerfile            # Deploy image
└── package.json          # Workspace scripts
```

---

## Getting Started

> **Prerequisites:** Node.js ≥ 22, npm ≥ 10, Docker (for local Postgres).

```bash
# 1. Clone and install
git clone <repo-url> devhub
cd devhub
npm install

# 2. Start local Postgres
docker compose up -d

# 3. Configure environment
cp server/.env.example server/.env   # set DATABASE_URL, JWT_SECRET, ...

# 4. Run migrations and start
npm run db:migrate
npm run dev          # starts server + app concurrently
```

Open `http://localhost:5173`, register an account, create your first project.

Full instructions: [Deployment Runbook](docs/05-operations/deployment-runbook.md).

---

## Documentation

The full enterprise-grade documentation suite lives in `docs/`:

| Area | Documents |
|---|---|
| Project | [Project Charter](docs/01-project/project-charter.md) · [PRD](docs/01-project/prd.md) · [Roadmap](docs/01-project/roadmap.md) |
| Architecture | [Technical Design](docs/02-architecture/technical-design.md) · [ADR Log](docs/02-architecture/adr.md) · [Security Design](docs/02-architecture/security-design.md) |
| Engineering | [Coding Standards](docs/03-engineering/coding-standards.md) · [Git Workflow](docs/03-engineering/git-workflow.md) · [Code Review](docs/03-engineering/code-review.md) · [Testing Strategy](docs/03-engineering/testing-strategy.md) · [MCP Integration](docs/03-engineering/mcp-integration.md) · [Server Audit 2026-08](docs/04-audit-server-2026-08.md) |
| Operations | [Deployment Runbook](docs/05-operations/deployment-runbook.md) · [Backup & Recovery](docs/05-operations/backup-recovery.md) · [Monitoring](docs/05-operations/monitoring.md) · [Incident Response](docs/05-operations/incident-response.md) |
| Compliance | [Privacy Policy](docs/06-compliance/privacy-policy.md) · [Terms of Service](docs/06-compliance/terms-of-service.md) |

---

## AI Agent Integration (MCP)

DevHub exposes a **remote MCP server** so AI coding agents (opencode, Claude, Cursor, etc.) can read and update project state directly — an agent can plan tasks, implement code, then report progress back into DevHub automatically.

- Protocol: Model Context Protocol, streamable HTTP transport.
- Auth: per-user API key (Bearer token). Each DevHub user creates their own key in the app under **API Keys** (or via `POST /api/keys`) — no shared server-wide secret.
- Tools: `project_state`, `update_prd`, `plan_project`, `create_task`, `update_task`, `add_issue`, `update_issue`, `add_decision`, `update_milestone`, `add_table`, `add_relation`, `delete_relation`, `add_tech`, `add_test_case`, `update_test_case`.

MCP keys are scoped to the user who created them: agents can only access projects in teams that user belongs to, with the same role rules as the REST API (viewers are read-only — write tools are rejected). A step-by-step guide is available in the app under **Docs** (sidebar, `/docs/mcp`). See [MCP Integration](docs/03-engineering/mcp-integration.md) for the full specification and example agent workflows.

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| Phase 0 | Planning, documentation suite | Done |
| Phase 1 | V1 feature set | Done |
| Phase 2 | Public deploy, auth hardening | Done |
| Phase 3 | Collaboration (teams, invites, roles), public sharing (`/p/:projectId`), in-app docs hub | In progress |
| Phase 4 | Real-time sync, PWA | Planned |

---

## License

TBD. Intended: open source (MIT) with sponsored development, or proprietary — decision deferred. See [Project Charter — Licensing](docs/01-project/project-charter.md).

---

*DevHub — built by developers, for developers. Your data stays yours.*
