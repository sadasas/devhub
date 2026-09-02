# MCP Integration Guide — DevHub

| Field | Value |
|---|---|
| **Document status** | Active |
| **Version** | 2.0 (OAuth) |
| **Owner** | Project Owner |
| **Last updated** | 2026-09-02 |
| **Related documents** | [TDD §7](../02-architecture/technical-design.md#7-ai-agent-integration-mcp) · [ADR-049](../02-architecture/adr.md#adr-049) |

---

## 1. Overview

DevHub exposes a **Model Context Protocol (MCP) server** so AI coding agents (opencode, Claude Code, Cursor, etc.) can read and update project state. The agent becomes a first-class participant: it plans work, reports progress, and the browser UI reflects the changes.

**Locked design decisions (ADR-003, ADR-006, ADR-011, ADR-049):**
- Agents access data **only** through MCP tools — never direct DB or file reads.
- Transport: **remote, streamable HTTP** (works across the network for public deploy).
- Auth: **OAuth 2.1 PKCE public client** — Dynamic Client Registration (RFC 7591), Authorization Code + PKCE S256, `Authorization: Bearer <access_token>` with scope `mcp` / `mcp:read` / `mcp:write` (ADR-049). No `OAuth token`, no shared secret.
- No in-app AI chat UI.

---

## 2. Protocol & Endpoint

| Item | Value |
|---|---|
| Protocol | Model Context Protocol |
| Transport | Streamable HTTP |
| Endpoint | `POST /mcp` (Express server) |
| Auth | `Authorization: Bearer <OAuth access_token>` — scope `mcp` (or `mcp:read` / `mcp:write`) |
| Discovery | `GET /.well-known/oauth-authorization-server` (RFC 8414) + `GET /.well-known/oauth-protected-resource` (RFC 9728) |
| Implementation | `@modelcontextprotocol/sdk` (Node) |
| Content type | `application/json` (JSON-RPC messages) |

Scopes:
- `mcp` — full access (read + write), default. Compatible with `mcp:read` + `mcp:write`.
- `mcp:read` — read-only: `project_state`, `plan_project`, `list_whiteboards`.
- `mcp:write` — write tools require `mcp` or `mcp:write` (enforced in `requireMcpKey`).

---

## 3. Tools (Contract)

Every tool: inputs validated by zod; response includes `updatedAt` of the mutated entity.

| Tool | Input (brief) | Output | Writes? | Scope |
|---|---|---|---|---|
| `project_state` | `projectId` | Full state document (12 entity collections) + project meta (name, description, status, PRD) | No | `mcp` or `mcp:read` |
| `update_prd` | `projectId`, `{ purpose?, goals?, features?, scope?, outOfScope? }` | Merged PRD (all 5 sections) | Yes | `mcp` / `mcp:write` |
| `plan_project` | `projectId`, `brief: string` | Proposed `{ tasks: [...], milestones: [...], estimateHours }` | No (suggestion only) | `mcp` or `mcp:read` |
| `create_task` | `projectId`, task fields (title, status?, priority?, estimate?, labels?, blockedBy?) | Created task | Yes | `mcp` / `mcp:write` |
| `update_task` | `projectId`, `taskId`, `{ status?, actualHours? }` | Updated task | Yes | `mcp` / `mcp:write` |
| `add_issue` | `projectId`, issue fields (title, severity, status?, description?, reproduction?, linkedTaskId?) | Created issue | Yes | `mcp` / `mcp:write` |
| `update_issue` | `projectId`, `issueId`, `{ title?, severity?, status?, description?, reproduction?, linkedTaskId? }` | Updated issue | Yes | `mcp` / `mcp:write` |
| `add_decision` | `projectId`, ADR fields (title, context, options[], decision, consequences, status?, date?) | Created decision | Yes | `mcp` / `mcp:write` |
| `add_milestone` | `projectId`, `name`, `{ status?, version?, targetDate?, changelog? }` | Created milestone | Yes | `mcp` / `mcp:write` |
| `update_milestone` | `projectId`, `milestoneId`, `{ status?, changelog? }` | Updated milestone | Yes | `mcp` / `mcp:write` |
| `add_table` | `projectId`, `name`, `columns[]` (name, type, nullable?, primaryKey?, default?, comment?), `indexes[]?`, `comment?` | Created table (+ column ids) | Yes | `mcp` / `mcp:write` |
| `add_relation` | `projectId`, `fromTableId`, `fromColumnId`, `toTableId`, `toColumnId`, `cardinality?`, `onDelete?` | Created relation (rejects identical duplicates) | Yes | `mcp` / `mcp:write` |
| `delete_relation` | `projectId`, `relationId` | Deleted relation (with remaining count) | Yes | `mcp` / `mcp:write` |
| `add_tech` | `projectId`, `name`, `version?`, `category?`, `status?`, `notes?` | Created tech entry | Yes | `mcp` / `mcp:write` |
| `add_test_case` | `projectId`, `name`, `taskId?`, `issueId?`, `steps?`, `expected?`, `status?` | Created test case | Yes | `mcp` / `mcp:write` |
| `update_test_case` | `projectId`, `testCaseId`, `{ name?, taskId?, issueId?, steps?, expected?, status? }` | Updated test case | Yes | `mcp` / `mcp:write` |
| `add_api_collection` | `projectId`, `name`, `description?` | Created collection (rejects duplicate names) | Yes | `mcp` / `mcp:write` |
| `add_api_endpoint` | `projectId`, `method`, `path`, `name`, `collectionId?`, `description?`, `headers[]?`, `params[]?`, `body?`, `responses[]?` | Created endpoint | Yes | `mcp` / `mcp:write` |
| `update_api_endpoint` | `projectId`, `endpointId`, `{ collectionId?, method?, path?, name?, description?, headers[]?, params[]?, body?, responses[]? }` | Updated endpoint | Yes | `mcp` / `mcp:write` |
| `create_whiteboard` | `projectId`, `name`, `description?`, `elements[]?` (id optional — server-assigned; kinds: stroke/sticky/text/shape/edge/boundary/ref) | Created board (id, name, elementCount) | Yes | `mcp` / `mcp:write` |
| `update_whiteboard` | `projectId`, `whiteboardId`, `{ name?, description?, elements[]? }` — elements replaced wholesale | Updated board | Yes | `mcp` / `mcp:write` |

**Conventions:**
- Tool names are registered with a server prefix in the client (`devhub_project_state`, etc.).
- Errors: JSON-RPC error objects; validation failures return clear messages.
- Idempotency: `create_*` tools do not dedupe — agents should check state first (via `project_state`) to avoid duplicates. Exception: `add_relation` rejects a relation identical (same 4 column ids) to an existing one.

**Entity status flows:**
- Task: `todo` → `inProgress` → `review` → `done` (auto-sets `completedAt` + `actualHours`)
- Issue: `open` → `reproduced` → `fixing` → `resolved` | `wontfix`
- Decision: `proposed` → `accepted` | `rejected` | `superseded` (no update tool — one-shot)
- Milestone: `planned` → `inProgress` → `released`
- Whiteboard: no status — create/update with full element replacement (max 50/project)

---

## 4. Client Configuration

### 4.0 Getting access — OAuth 2.1 PKCE (no API key)

MCP uses **OAuth 2.1 public client with PKCE S256** — DevHub is the Authorization Server. No `OAuth token` exists.

**Discovery (RFC 8414 + RFC 9728):**
```bash
curl -s https://devhub.nrawangbatin.my.id/.well-known/oauth-authorization-server | jq
# → { issuer, authorization_endpoint, token_endpoint, registration_endpoint, scopes_supported: ["mcp","mcp:read","mcp:write"], ... }

curl -s https://devhub.nrawangbatin.my.id/.well-known/oauth-protected-resource | jq
# → { resource: "https://devhub.nrawangbatin.my.id/mcp", authorization_servers: ["https://devhub.nrawangbatin.my.id"], scopes_supported: [...] }
```

**Flow (agents do this automatically via `opencode mcp auth devhub`):**
1. **DCR** — `POST /oauth/register` with `redirect_uris` → `{ client_id }` (public client, `token_endpoint_auth_method: none`, PKCE required).
2. **Authorize** — `GET /oauth/authorize?response_type=code&client_id=...&redirect_uri=...&scope=mcp&code_challenge=...&code_challenge_method=S256` → login via DevHub custom form (httpOnly session cookie) → `302` to `redirect_uri?code=...`.
3. **Token** — `POST /oauth/token` with `grant_type=authorization_code`, `code`, `code_verifier` → `{ access_token (15m), refresh_token (30d), token_type: Bearer, scope }`.
4. **Refresh** — `POST /oauth/token` with `grant_type=refresh_token`, `refresh_token` → new pair (rotation — old refresh invalidated).
5. **Use** — `Authorization: Bearer <access_token>` on `POST /mcp` (scope `mcp` or `mcp:read`/`mcp:write`).
6. **Revoke / authorized apps** — `GET /oauth/authorized-apps` (session cookie) lists tokens; `DELETE /oauth/authorized-apps/:clientId` revokes; `POST /oauth/revoke` revokes a single token.

**Project ID:** every MCP tool takes a `projectId`. To find one, open the project in the web app — its ID is displayed at the top of the project page (monospace, with a copy button).

**Scopes:**
- `mcp` — default, full read+write (recommended for agents).
- `mcp:read` — read-only tools only.
- `mcp:write` — write tools (requires `mcp` or `mcp:write`; read tools also need `mcp` or `mcp:read`).

An MCP access token can only access projects **owned by/visible to the user who authorized it** — same rules as the REST API. Tokens auto-refresh via the agent (opencode stores in `~/.local/share/opencode/mcp-auth.json`). To revoke access: web app **Profile → Authorized Apps** or `DELETE /oauth/authorized-apps/:clientId`.

### 4.1 opencode (`opencode.json`)

A step-by-step visual guide is also available in the app under **MCP Guide** (sidebar).

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "devhub": {
      "type": "remote",
      "url": "https://devhub.nrawangbatin.my.id/mcp",
      "enabled": true
    }
  }
}
// then: opencode mcp auth devhub  → browser → login via custom form → token auto-rotated
```

Then:
```bash
opencode mcp auth devhub   # browser opens to DevHub login, token stored + auto-refreshed
opencode mcp list          # verify: devhub: connected
opencode mcp logout devhub # revoke local token if needed
```

Tool calls appear as `mcp__devhub__<tool_name>`.

### 4.2 Claude Code (`.mcp.json` / `~/.claude.json` + CLI)

```bash
# CLI (recommended) — no header needed, OAuth handles auth
claude mcp add --transport http devhub https://devhub.nrawangbatin.my.id/mcp
claude mcp list  # verify: devhub: connected
```

```json
// .mcp.json (project) or ~/.claude.json (global)
{
  "mcpServers": {
    "devhub": {
      "type": "http",
      "url": "https://devhub.nrawangbatin.my.id/mcp"
    }
  }
}
```

### 4.3 Cursor (`.cursor/mcp.json`)

```json
// .cursor/mcp.json (project) or ~/.cursor/mcp.json (global) — use "url" (not serverUrl)
{
  "mcpServers": {
    "devhub": {
      "url": "https://devhub.nrawangbatin.my.id/mcp"
    }
  }
}
```
> Cursor requires full restart (Cmd+Q). Caps at ~40 tools — disable unused servers if needed.

### 4.4 Windsurf (`~/.codeium/windsurf/mcp_config.json`)

```json
// ~/.codeium/windsurf/mcp_config.json — use "serverUrl" (not "url") — "url" will silently fail
{
  "mcpServers": {
    "devhub": {
      "serverUrl": "https://devhub.nrawangbatin.my.id/mcp"
    }
  }
}
```
> Windsurf auto-reloads on config change — no restart needed. **CRITICAL: copying a Cursor config with "url" will silently fail — change to "serverUrl".**

### 4.5 VS Code / GitHub Copilot (`.vscode/mcp.json`)

```json
// .vscode/mcp.json (workspace) — use "servers" + "type: http" (not mcpServers)
{
  "servers": {
    "devhub": {
      "type": "http",
      "url": "https://devhub.nrawangbatin.my.id/mcp"
    }
  }
}
```

Optional Copilot CLI: `.github/copilot/mcp.json` with same shape (`servers`).

> Reload window: Cmd+Shift+P → Developer: Reload Window.

### 4.6 Gemini CLI (`~/.gemini/settings.json`)

```json
// ~/.gemini/settings.json — use "serverUrl" (like Windsurf)
{
  "mcpServers": {
    "devhub": {
      "serverUrl": "https://devhub.nrawangbatin.my.id/mcp"
    }
  }
}
```

### 4.7 Other clients

Any MCP client supporting streamable HTTP + OAuth 2.1 PKCE (RFC 7591 DCR + RFC 9728). No manual header config — the client discovers `/.well-known/oauth-authorization-server`, registers, and drives the PKCE flow.

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

Jika fitur mengekspos HTTP endpoint, agen memanggil `add_api_collection` / `add_api_endpoint` segera setelah route/handler committed (atau `update_api_endpoint` jika kontrak berubah) — sebelum `update_task` `done`.

The browser UI receives live updates via WebSocket (`state:diff`/`state:sync`); polling is fallback only when WS disconnected.

### 5.2 Bug triage loop

```
1. add_issue({severity:"critical", reproduction:"..."})
2. create_task({title:"fix ...", blockedBy:[...]})
3. ... fix ...
4. update_task({status:"done"})
5. add_decision({title:"why fixed this way", context, decision})
```

### 5.3 Agent auto-sync rules (AGENTS.md + skill)

Agar setiap sesi AI otomatis menyinkronkan kerjanya ke DevHub, sediakan file di repo user (mis. `AGENTS.md`):

1. **`AGENTS.md`** (root repo) — aturan wajib yang dibaca opencode tiap sesi:
   - Prasyarat: jalankan `opencode mcp auth devhub` & cek `DEVHUB_PROJECT_ID` — jika kosong, tanyakan ke user via `question` tool (custom input)
   - Jika MCP return 401 → jalankan `opencode mcp auth devhub` lagi (token expired/rotated)
   - Keputusan arsitektural/tradeoff difinalisasi → `add_decision` (saat keputusan fix)
   - Rencana kerja disusun / mulai implementasi → `create_task` (awal sesi)
   - Pekerjaan selesai & terverifikasi (lint/test/build hijau atau committed) → `update_task` status `done` (sebelum tutup sesi)
   - Flowchart/diagram dirancang → `create_whiteboard` / `update_whiteboard`
   - API collection / endpoint baru diekspos (mis. tambah `server/src/modules/*/handlers/*.ts`, `entity-router.ts`, `*.routes.ts`) → `add_api_collection` / `add_api_endpoint` (segera setelah route/handler committed & `method+path` final)
   - Kontrak API endpoint berubah (method/path/params/body/responses/collection) → `update_api_endpoint` (patch sebelum tutup sesi/commit)

Contoh lengkap terdokumentasi di halaman aplikasi **Docs → MCP Integration → "Automate your workflow"** (`/docs/mcp#mcp-agentsync`) dan bisa disalin dari sana.

**Resolusi project target (dinamis, tanpa UUID di file):**

1. User menyebut project di sesi → pakai itu.
2. Env var `DEVHUB_PROJECT_ID` terisi → pakai itu.
3. Tidak ada → agent bertanya sekali di awal sesi, lalu konsisten.

Env yang perlu diset user: `DEVHUB_PROJECT_ID` (opsional). OAuth token dikelola client (`opencode mcp auth devhub`), bukan env.

**Prinsip non-blocking:** jika MCP tidak terjangkau (server mati / token invalid), agent mencatat sebagai pending dan melanjutkan pekerjaan utama — sinkronisasi tidak boleh memblokir.

---

## 6. Server-Side Implementation Notes

- `server/src/modules/mcp/application/tools/*.ts`: one file per tool exporting `{ name, schema, handler }`; registered in `modules/mcp/handlers/server.ts`.
- `server/src/modules/oauth/oauth.routes.ts`: discovery (RFC 8414/9728), DCR, authorize (PKCE S256), token (authorization_code + refresh_token rotation), revoke, authorized-apps.
- Tools reuse the same service functions as REST routes — single source of truth.
- Rate limit `/mcp` (e.g., 120 req/min/IP + 500/15m per token).
- Tool responses never include password hashes, cookies, or secrets.
- Session-less for MCP: `Authorization: Bearer <access_token>` is validated against `oauth_access_tokens` (scope check `mcp` / `mcp:read` / `mcp:write`), resolved to `req.userId`, and project ownership is enforced in `state-db.ts` exactly like the REST API.

---

## 7. Testing the MCP Server

```bash
# 1. Authorize (browser) — stores token at ~/.local/share/opencode/mcp-auth.json
opencode mcp auth devhub

# 2. Call via OAuth token
TOKEN=$(jq -r .access_token ~/.local/share/opencode/mcp-auth.json)
curl -s -X POST https://devhub.nrawangbatin.my.id/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'

# 3. Or local dev with same flow:
opencode mcp auth devhub   # ensure VITE_API_URL points to http://localhost:3000 for local
TOKEN=$(jq -r .access_token ~/.local/share/opencode/mcp-auth.json)
curl -s -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq
```

Then `tools/list`, then `tools/call` with a tool name + arguments. Server-side contract: `server/src/modules/mcp/application/tools/`.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `401` on every call | Token expired or revoked. Run `opencode mcp auth devhub` again. Check `GET /oauth/authorized-apps` (Profile → Authorized Apps) — revoke stale clients if needed |
| `401` only for some projects | Token is user-scoped: it can only touch projects owned by / visible to the user who authorized it |
| `403 Insufficient OAuth scope` | Token has `mcp:read` but tool needs write. Re-authorize with `scope=mcp` (or `mcp:write`) |
| `400` on tool call | Invalid arguments per zod schema; run `project_state` to see exact field names |
| Missing/unknown `projectId` | Copy the project ID from the top of the project page in the web app (or from the dashboard's exported data); IDs are UUIDs |
| Tools not listed in agent | Client config not reloaded; `opencode mcp auth devhub` then restart the agent / re-run `opencode mcp list` |
| `Protected resource ... does not match expected ...` | Proxy discovery mismatch — ensure `TRUST_PROXY=true` and `X-Forwarded-*` handling (see `oauth.routes.ts:baseUrl`) so `/.well-known/oauth-protected-resource` returns the public origin |
| Changes not visible in UI | WebSocket is primary; UI falls back to polling only when WS disconnected. Hard-refresh or check WS connection |
| Duplicate tasks | Agent re-ran `create_task` without checking state first; read-then-write |
| Cursor max 40 tools | Cursor caps at ~40 tools. Disable unused servers or tools to stay under the limit |
| Windsurf config not loaded (silent fail) | Change "url" to "serverUrl" in `~/.codeium/windsurf/mcp_config.json` — Windsurf requires `serverUrl` |
| SSE transport deprecated | Use Streamable HTTP (`type: http` / `type: remote`) instead of SSE; SSE is deprecated in the MCP spec |
| `mcp-auth.json` not found | Run `opencode mcp auth devhub` first — token is stored at `~/.local/share/opencode/mcp-auth.json` and auto-refreshed |

---

*End of MCP Integration Guide.*
