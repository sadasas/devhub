# Roadmap — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-09 |

---

## 1. Phase Overview

| Phase | Name | Goal | Status | Est. duration |
|---|---|---|---|---|
| 0 | Planning & Documentation | Full docs suite + locked scope | **Current** | 1 week |
| 1 | V1 Build | Working app for personal use | Next | 4–6 weeks (part-time) |
| 2 | Public Deploy | Multi-user hosting + hardening | Planned | ~2 weeks |
| 3 | Collaboration & PWA | Sync, real-time, offline | Planned | TBD |

---

## 2. Phase 0 — Planning (Current)

**Deliverables:**
- [x] Market research & competitor analysis (Linear, Jira, GitHub Projects, ClickUp, Height, Shortcut, Plane)
- [x] Positioning decision: complementary "technical memory" tool, not team coordinator
- [x] Scope lock (V1 features, deferral log)
- [x] Architecture decision record (see [ADR Log](../02-architecture/adr.md))
- [x] Full documentation suite (this repo, `docs/`)
- [ ] Approval to start Phase 1

---

## 3. Phase 1 — V1 Build

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

## 4. Phase 2 — Public Deploy (Planned)

**Drivers:** Hosting decision (Railway / Render / VPS — currently TBD), production Postgres, HTTPS domain, rate-limit tuning, backup automation (cron pg_dump), monitoring (health checks, logging, alerting), privacy policy + ToS publication (already drafted in `docs/06-compliance/`), account deletion flow verification.

**V2 features (deferred from V1):**
- API Endpoint Inventory (document endpoints used by the app)
- Project Templates
- Release Tracker improvements (version history detail)
- Project Notes (free-form per project)
- Schema snapshot diffing

---

## 5. Phase 3 — Collaboration & PWA (Planned)

**Drivers:** Multi-device sync (IndexedDB provider + sync service), real-time collaboration (WebSocket + CRDT or last-write-wins merge — design prepared via Base fields), PWA offline, WebDAV/Nextcloud backup option, ntfy.sh push notifications.

**Prerequisite:** StorageProvider abstraction already designed in [Technical Design](../02-architecture/technical-design.md) — adding sync requires one new provider, zero component changes.

---

## 6. Deferral Log

Every item intentionally postponed, with rationale. Items cannot return without a scope-change record.

| ID | Feature | Deferred from | Rationale | Revisit |
|---|---|---|---|---|
| DEF-001 | Git CLI integration (run git commands, show branches) | V1 | Web browsers cannot spawn a git CLI; Node sidecar/Electron/Tauri rejected as over-engineering for V1 | Phase 3 (optional Tauri desktop) |
| DEF-002 | API Endpoint Inventory | V1 | Nice-to-have; low usage cost vs effort | V2 |
| DEF-003 | Project Templates | V1 | Not needed for personal workflows | V2 |
| DEF-004 | Release Tracker (rich version history) | V1 | Milestones cover basic need | V2 |
| DEF-005 | Project Notes | V1 | Low priority | V2 |
| DEF-006 | Task dependencies | ~~removed~~ | **Reinstated:** promoted to V1 after lifecycle review (blocking order impossible without them) | — |
| DEF-007 | Test case checklists | ~~removed~~ | **Reinstated:** promoted to V1 after lifecycle review (release readiness) | — |
| DEF-008 | Milestones/Releases | ~~removed~~ | **Reinstated:** promoted to V1 after lifecycle review | — |
| DEF-009 | PWA / offline | V1 | Needs IndexedDB provider + service worker | V3 |
| DEF-010 | Multi-device sync | V1 | Needs sync service + auth scope | V3 |
| DEF-011 | Real-time collaboration | V1 | Needs CRDT/WebSocket; architecture prepared | V3 |
| DEF-012 | In-app AI chat UI | V1 | AI integration via MCP tools only (locked decision) | Never (by design) |
| DEF-013 | Integrations (GitHub import, Discord/Slack webhooks, ntfy, Sentry, WakaTime, WebDAV backup, Todoist sync, Ollama) | V1 | Core first; integration layer kept separate from core data | V3+ |
| DEF-014 | SaaS pricing/per-seat selling | — | Rejected vs Linear/Jira; potential: one-time desktop purchase (Tauri) or OSS+sponsors | Phase 2 decision |

---

## 7. Release Management Process

1. Feature freeze per milestone; changes recorded here.
2. Manual smoke test against [Release Criteria (PRD §5)](prd.md#5-release-criteria-definition-of-done-for-v1).
3. Tag release `vX.Y.Z` (SemVer); milestone changelog updated in-app.
4. Backup taken before any deploy (see [Backup & Recovery](../05-operations/backup-recovery.md)).
5. Post-release: monitor health endpoint; update docs if behaviors changed.

---

*End of Roadmap.*
