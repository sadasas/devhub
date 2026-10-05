---
title: Database schema
description: Tables, columns, and relations with a visual ERD, schema versioning, and safe visual diffs.
---

Review schema diffs safely. Define tables, columns, and relations with a visual ERD (SVG, pan & zoom), then version the schema and compare versions before anything reaches production.

## What you get

- **Table / Column / Relation CRUD** with per-table header colors.
- **Visual ERD** — canvas rail (Tables / Refs / Versions / DBML) with relation-flow highlight.
- **Schema versioning** — save named versions of the whole schema.
- **Schema diffing** — compare two versions: tables, columns, and relations added or removed.

## Working with agents

MCP tools: `add_table`, `add_relation`, `delete_relation` (columns, indexes, cardinality, `onDelete`). See [MCP Integration](/mcp/) for auth and the full tool list.

Part of [Features](/features/). Related: [Decisions](/features/decisions/) for why the schema looks this way, [API docs](/features/api-docs/) for the endpoints in front of it.
