# Security Design — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Version** | 1.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-09-24 |
| **Related documents** | [TDD](technical-design.md) · [ADR-005](adr.md#adr-005) · [ADR-049](adr.md#adr-049) · [Incident Response](../05-operations/incident-response.md) |

---

## 1. Security Objectives

| Objective | Description |
|---|---|
| C1 — Confidentiality | Only authorized members can read project data |
| C2 — Integrity | State changes are validated; no unauthorized mutation |
| C3 — Availability | Auth abuse mitigated; health monitoring |
| C4 — Privacy | Minimal data collection; no third-party tracking |

---

## 2. Threat Model (STRIDE)

| Threat | Example | Mitigation |
|---|---|---|
| Spoofing | Attacker logs in as owner | Strong password hashing, rate limiting |
| Tampering | Modified state payload | zod validation on every write; JWT signature |
| Repudiation | Denial of creating a task | `authorId`/`updatedAt` on all entities (audit trail) |
| Information disclosure | Reading others' projects | Owner-scoped queries; auth middleware on all routes |
| DoS | Brute-force login, state spam | express-rate-limit; body size limits |
| Elevation of privilege | Access admin endpoints | No admin roles in V1; least privilege by design |
| Upload abuse | Malicious/resumable upload forgery, service-key leak | TUS `x-signature` + `x-upsert` server-verified, chunk 6MB, `isUploadAuthError` gate; service-key tak ke browser (presigned/short-lived only) |
| Webhook forgery | Fake GitHub/Pakasir callback → state/billing mutation | `express.raw` sebelum `express.json` + HMAC sha256 verify + dedupe `delivery_id`; Pakasir re-verify server-to-server `transactiondetail` (amount+order_id cocok), mismatch → 200 silent |
| Token-vault theft | OAuth/GCal/GitHub token DB leak | Sealed AES-256-GCM (`key-crypto` reuse token-vault); least-scope (`calendar`, App minimal perms); refresh lazy + skew 5 mnt |

**High-risk assets:** user credentials, project state (technical memory), OAuth bearer tokens (`oauth_access_tokens`), integration token vault (GCal/GitHub, AES-256-GCM), webhook secrets (GitHub HMAC, Pakasir verify), `JWT_SECRET`.

---

## 3. Authentication & Session Security

### 3.1 Password handling

- Algorithm: bcryptjs, cost factor **12** (≥ 10 minimum enforced in code).
- Policy: min length 8, max 72 (bcrypt input limit); email normalized (lowercase, trimmed) + unique constraint.
- Self-service password reset via email (M31): `POST /auth/forgot-password` (rate-limit 5/15m, anti-enumeration — always `{ok:true}`), token 1 jam single-use, link via Resend; token never exposed in API responses. Registration requires email verification (24h link, hard gate; legacy accounts had a 14-day grace period).

### 3.2 JWT session

- Algorithm: HS256; secret from `JWT_SECRET` (min 32 chars, generated via `openssl rand -base64 48`).
- Claims: `{ sub: userId, iat, exp }`; expiry **24h**.
- Storage: httpOnly cookie `devhub_session`:
  - `HttpOnly` — JS cannot read
  - `SameSite=Lax` — CSRF defense for same-site UI (first-party on every subdomain; `SameSite=None` intentionally NOT used — ADR-051)
  - `Secure` — in production (or behind TLS proxy via `COOKIE_SECURE`)
  - `Domain` — parent domain in production via `COOKIE_DOMAIN` (single login across app + admin subdomains, ADR-051); empty = host-only (dev). `clearCookie` uses the same domain or logout silently fails
  - `Path=/`
- Logout: clear cookie server-side (`Set-Cookie` with `Max-Age=0`).
- **Subdomain constraint (ADR-051):** the session cookie is sent to ALL subdomains of the parent — never host untrusted content on a sibling subdomain.

### 3.3 Brute-force protection

- `express-rate-limit` on `/api/auth/*`:
  - Login: 10 attempts / 15 min / IP
  - Register: 5 attempts / hour / IP
- `express-rate-limit` on OAuth DCR/authorize/token + `/mcp` per-IP + per-token.
- Optional (Phase 2): exponential backoff + IP allowlist for admin.

---

## 4. Authorization

- Middleware `requireAuth` verifies JWT (signature + expiry), attaches `req.userId`.
- Middleware `requireMcpKey` verifies `Authorization: Bearer <access_token>` against `oauth_access_tokens` (expiry + scope `mcp`/`mcp:read`/`mcp:write`), attaches `req.userId`.
- **Every** project query includes `WHERE id = $1 AND owner_id = $2` (or `team_members` check). No cross-user data access.
- `PUT /state`: payload validated by zod schema of the full state model; rejects unknown keys, wrong types, dangling references (`blockedBy` pointing to missing task, etc.).
- No horizontal privilege escalation paths (project members are gated by role).

---

## 5. Input Validation & Output

| Layer | Rule |
|---|---|
| Express | `express.json({ limit: '2mb' })` — body size cap |
| Validation | zod schemas on every request body/params/query |
| SQL | Parameterized queries only (pg) — no string interpolation |
| HTML | UI uses React escaping by default; no `dangerouslySetInnerHTML` without explicit allowlist review; whiteboard `embed` SVG allowlist-sanitized (strip script/event-handler/`javascript:`/`foreignObject`/external-ref) |
| JSON output | State served as JSON only; Content-Type enforced |
| Webhook raw body | `POST /webhooks/github` + `/billing/webhook` pakai `express.raw` sebelum `express.json` (HMAC butuh byte mentah); verify → dedupe → apply, gagal apply → outbox + tetap 200 |
| Upload presigned | TUS presigned/short-lived ke browser; service-key hanya server; `x-signature`/`x-upsert` + metadata `bucket/object` diverifikasi server |

---

## 6. Secrets Management

| Secret | Where | Rotation |
|---|---|---|
| `JWT_SECRET` | env (never in repo); `.env` gitignored; `server/.env.example` committed | On exposure or quarterly |
| OAuth bearer tokens | Postgres `oauth_access_tokens` (token + refresh_token, `expires_at`/`refresh_expires_at`); raw `access_token` shown only at issuance, stored as opaque token | Revoke via `DELETE /oauth/authorized-apps/:clientId` or `POST /oauth/revoke`; refresh rotation auto-invalidates old |
| `DATABASE_URL` | env | On credential exposure |

- `.env` files in `.gitignore`; Docker secrets in Phase 2 (or `.env` files on VPS with 600 perms).
- Logging **never** includes passwords, tokens, or full cookies.

---

## 7. MCP Endpoint Security

- Endpoint `/mcp` requires `Authorization: Bearer <access_token>` with scope `mcp` (full), or `mcp:read` (read-only) / `mcp:write` (write-only). Token is looked up in `oauth_access_tokens` (active only: `expires_at > now()`), scope-checked, and bound to `req.userId`; rejects otherwise with `401` (or `403` for insufficient scope). Discovery at `/.well-known/oauth-protected-resource` + `WWW-Authenticate: Bearer resource_metadata` on 401.
- Tokens are **user-scoped**: every MCP tool DB query is filtered `owner_id = token.user_id` (identical rule to the REST API) — a token can never read or modify another user's project.
- PKCE S256 is mandatory for authorization code flow; `code_challenge` verified against `code_verifier` at `POST /oauth/token`. `state` + `code` single-use, 10m expiry.
- All tool inputs validated with the same zod schemas as the API.
- Rate limit on `/mcp` (120 req/min per IP + 500/15m per token hash).
- Tool responses never include password hashes, secrets, or token material.
- Compromise containment: revoking a client (`DELETE /oauth/authorized-apps/:clientId` or `POST /oauth/revoke`) takes effect immediately on the next request — no server restart needed. Refresh rotation also invalidates the old `refresh_token`.

---

## 8. Dependency & Supply Chain

- `npm audit` run before each release; dependencies pinned (package-lock committed).
- Only well-maintained deps (express, pg, bcryptjs, jsonwebtoken, cookie-parser, express-rate-limit, zod, @modelcontextprotocol/sdk, react, vite, @phosphor-icons/react, react-router, i18next/react-i18next, yaml, tus-js-client, ws).
- No arbitrary UI plugins; embed SVG allowlist-sanitized (ADR-053).

---

## 9. Data Protection & Privacy (GDPR-lean)

| Requirement | Implementation |
|---|---|
| Minimal collection | Only email + password hash + project data |
| Cookies | One session cookie; documented in Privacy Policy |
| Retention | Data retained until account deletion |
| Account deletion | `DELETE /api/auth/me` (Phase 2) or manual; cascades projects |
| No third-party tracking | No analytics, no pixels in V1 |
| Data export | Full JSON export per project; account export Phase 2 |

---

## 10. Operations Security

| Item | Practice |
|---|---|
| HTTPS | Terminated at Cloudflare edge (Workers static FE + Suga prod API); `Secure` cookies; `COOKIE_DOMAIN` parent-domain single login (ADR-051) |
| Backups | Daily pg_dump (Neon) to encrypted object storage (see [Backup & Recovery](../05-operations/backup-recovery.md)) |
| Updates | `npm audit` + patch apply before deploy; Postgres minor upgrades |
| Monitoring | Health endpoint + error logs (see [Monitoring](../05-operations/monitoring.md)) |
| Incident | [Incident Response](../05-operations/incident-response.md) with severity matrix |

---

## 11. Security Test Plan (V1 release)

- [ ] Auth: wrong password ×11 → rate-limited; invalid JWT → 401; expired JWT → 401
- [ ] Cross-user: user B cannot GET/PUT/DELETE user A's project (403/404)
- [ ] State: zod rejects malformed payload, dangling references, oversized body
- [ ] MCP: no token → 401; invalid token → 401; expired token → 401; revoked client → 401; `mcp:read` token on write tool → 403; user A's token cannot access user B's project; malformed tool args → 400; PKCE mismatch → 400 at `/oauth/token`
- [ ] Cookies: `HttpOnly` and `SameSite=Lax` flags verified in response headers; `Secure` in prod
- [ ] Upload: service-key tak terekspos di bundle; `x-signature` invalid → 401/403 via `isUploadAuthError`; chunk corrupt → retryable bukan auth-fail
- [ ] Webhook: HMAC salah → tolak/dedupe; replay `delivery_id` → idempoten; Pakasir amount/order mismatch → 200 silent tanpa mutasi
- [ ] GCal: token vault terseal AES-256-GCM; scope minimal `calendar`; revoke → reconnect manual, tanpa token plaintext di log
- [ ] `npm audit` clean (no high/critical)
- [ ] Secrets: grep repo for `JWT_SECRET=` false positives; no raw bearer tokens committed

---

*End of Security Design.*
