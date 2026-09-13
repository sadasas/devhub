---
title: Roadmap
description: Where DevHub has been and where it is heading — phases, milestones, deferrals.
---

DevHub is a hosted SaaS technical-memory workspace: tasks, issues, schema + ERD, ADRs, API docs, whiteboards, and AI agents via MCP. This page is the public summary.

## Phase overview

| Phase | Name | Goal | Status |
|---|---|---|---|
| 0 | Planning & Documentation | Full docs suite + locked scope | Done |
| 1 | V1 Build | Working app (board, issues, stack, schema, ADR, releases, stats, MCP) | Done |
| 2 | Public Deploy | Multi-user hosting + hardening + legal | Done |
| 3 | Collaboration & beyond | Teams, realtime, billing, docs site | In progress |

## Shipped highlights

- **Teams & roles** — workspaces with owner/admin/editor/viewer, email invites (7-day expiry), per-team sidebar.
- **Stable API** — per-item editing with safe concurrent saves and backward compatibility.
- **Realtime** — changes appear live for everyone viewing, plus who's-online presence.
- **Whiteboard** — unified brainstorming + flowcharting canvas with live entity ref cards, templates, export PNG/SVG/PDF.
- **Calendar & dates** — start dates, due dates, and completion tracking with board views and a month grid.
- **Billing (Pakasir)** — flexible packages, manual renewals that stack, 7-day read-only grace. See [Billing](/billing/).
- **MCP for agents** — OAuth 2.1 PKCE, ~20 tools, activity-logged mutations. See [MCP](/mcp/).

## In progress

- **Public docs site** — this site (English + Indonesian): legal, MCP, roadmap, status, billing.
- **App trim** — `/privacy`, `/terms`, `/docs` redirect straight to this site.
- **API traceability MVP** — endpoint ↔ task/issue/test links.

## Deliberately deferred

PWA/offline, multi-device sync, Git CLI integration, in-app AI chat (by design — AI lives in MCP clients), request runner for API docs. Each deferral is recorded with its rationale.

*Last updated 2026-09-13.*
