---
title: Tasks & board
description: Kanban board with milestone and calendar views, dependencies, estimates, and due dates.
---

Tasks the whole team follows. Drag cards across the board, then see every deadline on one calendar.

## Views

- **By Status** — Kanban: Todo / In Progress / Review / Done, HTML5 drag-and-drop.
- **By Milestone** — tasks grouped under their [milestone](/features/milestones/).
- **Calendar** — start and due dates on a month grid, with overdue chips.

## Tracking fields

Estimates vs actuals, priority, labels, task dependencies (`blockedBy`), assignees, and start/due dates. Tasks with dates can sync to Google Calendar — see [Project integrations](/integrations/).

## Working with agents

MCP tools: `create_task`, `update_task` (status, priority, estimate, labels, dates, assignee). Typical agent loop: `project_state` → `plan_project` → `create_task × n` → implement → `update_task`. See [MCP Integration](/mcp/).

Part of [Features](/features/). Related: [Issues](/features/issues/) that tasks fix, [Test cases](/features/testing/) attached to tasks.
