# Project Charter — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Owner** | Solo developer (Project Owner) |
| **Documentation standard** | Enterprise project documentation |
| **Last updated** | 2026-08-09 |
| **Related documents** | [PRD](prd.md) · [Roadmap](roadmap.md) · [Technical Design](../02-architecture/technical-design.md) |

---

## 1. Executive Summary

DevHub is a project management application purpose-built for **programming projects** and **single developers**. Where general-purpose tools (Linear, Jira, ClickUp) assume teams and process, DevHub preserves the *technical memory* of a project: tech stack versions, database schema, architectural decisions, test case checklists, and developer-velocity stats.

DevHub is developed as a **personal tool first** and doubles as a **portfolio showcase**. Sale or open-sourcing is explicitly deferred; the architecture is designed so both remain possible without rework.

---

## 2. Vision

> A developer's project memory. Track what you build, why you built it that way, and how fast you build it — without paying for a team-focused SaaS or running a second job of setup.

**Problem statement:** Existing project management tools ignore the technical layer of software projects. No mainstream tool answers: *"Which dependency is outdated?"*, *"Why did we choose this DB?"*, *"What does our schema look like now?"*, *"Are we faster than last quarter?"*. Solo developers lose this information constantly; DevHub preserves it by design.

---

## 3. Goals, Objectives, and Non-Goals

### 3.1 Goals (V1)

| # | Goal | Success metric |
|---|---|---|
| G1 | Ship a working, usable V1 for personal use | All 8 project tabs functional; zero critical bugs at release |
| G2 | Capture technical memory | Tech stack, schema, ADRs, test cases all editable and exportable |
| G3 | Enable AI agent collaboration | MCP server functional; agent can plan tasks and update status |
| G4 | Zero-ops personal hosting | Docker-based deploy documented; restore from backup verified |

### 3.2 Objectives

- O1: Fully keyboard-navigable UI with command palette.
- O2: Export/import of full project state (JSON) for portability.
- O3: Privacy-first: email+password auth, no third-party tracking.

### 3.3 Non-Goals (explicitly out of scope)

- NG1: **Not a team-collaboration platform** in V1. Multi-user sync is V3.
- NG2: **No AI chat UI** inside the app; AI integration is via MCP tools only.
- NG3: **No Git CLI integration** in V1 (web browsers cannot spawn a git CLI; sidecar design rejected for now — see ADR-004).
- NG4: **No plugin/marketplace ecosystem**.
- NG5: **No mobile app**; responsive web only.

---

## 4. Stakeholders

| Stakeholder | Role | Interest |
|---|---|---|
| Project Owner | Sole developer, end user | Daily use for side projects; technical memory; portfolio |
| AI agents (opencode, etc.) | System stakeholder | Read/update project state via MCP |
| Future users (Phase 2+, if public) | Consumers | Signup, basic privacy, no data loss |

---

## 5. Scope

### 5.1 In Scope (V1)

- Projects, Kanban board with dependencies, issues, test cases.
- Tech stack ledger, schema manager with ERD, decision log (ADR), releases/milestones, stats.
- Auth (email + password), single Postgres instance, Docker Compose local dev.
- Remote MCP server (API-key auth) for AI agents.
- Export/import JSON; backup/restore documentation.

### 5.2 Out of Scope (deferred)

Git CLI integration, API endpoint inventory, templates, project notes, PWA offline, multi-device sync, real-time collaboration, billing/payments.

---

## 6. Assumptions and Constraints

| Type | Item |
|---|---|
| Assumption | User has one primary machine; web app used on desktop browser |
| Assumption | Postgres available via Docker for local dev |
| Constraint | Zero external UI runtime dependencies except `@phosphor-icons/react` |
| Constraint | Node.js ≥ 22, npm ≥ 10 |
| Constraint | Windows dev environment (pwsh); deployment targets Linux containers |
| **TBD** | Hosting platform (Railway / Render / VPS) — decision deferred to Phase 2 |
| **TBD** | Domain name, pricing (if ever), license — deferred to Phase 2 |

---

## 7. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Scope creep (feature requests) | High | Medium | Locked V1 scope; deferral log in roadmap |
| R2 | Public deploy requires auth+DB hardening | High | Medium | Security design documented upfront; rate limiting, zod validation |
| R3 | Data loss (single JSONB payload per project) | Medium | High | pg_dump backup strategy + export/import feature |
| R4 | Solo dev bus factor (all knowledge in one head) | Medium | High | Full documentation suite + ADR log |
| R5 | AI agent corrupts project state via MCP | Medium | Medium | zod validation on every tool input; state versioning |
| R6 | Hosting cost creep (VPS ~$5–6/mo) | Medium | Low | Small footprint; containerized; choice of cheap providers |
| R7 | Market irrelevance (crowded PM space) | Low | Medium | Positioned as complementary technical-memory tool, not competitor |

---

## 8. Success Metrics (KPIs)

| KPI | Target (V1 release) |
|---|---|
| Availability of core flows | 100% — all 8 tabs usable |
| Export/import round-trip | Data integrity preserved (verified by test) |
| MCP agent loop | Agent can create task → mark done → dashboard reflects it |
| Setup time | < 15 minutes from clone to running app |
| Open critical bugs at release | 0 |

---

## 9. Budget and Timeline

| Item | Estimate |
|---|---|
| Phase 0 — Planning + docs | 1 week (current) |
| Phase 1 — V1 build | ~4–6 weeks (part-time) |
| Phase 2 — Public deploy | ~2 weeks |
| Hosting cost | $0 (local) → ~$5–6/mo VPS (Phase 2, optional) |
| Third-party services | $0 |

---

## 10. Decision Rights and Change Control

- **Single decision-maker:** Project Owner. No steering committee.
- **Change control:** All scope changes recorded in the [Deferral Log](roadmap.md#deferral-log). Architectural decisions follow the [ADR process](../02-architecture/adr.md).

---

## 11. Licensing and Positioning (Decision Summary)

| Question | Decision | Status |
|---|---|---|
| Build to sell? | **No** for V1. Personal tool + portfolio. | Locked |
| Future monetization | One-time-purchase desktop (Tauri) or OSS + sponsors; SaaS per-seat rejected vs Linear/Jira | Considered (deferred) |
| Target user | Self (solo dev); possibly public later | Locked: public deploy in Phase 2 |
| Collaboration | Architecturally prepared (Base fields + sync provider), actual sync V3 | Locked |

---

## 12. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Project Owner | *(owner)* | 2026-08-09 | *(recorded in ADR log)* |
