# MCP Integration Guide — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Version** | 1.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-09 |
| **Related documents** | [TDD §7](../02-architecture/technical-design.md#7-ai-agent-integration-mcp) · [ADR-006](../02-architecture/adr.md#adr-006) · [API Guide](../04-api/api-guide.md) |

---

## 1. Overview

DevHub exposes a **Model Context Protocol (MCP) server** so AI coding agents (opencode, Claude Code, Cursor, etc.) can read and update project state. The agent becomes a first-class participant: it plans work, reports progress, and the browser UI reflects the changes.

**Locked design decisions (ADR-003, ADR-006, ADR-011):**
- Agents access data **only** through MCP tools — never direct DB or file reads.
- Transport: **remote, streamable HTTP** (works across the network for public deploy).
- Auth: **API key** (`Authorization: Bearer <MCP_API_KEY>`).
- No in-app AI chat UI.

---

## 2. Protocol & Endpoint

| Item | Value |
|---|---|
| Protocol | Model Context Protocol |
| Transport | Streamable HTTP |
| Endpoint | `POST /mcp` (Express server) |
| Auth | `Authorization: Bearer <MCP_API_KEY>` |
| Implementation | `@modelcontextprotocol/sdk` (Node) |
| Content type | `application/json` (JSON-RPC messages) |

---

## 3. Tools (Contract)

Every tool: inputs validated by zod; response includes `updatedAt` of the mutated entity.

| Tool | Input (brief) | Output | Writes? |
|---|---|---|---|
| `project_state` | `projectId` | Full state document (10 entity collections) | No |
| `plan_project` | `projectId`, `brief: string` | Proposed `{ tasks: [...], milestones: [...], estimateHours }` | No (suggestion only) |
| `create_task` | `projectId`, task fields (title, status?, priority?, estimate?, labels?, blockedBy?) | Created task | Yes |
| `update_task` | `projectId`, `taskId`, `{ status?, actualHours? }` | Updated task | Yes |
| `add_issue` | `projectId`, issue fields (title, severity, status?, reproduction?, linkedTaskId?) | Created issue | Yes |
| `add_decision` | `projectId`, ADR fields (title, context, options[], decision, consequences, status?, date?) | Created decision | Yes |
| `update_milestone` | `projectId`, `milestoneId`, `{ status?, changelog? }` | Updated milestone | Yes |

**Conventions:**
- Tool names are registered with a server prefix in the client (`devhub_project_state`, etc.).
- Errors: JSON-RPC error objects; validation failures return clear messages.
- Idempotency: `create_*` tools do not dedupe — agents should check state first (via `project_state`) to avoid duplicates.

---

## 4. Client Configuration

### 4.1 opencode (`opencode.json`)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "devhub": {
      "type": "remote",
      "url": "https://devhub.example.com/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_API_KEY>"
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
      "headers": { "Authorization": "Bearer <MCP_API_KEY>" }
    }
  }
}
```

### 4.3 Other clients

Any MCP client supporting streamable HTTP + bearer auth. Keep the API key out of shared config files where possible; prefer environment expansion.

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
- Rate limit `/mcp` (e.g., 120 req/min/key); constant-time key comparison.
- Tool responses never include password hashes, cookies, or secrets.
- Session-less: MCP uses API key, not user cookies; project ownership enforced via the key's bound user.

---

## 7. Testing the MCP Server

```bash
# Local dev (server running on :3000 with MCP_API_KEY set)
curl -s -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
```

Then `tools/list`, then `tools/call` with a tool name + arguments. Full examples in [API Guide §6](../04-api/api-guide.md#6-mcp-examples).

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `401` on every call | Wrong/expired API key; rotate via `MCP_API_KEY` |
| `400` on tool call | Invalid arguments per zod schema; run `project_state` to see exact field names |
| Tools not listed in agent | Client config not reloaded; restart the agent / re-run `opencode mcp` |
| Changes not visible in UI | UI polls only while tab visible; hard-refresh or switch tabs |
| Duplicate tasks | Agent re-ran `create_task` without checking state first; read-then-write |

---

*End of MCP Integration Guide.*
