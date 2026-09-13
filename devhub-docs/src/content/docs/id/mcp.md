---
title: Integrasi MCP
description: Hubungkan agen coding AI ke DevHub via server MCP remote (OAuth 2.1 PKCE).
---

DevHub mengekspos **server Model Context Protocol (MCP)** agar agen coding AI (opencode, Claude Code, Cursor, dan lainnya) dapat membaca dan memperbarui state proyek. Agen menjadi partisipan kelas satu: merencanakan kerja, melaporkan progres, dan UI browser mencerminkan perubahan secara live.

Keputusan terkunci: agen mengakses data **hanya** via MCP tools (tidak pernah langsung ke DB); transpor **remote streamable HTTP**; auth **OAuth 2.1 PKCE public client** (tanpa shared secret); **tanpa** chat AI di dalam aplikasi.

## Protokol & endpoint

| Item | Nilai |
|---|---|
| Protokol | Model Context Protocol |
| Transpor | Streamable HTTP |
| Endpoint | `POST /mcp` |
| Auth | `Authorization: Bearer <OAuth access_token>`, scope `mcp` / `mcp:read` / `mcp:write` |
| Discovery | `GET /.well-known/oauth-authorization-server` (RFC 8414) + `GET /.well-known/oauth-protected-resource` (RFC 9728) |

Scope: `mcp` = akses penuh (disarankan). `mcp:read` = read-only (`project_state`, `plan_project`, `list_whiteboards`). `mcp:write` = tools tulis.

## Mendapatkan akses (OAuth 2.1 PKCE)

Agen melakukan ini otomatis via `opencode mcp auth devhub`:

1. **DCR** — `POST /oauth/register` dengan `redirect_uris` → `{ client_id }` (public client, PKCE wajib).
2. **Authorize** — `GET /oauth/authorize?...&scope=mcp&code_challenge=...&code_challenge_method=S256` → login via form DevHub → `302` ke `redirect_uri?code=...`.
3. **Token** — `POST /oauth/token` (`authorization_code` + `code_verifier`) → `{ access_token (15 mnt), refresh_token (30 hari) }`.
4. **Refresh** — `POST /oauth/token` (`refresh_token`) → pasangan baru (rotasi).
5. **Pakai** — `Authorization: Bearer <access_token>` pada `POST /mcp`.
6. **Cabut** — Profile → Authorized Apps, atau `DELETE /oauth/authorized-apps/:clientId`.

Setiap tool memakai `projectId` — salin dari bagian atas halaman proyek di web app. Token hanya bisa mengakses proyek yang terlihat oleh user pemberi otorisasi.

## Konfigurasi klien

