---
title: MCP Integration
description: Connect AI coding agents to DevHub via the remote MCP server (OAuth 2.1 PKCE).
---

DevHub exposes a **Model Context Protocol (MCP) server** so AI coding agents (opencode, Claude Code, Cursor, and others) can read and update project state. The agent becomes a first-class participant: it plans work, reports progress, and the browser UI reflects the changes live.

Locked decisions: agents access data **only** through MCP tools (never direct DB); transport is **remote streamable HTTP**; auth is **OAuth 2.1 PKCE public client** (no shared secrets); there is **no in-app AI chat UI**.

## Protocol & endpoint

| Item | Value |
|---|---|
| Protocol | Model Context Protocol |
| Transport | Streamable HTTP |
| Endpoint | `POST /mcp` |
| Auth | `Authorization: Bearer <OAuth access_token>`, scope `mcp` / `mcp:read` / `mcp:write` |
| Discovery | `GET /.well-known/oauth-authorization-server` (RFC 8414) + `GET /.well-known/oauth-protected-resource` (RFC 9728) |

Scopes: `mcp` = full access (recommended). `mcp:read` = read-only (`project_state`, `plan_project`, `list_whiteboards`). `mcp:write` = write tools (requires `mcp` or `mcp:write`).

## Getting access (OAuth 2.1 PKCE)

Agents do this automatically via `opencode mcp auth devhub`:

1. **DCR** — `POST /oauth/register` with `redirect_uris` → `{ client_id }` (public client, PKCE required).
2. **Authorize** — `GET /oauth/authorize?...&scope=mcp&code_challenge=...&code_challenge_method=S256` → login via DevHub form → `302` to `redirect_uri?code=...`.
3. **Token** — `POST /oauth/token` (`authorization_code` + `code_verifier`) → `{ access_token (15m), refresh_token (30d) }`.
4. **Refresh** — `POST /oauth/token` (`refresh_token`) → new pair (rotation).
5. **Use** — `Authorization: Bearer <access_token>` on `POST /mcp`.
6. **Revoke** — Profile → Authorized Apps, or `DELETE /oauth/authorized-apps/:clientId`.

Every tool takes a `projectId` — copy it from the top of the project page in the web app. A token can only access projects visible to the user who authorized it.

## Client configuration

### opencode (`opencode.json`)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": { "devhub": { "type": "remote", "url": "https://devhub.nrawangbatin.my.id/mcp", "enabled": true } }
}
// then: opencode mcp auth devhub
```

### Claude Code

```bash
claude mcp add --transport http devhub https://devhub.nrawangbatin.my.id/mcp
```

### Cursor (`.cursor/mcp.json` — key `url`)

```json
{ "mcpServers": { "devhub": { "url": "https://devhub.nrawangbatin.my.id/mcp" } } }
```

> Cursor requires full restart and caps at ~40 tools.

### Windsurf (`~/.codeium/windsurf/mcp_config.json` — key `serverUrl`)

```json
{ "mcpServers": { "devhub": { "serverUrl": "https://devhub.nrawangbatin.my.id/mcp" } } }
```

### VS Code / Copilot (`.vscode/mcp.json` — key `servers`)

```json
{ "servers": { "devhub": { "type": "http", "url": "https://devhub.nrawangbatin.my.id/mcp" } } }
```

### Gemini CLI (`~/.gemini/settings.json` — key `serverUrl`)

```json
{ "mcpServers": { "devhub": { "serverUrl": "https://devhub.nrawangbatin.my.id/mcp" } } }
```

## Tools

Every tool: inputs are validated automatically; responses include a timestamp.

| Tool | Input (brief) | Writes? | Scope |
|---|---|---|---|
| `project_state` | `projectId` → full state (12 collections) + meta + PRD | No | `mcp` / `mcp:read` |
| `update_prd` | `projectId`, `{ purpose?, goals?, features?, scope?, outOfScope? }` | Yes | `mcp` / `mcp:write` |
| `plan_project` | `projectId`, `brief` → proposed tasks + milestones (suggestion only) | No | `mcp` / `mcp:read` |
| `create_task` | task fields (title, status?, priority?, estimate?, labels?, dueDate?, startDate?, assigneeId?, pinned?) | Yes | `mcp` / `mcp:write` |
| `update_task` | `taskId` + `{ status?, actualHours?, dueDate?, startDate?, assigneeId?, completedAt?, pinned? }` | Yes | `mcp` / `mcp:write` |
| `add_issue` / `update_issue` | severity, status, reproduction, `linkedTaskId?`, `pinned?` | Yes | `mcp` / `mcp:write` |
| `add_decision` | ADR fields (title, context, options[], decision, consequences, status?, date?) | Yes | `mcp` / `mcp:write` |
| `add_milestone` / `update_milestone` | name, status?, version?, targetDate?, changelog? | Yes | `mcp` / `mcp:write` |
| `add_table` / `add_relation` / `delete_relation` | columns[], indexes[]?, cardinality, onDelete | Yes | `mcp` / `mcp:write` |
| `add_tech` | name, version?, category?, status?, notes? | Yes | `mcp` / `mcp:write` |
| `add_test_case` / `update_test_case` | name, taskId?/issueId?, steps?, expected?, status? | Yes | `mcp` / `mcp:write` |
| `add_api_collection` / `add_api_endpoint` / `update_api_endpoint` | method, path, name, collectionId?, headers?, params?, body?, responses? | Yes | `mcp` / `mcp:write` |
| `create_whiteboard` / `update_whiteboard` | name, description?, elements[]? (7 kinds) | Yes | `mcp` / `mcp:write` |
| `list_whiteboards` | `projectId` → boards | No | `mcp` / `mcp:read` |

Status flows: Task `todo → inProgress → review → done`. Issue `open → reproduced → fixing → resolved | wontfix`. Decision `proposed → accepted | rejected | superseded`. Milestone `planned → inProgress → released`.

## Agent workflows

Build-a-feature loop:

```
1. project_state                 → understand current board
2. plan_project(brief)           → propose tasks/milestones
3. create_task(...) × n          → populate board
4. [implement code outside DevHub]
5. update_task({status, actualHours})
6. update_milestone({changelog})
7. project_state                 → verify final state
```

If the feature exposes HTTP endpoints, call `add_api_collection` / `add_api_endpoint` right after the route is committed (or `update_api_endpoint` when the contract changes) — before marking the task `done`. Changes appear automatically in the browser UI.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Session expired on every call | Token expired/revoked — re-run `opencode mcp auth devhub` |
| Access denied for some projects | Token is user-scoped — only projects visible to the authorizer |
| Insufficient permission | Re-authorize with `scope=mcp` (or `mcp:write`) |
| Invalid arguments | Check argument names — run `project_state` to see exact field names |
| Don't know the project ID | Copy it from the top of the project page in the web app |
| Tools not listed | Reload client config, restart agent, `opencode mcp list` |
| Changes not visible | Reload the page |
| Duplicate tasks | Read state before writing (creating does not auto-prevent duplicates) |
