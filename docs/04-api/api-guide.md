# API Guide — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Version** | 1.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-10 |
| **Related documents** | [OpenAPI Spec](openapi.yaml) · [TDD §5](../02-architecture/technical-design.md#5-api-design) · [MCP Guide](../03-engineering/mcp-integration.md) |

---

## 1. Overview

Base URL: `/api` (locally `http://localhost:3000/api`). All requests/responses are JSON (`application/json`), UTF-8. The authoritative machine-readable contract is [openapi.yaml](openapi.yaml).

| Aspect | Value |
|---|---|
| Auth | httpOnly cookie `devhub_session` (JWT) |
| Auth endpoints | `/api/auth/*` |
| Body limit | 2 MB |
| Error format | `{ "error": { "code", "message", "details?" } }` |
| Rate limits | login 10/15min, register 5/h per IP |

---

## 2. Authentication

### 2.1 Register

```http
POST /api/auth/register
Content-Type: application/json

{ "email": "me@example.com", "password": "hunter2super" }
```

Response `201` (sets cookie):

```json
{ "id": "a1b2...", "email": "me@example.com", "createdAt": "2026-08-09T10:00:00.000Z" }
```

Errors: `400` (validation), `409` (email taken), `429` (rate limit).

### 2.2 Login

```http
POST /api/auth/login
{ "email": "me@example.com", "password": "hunter2super" }
```

Response `200` (sets cookie) or `401` with `{ "error": { "code": "UNAUTHORIZED", "message": "Invalid credentials" } }`.

### 2.3 Logout

```http
POST /api/auth/logout      → 204, cookie cleared
```

### 2.4 Session

```http
GET /api/auth/me           → 200 user, or 401
```

---

## 3. Projects

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects` | List my projects (meta) |
| POST | `/api/projects` | Create `{ name, description?, status? }` |
| GET | `/api/projects/{id}` | Meta |
| PATCH | `/api/projects/{id}` | Update meta |
| DELETE | `/api/projects/{id}` | Delete project + state |

Example create:

```http
POST /api/projects
{ "name": "DevHub", "description": "PM for programmers", "status": "active" }

201 → { "id": "p-1", "ownerId": "a1b2", "name": "DevHub", "description": "...", "status": "active", "createdAt": "...", "updatedAt": "..." }
```

**Security:** every project is owner-scoped; accessing another user's project returns `404` (not `403`, to avoid resource enumeration).

---

## 4. MCP Keys (per-user API keys)

MCP access uses **per-user API keys**, not a server-wide secret. A key belongs to the user who created it and is scoped to that user's own projects (same ownership rules as §3). Raw keys are shown **once** at creation; the server stores only a SHA-256 hash.

Keys are managed in the web app under **API Keys** (sidebar); the endpoints below are what that UI calls.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/keys` | List my keys (id, name, prefix, created/last-used/revoked timestamps) |
| POST | `/api/keys` | Create a key, body `{ "name"?: "my-agent" }` |
| DELETE | `/api/keys/{id}` | Revoke a key (immediate; existing sessions fail on next call) |

Example create:

```http
POST /api/keys
{ "name": "opencode-desktop" }

201 → { "id": "k-1", "name": "opencode-desktop", "prefix": "devhub_ab12", "key": "devhub_ab12cd34...", "createdAt": "..." }
```

- `key` is returned **only** in the create response — copy it immediately; it cannot be retrieved later.
- Use `key` as the MCP bearer token: `Authorization: Bearer <key>`.
- Revocation is soft (`revoked_at` set); the row is kept for audit, and revoked keys return `401` on the MCP endpoint.

---

## 5. State

### 4.1 Read

```http
GET /api/projects/p-1/state
```

`200` → the full state document (10 collections, see schema `State` in the OpenAPI spec):

```json
{
  "tasks": [ { "id": "...", "createdAt": "...", "updatedAt": "...", "authorId": "me", "title": "Build auth", "status": "inProgress", "priority": "high", "estimate": 4, "actualHours": 2.5, "labels": ["backend"], "blockedBy": [] } ],
  "issues": [],
  "testCases": [],
  "techEntries": [],
  "tables": [],
  "columns": [],
  "relations": [],
  "schemaVersions": [],
  "decisions": [],
  "milestones": []
}
```

### 4.2 Write (full replace)

```http
PUT /api/projects/p-1/state
Content-Type: application/json

{ "tasks": [ ... ], "issues": [ ... ], ... }
```

- Body is validated by the zod schema: unknown keys rejected, types enforced, **dangling references rejected** (e.g., `blockedBy` pointing at a missing task id).
- On success `200` returns the stored state.
- Clients should send the full document; the UI uses debounced whole-document saves (Phase 3 will move to deltas).

---

## 6. Export / Import

### 5.1 Export

```http
GET /api/projects/p-1/export
```

`200` → attachment (`Content-Disposition: attachment; filename="devhub-p-1-2026-08-09.json"`):

```json
{
  "meta": { "app": "devhub", "version": "1.0.0", "exportedAt": "2026-08-09T10:00:00.000Z", "projectId": "p-1" },
  "state": { ... }
}
```

### 5.2 Import

```http
POST /api/projects/p-1/import
Content-Type: application/json

{ "meta": { ... }, "state": { ... } }
```

`200` → imported state. The `state` must pass the same zod validation as `PUT /state`. `meta` is advisory (records `app`, version compatibility check — mismatch logs a warning).

**Backup usage:** export provides point-in-time snapshots; automate with the [Backup & Recovery](../05-operations/backup-recovery.md) runbook.

---

## 7. MCP Examples

The MCP endpoint (`POST /mcp`) is a streamable-HTTP MCP server; same service layer, **per-user API-key auth** (see §4). Set `DEVHUB_MCP_KEY` to a key created via `POST /api/keys`.

```bash
# 1. Initialize
curl -s -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $DEVHUB_MCP_KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'

# 2. List tools
curl -s -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $DEVHUB_MCP_KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3. Call a tool
curl -s -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $DEVHUB_MCP_KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"project_state","arguments":{"projectId":"p-1"}}}'
```

Full tool contract: [MCP Integration Guide §3](../03-engineering/mcp-integration.md#3-tools-contract).

---

## 8. Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | zod failed; `details` has field errors |
| `UNAUTHORIZED` | 401 | Missing/invalid session |
| `FORBIDDEN` | 403 | Not permitted (reserved) |
| `NOT_FOUND` | 404 | Resource missing (or not yours) |
| `CONFLICT` | 409 | Duplicate email |
| `RATE_LIMITED` | 429 | Too many requests; retry after backoff |
| `INTERNAL` | 500 | Unexpected; log inspected |

---

## 9. Versioning & Compatibility

- API v1: `/api` (no path version yet). Breaking changes require a new major version or endpoint suffix — recorded in the [ADR log](../02-architecture/adr.md) before rollout.
- `app` ↔ `server` contract sync: types in `app/src/lib/types.ts` ↔ zod in `server/src/schema` must change together in one PR (see [Coding Standards §3](../03-engineering/coding-standards.md#3-typescript-rules)).

---

*End of API Guide.*