### opencode (`opencode.json`)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": { "devhub": { "type": "remote", "url": "https://devhub.nrawangbatin.my.id/mcp", "enabled": true } }
}
// lalu: opencode mcp auth devhub
```

### Claude Code

```bash
claude mcp add --transport http devhub https://devhub.nrawangbatin.my.id/mcp
```

### Cursor (`.cursor/mcp.json` — kunci `url`)

```json
{ "mcpServers": { "devhub": { "url": "https://devhub.nrawangbatin.my.id/mcp" } } }
```

> Cursor butuh restart penuh dan membatasi ~40 tools.

### Windsurf (`~/.codeium/windsurf/mcp_config.json` — kunci `serverUrl`)

```json
{ "mcpServers": { "devhub": { "serverUrl": "https://devhub.nrawangbatin.my.id/mcp" } } }
```

### VS Code / Copilot (`.vscode/mcp.json` — kunci `servers`)

```json
{ "servers": { "devhub": { "type": "http", "url": "https://devhub.nrawangbatin.my.id/mcp" } } }
```

### Gemini CLI (`~/.gemini/settings.json` — kunci `serverUrl`)

```json
{ "mcpServers": { "devhub": { "serverUrl": "https://devhub.nrawangbatin.my.id/mcp" } } }
```

## Tools

Setiap tool: input divalidasi otomatis; respons menyertakan timestamp.

| Tool | Input (ringkas) | Tulis? | Scope |
|---|---|---|---|
| `project_state` | `projectId` → full state (12 koleksi) + meta + PRD | Tidak | `mcp` / `mcp:read` |
| `update_prd` | `projectId`, `{ purpose?, goals?, features?, scope?, outOfScope? }` | Ya | `mcp` / `mcp:write` |
| `plan_project` | `projectId`, `brief` → usulan task + milestone (hanya saran) | Tidak | `mcp` / `mcp:read` |
| `create_task` | field task (title, status?, priority?, estimate?, labels?, dueDate?, startDate?, assigneeId?, pinned?) | Ya | `mcp` / `mcp:write` |
| `update_task` | `taskId` + `{ status?, actualHours?, dueDate?, startDate?, assigneeId?, completedAt?, pinned? }` | Ya | `mcp` / `mcp:write` |
| `add_issue` / `update_issue` | severity, status, reproduction, `linkedTaskId?`, `pinned?` | Ya | `mcp` / `mcp:write` |
| `add_decision` | field ADR (title, context, options[], decision, consequences, status?, date?) | Ya | `mcp` / `mcp:write` |
| `add_milestone` / `update_milestone` | name, status?, version?, targetDate?, changelog? | Ya | `mcp` / `mcp:write` |
| `add_table` / `add_relation` / `delete_relation` | columns[], indexes[]?, cardinality, onDelete | Ya | `mcp` / `mcp:write` |
| `add_tech` | name, version?, category?, status?, notes? | Ya | `mcp` / `mcp:write` |
| `add_test_case` / `update_test_case` | name, taskId?/issueId?, steps?, expected?, status? | Ya | `mcp` / `mcp:write` |
| `add_api_collection` / `add_api_endpoint` / `update_api_endpoint` | method, path, name, collectionId?, headers?, params?, body?, responses? | Ya | `mcp` / `mcp:write` |
| `create_whiteboard` / `update_whiteboard` | name, description?, elements[]? (7 jenis) | Ya | `mcp` / `mcp:write` |
| `list_whiteboards` | `projectId` → daftar board | Tidak | `mcp` / `mcp:read` |

Alur status: Task `todo → inProgress → review → done`. Issue `open → reproduced → fixing → resolved | wontfix`. Decision `proposed → accepted | rejected | superseded`. Milestone `planned → inProgress → released`.

## Alur kerja agen

Loop build-a-feature:

```
1. project_state                 → pahami board saat ini
2. plan_project(brief)           → usulkan task/milestone
3. create_task(...) × n          → isi board
4. [implementasi kode di luar DevHub]
5. update_task({status, actualHours})
6. update_milestone({changelog})
7. project_state                 → verifikasi state akhir
```

Jika fitur mengekspos HTTP endpoint, panggil `add_api_collection` / `add_api_endpoint` segera setelah route di-commit (atau `update_api_endpoint` bila kontrak berubah) — sebelum menandai task `done`. Perubahan tampil otomatis di browser.

## Troubleshooting

| Gejala | Perbaikan |
|---|---|
| Sesi kedaluwarsa di semua panggilan | Token kedaluwarsa/dicabut — jalankan ulang `opencode mcp auth devhub` |
| Akses ditolak untuk sebagian proyek | Token user-scoped — hanya proyek yang terlihat oleh pemberi otorisasi |
| Izin kurang | Otorisasi ulang dengan `scope=mcp` (atau `mcp:write`) |
| Argumen tidak valid | Periksa nama argumen — jalankan `project_state` untuk melihat nama field |
| Tidak tahu project ID | Salin dari bagian atas halaman proyek di web app |
| Tools tidak terdaftar | Reload konfigurasi klien, restart agen, `opencode mcp list` |
| Perubahan tak terlihat | Muat ulang halaman |
| Task duplikat | Baca state sebelum menulis (pembuatan tidak otomatis mencegah duplikat) |
