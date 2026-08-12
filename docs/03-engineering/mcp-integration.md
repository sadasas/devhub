# MCP Integration Guide — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Version** | 1.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-10 |
| **Related documents** | [TDD §7](../02-architecture/technical-design.md#7-ai-agent-integration-mcp) · [ADR-006](../02-architecture/adr.md#adr-006) · [API Guide](../04-api/api-guide.md) |

---

## 1. Overview

DevHub exposes a **Model Context Protocol (MCP) server** so AI coding agents (opencode, Claude Code, Cursor, etc.) can read and update project state. The agent becomes a first-class participant: it plans work, reports progress, and the browser UI reflects the changes.

**Locked design decisions (ADR-003, ADR-006, ADR-011, ADR-013):**
- Agents access data **only** through MCP tools — never direct DB or file reads.
- Transport: **remote, streamable HTTP** (works across the network for public deploy).
- Auth: **per-user API key** (`Authorization: Bearer <key>`), created per user via `POST /api/keys` — not a shared server secret (ADR-013).
- No in-app AI chat UI.

---

## 2. Protocol & Endpoint

| Item | Value |
|---|---|
| Protocol | Model Context Protocol |
| Transport | Streamable HTTP |
| Endpoint | `POST /mcp` (Express server) |
| Auth | `Authorization: Bearer <per-user key>` (see §4.0) |
| Implementation | `@modelcontextprotocol/sdk` (Node) |
| Content type | `application/json` (JSON-RPC messages) |

---

## 3. Tools (Contract)

Every tool: inputs validated by zod; response includes `updatedAt` of the mutated entity.

| Tool | Input (brief) | Output | Writes? |
|---|---|---|---|
| `project_state` | `projectId` | Full state document (10 entity collections) + project meta (name, description, status, PRD) | No |
| `update_prd` | `projectId`, `{ purpose?, goals?, features?, scope?, outOfScope? }` | Merged PRD (all 5 sections) | Yes |
| `plan_project` | `projectId`, `brief: string` | Proposed `{ tasks: [...], milestones: [...], estimateHours }` | No (suggestion only) |
| `create_task` | `projectId`, task fields (title, status?, priority?, estimate?, labels?, blockedBy?) | Created task | Yes |
| `update_task` | `projectId`, `taskId`, `{ status?, actualHours? }` | Updated task | Yes |
| `add_issue` | `projectId`, issue fields (title, severity, status?, description?, reproduction?, linkedTaskId?) | Created issue | Yes |
| `update_issue` | `projectId`, `issueId`, `{ title?, severity?, status?, description?, reproduction?, linkedTaskId? }` | Updated issue | Yes |
| `add_decision` | `projectId`, ADR fields (title, context, options[], decision, consequences, status?, date?) | Created decision | Yes |
| `update_milestone` | `projectId`, `milestoneId`, `{ status?, changelog? }` | Updated milestone | Yes |
| `add_table` | `projectId`, `name`, `columns[]` (name, type, nullable?, primaryKey?, default?, comment?), `indexes[]?`, `comment?` | Created table (+ column ids) | Yes |
| `add_relation` | `projectId`, `fromTableId`, `fromColumnId`, `toTableId`, `toColumnId`, `cardinality?`, `onDelete?` | Created relation (rejects identical duplicates) | Yes |
| `delete_relation` | `projectId`, `relationId` | Deleted relation (with remaining count) | Yes |
| `add_tech` | `projectId`, `name`, `version?`, `category?`, `status?`, `notes?` | Created tech entry | Yes |
| `add_test_case` | `projectId`, `name`, `taskId?`, `issueId?`, `steps?`, `expected?`, `status?` | Created test case | Yes |
| `update_test_case` | `projectId`, `testCaseId`, `{ name?, taskId?, issueId?, steps?, expected?, status? }` | Updated test case | Yes |

**Conventions:**
- Tool names are registered with a server prefix in the client (`devhub_project_state`, etc.).
- Errors: JSON-RPC error objects; validation failures return clear messages.
- Idempotency: `create_*` tools do not dedupe — agents should check state first (via `project_state`) to avoid duplicates. Exception: `add_relation` rejects a relation identical (same 4 column ids) to an existing one.

---

## 4. Client Configuration

### 4.0 Getting a key

MCP keys are **per-user**: every user creates their own key while logged in — in the web app under **API Keys** (sidebar → API Keys) or via the API below (session cookie).

**Project ID:** every MCP tool takes a `projectId`. To find one, open the project in the web app — its ID is displayed at the top of the project page (monospace, with a copy button).

```bash
# 1. Register/login (sets the devhub_session cookie)
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"hunter2super"}' -c cookies.txt

# 2. Create an MCP key — returns the raw key ONCE; save it
curl -s -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"name":"opencode-desktop"}'
# → { "id": "k-1", "name": "opencode-desktop", "prefix": "devhub_ab12", "key": "devhub_ab12cd34...", ... }
```

- The raw key is shown only at creation and the server stores only its SHA-256 hash.
- Export it as an env var: `export DEVHUB_MCP_KEY="devhub_ab12cd34..."` (or your shell's secret store).
- A key can only access projects **owned by the user who created it** — same rules as the REST API.
- To rotate: create a new key, update client configs, then revoke the old one (`DELETE /api/keys/:id`).

### 4.1 opencode (`opencode.json`)

A step-by-step visual guide is also available in the app under **MCP Guide** (sidebar).

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "devhub": {
      "type": "remote",
      "url": "https://devhub.example.com/mcp",
      "headers": {
        "Authorization": "Bearer {env:DEVHUB_MCP_KEY}"
      },
      "enabled": true
    }
  }
}
```

Tool calls appear as `mcp__devhub__<tool_name>`.

### 4.2 Claude Code (`.mcp.json`)

```json
{
  "mcpServers": {
    "devhub": {
      "url": "https://devhub.example.com/mcp",
      "headers": { "Authorization": "Bearer ${DEVHUB_MCP_KEY}" }
    }
  }
}
```

### 4.3 Other clients

Any MCP client supporting streamable HTTP + bearer auth. Keep the API key out of shared config files where possible; prefer environment expansion (`{env:...}` for opencode, `${...}` for Claude Code).

---

## 5. Agent Workflows

### 5.1 Build-a-feature loop (recommended)

```
1. project_state                 → understand current board & context
2. plan_project(brief)           → agent proposes tasks/milestones
3. create_task(...) × n          → board populated
4. [agent implements code outside DevHub]
5. update_task({status:"inProgress"|"review"|"done", actualHours})
6. update_milestone({changelog}) when done
7. project_state                 → verify final state
```

The browser UI polls `GET /api/projects/:id/state` every 5s while the tab is visible, so progress appears live.

### 5.2 Bug triage loop

```
1. add_issue({severity:"critical", reproduction:"..."})
2. create_task({title:"fix ...", blockedBy:[...]})
3. ... fix ...
4. update_task({status:"done"})
5. add_decision({title:"why fixed this way", context, decision})
```

---

## 6. Server-Side Implementation Notes

- `server/src/mcp/tools/*.ts`: one file per tool exporting `{ name, schema, handler }`; registered in `server.ts`.
- Tools reuse the same service functions as REST routes — single source of truth.
- Rate limit `/mcp` (e.g., 120 req/min/key).
- Tool responses never include password hashes, cookies, or secrets.
- Session-less: MCP uses a per-user API key, not user cookies; the key is resolved to its owner (`req.userId`) on every request and project ownership is enforced in `state-db.ts` (`owner_id` filter) exactly like the REST API.

---

## 7. Testing the MCP Server

```bash
# Local dev: DEVHUB_MCP_KEY = key created via POST /api/keys (see §4.0)
curl -s -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $DEVHUB_MCP_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
```

Then `tools/list`, then `tools/call` with a tool name + arguments. Full examples in [API Guide §6](../04-api/api-guide.md#6-mcp-examples).

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `401` on every call | Wrong, expired, or revoked key. Create a new one in the app's **API Keys** page (or `POST /api/keys`), update `DEVHUB_MCP_KEY`, restart the client |
| `401` only for some projects | Key is user-scoped (ADR-013): it can only touch projects owned by the user who created it; use that user's key |
| `400` on tool call | Invalid arguments per zod schema; run `project_state` to see exact field names |
| Missing/unknown `projectId` | Copy the project ID from the top of the project page in the web app (or from the dashboard's exported data); IDs are UUIDs owned by the current user |
| Tools not listed in agent | Client config not reloaded; restart the agent / re-run `opencode mcp` |
| Changes not visible in UI | UI polls only while tab visible; hard-refresh or switch tabs |
| Duplicate tasks | Agent re-ran `create_task` without checking state first; read-then-write |

---

*End of MCP Integration Guide.*
