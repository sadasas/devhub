---
title: Decisions (ADRs)
description: Architecture Decision Records with context, options, and consequences — searchable long after the meeting.
---

Decide with ADRs, not threads. Each decision records its context, the options considered, the decision itself, and its consequences — searchable long after the meeting ends.

## Lifecycle

`proposed → accepted | rejected | superseded`.

## What to record

Only ADR-level decisions: structure, dependencies, patterns, hosting, security. Small cosmetic or style choices don't need an ADR.

## Working with agents

MCP tool: `add_decision` (title, context, options, decision, consequences, status, date). See [MCP Integration](/mcp/) for auth and the full tool list.

Part of [Features](/features/). Related: [Database schema](/features/schema/) and [API docs](/features/api-docs/) — the artifacts decisions explain.
