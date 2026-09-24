---
title: AI Agent Skill (Whiteboard)
description: Install the DevHub whiteboard SKILL.md so your AI coding agent validates layout, patches boards, and authors AI-SVG embeds correctly.
---

The DevHub MCP server exposes whiteboard tools, but tool schemas alone don't teach an agent the *workflow*: validate before writing, patch vs wholesale replace, and the `embed` SVG contract. The **`devhub-whiteboard` skill** packages that knowledge as a `SKILL.md` file your agent auto-loads.

## Install

Copy the skill file from the DevHub repo (`skills/devhub-whiteboard/SKILL.md`) into your agent's skills directory:

| Agent | Destination |
|---|---|
| opencode | `.opencode/skills/devhub-whiteboard/SKILL.md` (project) or `~/.config/opencode/skills/` (global) |
| Claude Code | `~/.claude/skills/devhub-whiteboard/SKILL.md` |
| Cursor / VS Code | `.cursor/skills/devhub-whiteboard/SKILL.md` (or your configured skills dir) |

No build step — `SKILL.md` is plain Markdown with frontmatter. The agent picks it up when your request matches its `description` ("draw on the whiteboard", "create a wireframe", "validate board layout", …).

## What the skill covers

- **Mandatory workflow:** `list_whiteboards` → `validate_whiteboard` (dry-run) → `create_whiteboard` / `patch_whiteboard`.
- **Right tool for the job:** `patch_whiteboard` for granular edits; `update_whiteboard` replaces the whole element array.
- **Element cheat-sheet:** all 8 kinds (`stroke`, `sticky`, `text`, `shape`, `edge`, `boundary`, `ref`, `embed`) with required fields.
- **`embed` contract:** SVG fragments, `<g data-component="name">` grouping per widget, sanitizer allowlist, max 20 embeds per board.
- **Limits & pitfalls:** 1000 elements/board, 50 boards/project, ≥30px gaps, `fill` enum (`solid`/`transparent`/`none`), OAuth scopes.

## Prerequisites

The skill assumes the MCP server is already connected — see [MCP Integration](/mcp) for OAuth setup and scopes (`mcp` for full access). Every whiteboard call needs the `projectId` from the project page header.

## Scope

`devhub-whiteboard` covers whiteboards only. Skills for the remaining DevHub tools (tasks, issues, schema, API docs) will follow the same pattern.
