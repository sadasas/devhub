---
name: devhub
description: Work with DevHub projects via MCP — tasks, issues, milestones, PRD, ADR decisions, database schema, tech stack, test cases, API docs, and whiteboards (wireframes, flowcharts). Use when asked to plan work, create/update tasks, file bugs, record decisions, design schema, document APIs, or draw on a DevHub whiteboard. Covers every devhub MCP tool in one place.
metadata:
  author: local
  version: "1.0.0"
  scope: all-devhub-tools
---

# DevHub Skill

Single contract for all DevHub MCP tools. Full public reference:
`devhub-docs/src/content/docs/mcp.md`. Canonical MCP host (proven live):
`https://app.devhub.nrawangbatin.my.id/mcp` — single source
`devhub-docs/src/site-urls.ts`.

## 0. Prerequisites

- MCP server connected (`opencode mcp auth devhub`, verify `opencode mcp list`).
- Scope `mcp` (full, recommended). `mcp:read` = read-only tools only;
  writes need `mcp` or `mcp:write` (else 403 `Insufficient OAuth scope`).
- Every call needs `projectId` (copy from the project page header).

## 1. Mandatory workflow (all domains)

```
project_state({ projectId }) → write with the right tool → project_state (verify)
```

- **Read before writing** — creating does not auto-prevent duplicates.
- Writes touch live project data. No delete for tasks/issues/milestones.
- Status flows: Task `todo → inProgress → review → done` ·
  Issue `open → reproduced → fixing → resolved | wontfix` ·
  Decision `proposed → accepted | rejected | superseded` ·
  Milestone `planned → inProgress → released`.

## 2. Tasks (`create_task` / `update_task`)

| Field | Notes |
|---|---|
| `title` | required on create |
| `status` / `priority` / `estimate` | `priority`: low/medium/high/urgent; `estimate`: hours int |
| `labels[]` / `milestoneId` / `parentTaskId` | parent = 1-level subtask only |
| `assigneeId` / `checklist[]` / `description` / `dueDate` / `startDate` / `pinned` | dates `YYYY-MM-DD` |
| `githubLinks[]` / `completedAt` | links need `{id, repo, kind, ref, status}` |

`plan_project({ brief })` is suggestion-only (line syntax: `- title :: hours`,
`# Milestone: name :: version :: date`, `## Decision: title`). Active hours
(`actualHours`) are auto-derived — never send manual hours. After implementing
code, move the task to `done`.

## 3. Tracking (`add/update_issue`, `add/update_test_case`)

- Issue: `title` + `severity` (critical/high/medium/low), `status`,
  `reproduction`, `linkedTaskId`. Call `update_issue({status:"resolved"})`
  after fixing.
- Test case: `name` + `steps`, `expected`, `status` (pass/fail/pending),
  link via `taskId` or `issueId` (null clears).

## 4. Planning (`update_prd`, `add/update_milestone`)

- PRD sections (`purpose`, `goals`, `features`, `scope`, `outOfScope`):
  only sent sections change; empty string clears. Read current PRD first.
- Milestone: `name`, `version?`, `targetDate?` (`YYYY-MM-DD`),
  `status?`, `changelog?` (what ships/shipped).

## 5. Decisions (`add_decision`)

ADR: `title`, `context`, `options[]`, `decision`, `consequences`,
`status?`, `date?` (`YYYY-MM-DD`), `pinned?`. One decision = one call.

## 6. Schema (`add_table`, `add_relation`, `delete_relation`)

- Column: `{name, type, nullable?, primaryKey?, default?, comment?}`.
  Table: `columns[]`, `indexes[]?` (column-name strings), `comment?`.
- Relation: `fromTableId/fromColumnId → toTableId/toColumnId`,
  `cardinality` (`1:1`/`1:N`/`N:M`), `onDelete` (cascade/setNull/restrict).
  Read existing tables from `project_state` first for naming conventions.

## 7. Stack & API docs (`add_tech`, collections/endpoints)

- Tech: `name`, `version?`, `category?` (frontend/backend/database/tooling),
  `status?` (current/updateAvailable/majorUpgrade), `notes?`.
- Collection: `add_api_collection({ name })`.
- Endpoint: `add_api_endpoint({ method, path, name, collectionId?, description?,
  headers[]?, params[]? ({name, in: path/query/header, required?}), body?,
  responses[]? ({status, contentType?, description?, body?}) })`.
- `update_api_endpoint` patches any field or moves collections. Before adding,
  match `method+path+collectionId` against `project_state` to avoid duplicates.

## 8. Whiteboards (summary — pattern only)

Full contract: `skills/devhub-whiteboard/SKILL.md` (upstream, untouched).

```
list_whiteboards → [layout_board] → validate_whiteboard (dry-run) → create_whiteboard / patch_whiteboard
```

- 8 kinds: `sticky`, `text`, `shape` (rect/diamond/ellipse), `edge`,
  `boundary`, `ref` (live task/issue card, expanded 260×150), `stroke`, `embed`.
- `embed` = AI SVG wireframe fragment (no outer `<svg>`); each widget wrapped
  in `<g data-component="name">`. Allowlist tags only (no script/style/
  handlers/href/inline style). Max 20 embeds/board.
- Limits: 1000 elements/board, 50 boards/project, ≥30px gaps, coords ±100000.
- Prefer `patch_whiteboard` (granular). `update_whiteboard` **replaces the
  whole array**. Emptying needs `confirmEmpty: true`.
- `validate_whiteboard` requires each element to carry a UUID `id`
  (dummy UUIDs are fine for dry-run); omit `id`s only on `create_whiteboard`
  (server assigns).
- `layout_board({type:'sequence', participants, messages})` is a read-only
  layout assistant — paste its elements straight into create/patch.

## 9. Pitfalls (all tools)

- `projectId` is a UUID; container-style ids do not apply here.
- Scope errors → re-auth with `mcp` scope. User-scoped token: only visible projects.
- `update_task` hours are derived — sending them is ignored/wrong.
- `plan_project` never writes; follow with `create_task`.
- Whiteboard `ref` to missing task/issue renders empty (`dangling_ref` warning).
