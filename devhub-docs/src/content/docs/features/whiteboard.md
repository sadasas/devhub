---
title: Whiteboards
description: Brainstorming and flowcharting canvas with live entity cards — the keepers become tasks.
---

From sticky note to task. Sketch ideas on a whiteboard; the keepers become tasks — like an onboarding checklist.

## Canvas

Stickies, shapes, edges, boundaries, text, strokes, and live entity ref cards, plus export to PNG/SVG/PDF.

## AI wireframes

`embed` elements hold AI-generated SVG wireframes (sanitized allowlist, max 20 per board). Granular edits via `patch_whiteboard`, with a dry-run `validate_whiteboard` check before writing.

## Working with agents

MCP tools: `create_whiteboard`, `update_whiteboard`, `patch_whiteboard`, `validate_whiteboard`, `list_whiteboards`. See [MCP Integration](/mcp/) for auth and the full tool list.

Part of [Features](/features/). Related: [Tasks](/features/tasks/) that whiteboard items turn into.
