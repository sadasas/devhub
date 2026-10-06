---
title: Issues
description: Triage bugs with severity, lifecycle, reproduction steps, and links to the tasks that fix them.
---

Triage bugs before standup. Every issue carries a severity, a lifecycle status, reproduction steps, and a link to the task that fixes it.

## Severity & lifecycle

- **Severity:** Critical, High, Medium, Low.
- **Lifecycle:** `open → reproduced → fixing → resolved | wontfix`.

## Reproduction steps

Write what you did, what you expected, and what happened instead — so anyone (or any agent) can reproduce the bug without asking follow-ups.

## Linking to tasks

Link an issue to the task that fixes it. The link is visible on both sides, and review/CI status from [GitHub](/integrations/) pull requests syncs onto linked tasks.

## Working with agents

MCP tools: `add_issue` / `update_issue` (severity, status, reproduction, `linkedTaskId`). See [MCP Integration](/mcp/) for auth and the full tool list.

Part of [Features](/features/). Next: [Test cases](/features/testing/) to prove the fix, [Milestones](/features/milestones/) to ship it.
