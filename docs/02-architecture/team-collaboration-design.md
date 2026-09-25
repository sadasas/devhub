# Team Collaboration Design — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft |
| **Version** | 0.1 |
| **Owner** | Project Owner |
| **Last updated** | 2026-09-24 |
| **Related documents** | [Technical Design](technical-design.md) · [Roadmap](../01-project/roadmap.md) |

---

## 1. Keputusan Terkunci

| No | Keputusan |
|---|---|
| 1 | Model **team/workspace-based**: satu team menaungi banyak project |
| 2 | Invite **by email, hanya user terdaftar**; alur accept/decline (bukan auto-join) |
| 3 | Role: `owner` · `admin` · `editor` · `viewer` (read-only viewer dibutuhkan) |
| 4 | Satu project satu team (tidak ada share lintas team) |
| 5 | MCP OAuth 2.1 PKCE (DCR + scoped bearer `mcp`/`mcp:read`/`mcp:write`), akses mengikuti keanggotaan team pemilik token; write tool ditolak untuk viewer (menggantikan MCP keys per-user, ADR-049) |
| 6 | Konflik edit: WS shipped sebagai primary (`state:diff`/`state:sync` + presence + resync-on-join), polling 5s hanya fallback saat disconnected; `If-Match`/`ETag` optional → 409 (ADR-024/025, ADR-022) |
| 7 | Backfill: project lama pindah ke "Personal" team otomatis per user |

---

## 2. Matriks Role

| Aksi | owner | admin | editor | viewer |
|---|---|---|---|---|
| Lihat project workspace (semua tab) | ✅ | ✅ | ✅ | ✅ |
| Export JSON | ✅ | ✅ | ✅ | ✅ |
| `PUT /state`, semua write MCP tool | ✅ | ✅ | ✅ | ❌ 403 |
| PATCH project meta | ✅ | ✅ | ✅ | ❌ |
| Delete project | ✅ | ✅ | ❌ | ❌ |
| Invite anggota / ubah role / hapus anggota | ✅ | ✅ | ❌ | ❌ |
| Ubah nama team | ✅ | ✅ | ❌ | ❌ |
| Hapus team | ✅ | ❌ | ❌ | ❌ |
| Hapus/diturunkan owner | ❌ | ❌ | ❌ | ❌ |
| Kirim pesan chat team (HTTP + WS) | ✅ | ✅ | ✅ | ✅* |
| Checkout/upgrade billing Pakasir (`POST /billing/checkout`) | ✅ | ✅ | ❌ | ❌ |
| Connect/disconnect integrasi (GitHub App / GCal) | ✅ | ✅ | ❌ | ❌ |

> **\* Pengecualian produk (ADR-038, audit 2026-08b AUTHZ-1):** viewer **boleh menulis chat team** — chat adalah kanal sosial, bukan project state. Pengecualian ini berlaku untuk `POST /:teamId/messages` (REST) dan `chat:send` (WebSocket). Semua akses tulis lain (state, PRD, template, keys, invite) tetap diblokir untuk viewer.

---

## 3. Skema DB — `002_teams.sql`

```sql
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'editor',
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'pending',   -- pending | accepted | declined
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ADD COLUMN team_id uuid REFERENCES teams(id);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects (team_id);

-- Backfill: tiap owner_id mendapat team "Personal", project lama dipindahkan
-- INSERT INTO teams (name, created_by) SELECT 'Personal', id FROM users;
-- INSERT INTO team_members (team_id, user_id, role)
--   SELECT t.id, u.id, 'owner' FROM users u JOIN teams t ON t.created_by = u.id;
-- UPDATE projects p SET team_id = t.id FROM teams t WHERE t.created_by = p.owner_id;

-- Setelah backfill (dalam migration yang sama):
-- ALTER TABLE projects ALTER COLUMN team_id SET NOT NULL;
-- ALTER TABLE projects DROP COLUMN owner_id;
```

**Catatan implementasi:** backfill dijalankan dengan SQL prosedural (DO block) atau plain SQL di dalam migration — satu statement, jalankan sekali, tidak idempoten.

**Skema kini (di luar `002_teams.sql`, lihat [TDD §3.3](technical-design.md#33-database-postgresql)):** `activity_log` (REST+MCP parity, prune 500/project), `team_messages` (chat, viewer boleh tulis ADR-038), `billing_packages`/`billing_package_prices` + `team_payments` (Pakasir DB-driven, ADR-044/045), `github_installations`/`github_project_repos`/`github_webhook_events`/`github_outbox` (ADR-052), `gcal_*` vault AES-256-GCM + outbox 1m/5m/30m (ADR-059), `oauth_clients`/`oauth_authorization_codes`/`oauth_access_tokens` (ADR-049), `projects.visibility` + `public_tabs` fail-closed (ADR-017/038).

---

## 4. API Server

### 4.1 Baru — `server/src/modules/authorization/application/authz.ts` (dulu `server/src/api/authz.ts`)

- `getProjectWithRole(userId, projectId)` → `{ row, role } | undefined`
  via join `projects ⨝ team_members`.
- `assertRole(role, required)` → `ApiError(403, 'FORBIDDEN')` jika viewer.
- Dipakai REST **dan** MCP (`modules/mcp/application/state-db.ts`).

### 4.2 Baru — `server/src/modules/teams/handlers/teams.routes.ts` (dulu `server/src/api/teams.routes.ts`) (semua `requireAuth`, prefix kini `/api/v1`)

| Method | Path | Role | Keterangan |
|---|---|---|---|
| GET | `/api/v1/teams` | login | Semua team user + `role` user + jumlah member |
| POST | `/api/v1/teams` | login | Buat team; creator jadi `owner` |
| GET | `/api/v1/teams/:teamId` | member | Detail team |
| PATCH | `/api/v1/teams/:teamId` | admin+ | Rename team |
| DELETE | `/api/v1/teams/:teamId` | owner | Hapus team (project ikut terhapus via CASCADE) |
| GET | `/api/v1/teams/:teamId/members` | member | Daftar anggota + role |
| PATCH | `/api/v1/teams/:teamId/members/:userId` | admin+ | Ubah role (owner tidak bisa diturunkan) |
| DELETE | `/api/v1/teams/:teamId/members/:userId` | admin+ | Hapus anggota (owner tidak bisa dihapus) |
| POST | `/api/v1/teams/:teamId/invitations` | admin+ | `{ email, role }` — validasi email terdaftar, bukan member, belum ada invite pending; expire 7 hari |
| GET | `/api/v1/teams/invitations` | login | Undangan pending untuk saya (dengan nama team) |
| POST | `/api/v1/teams/invitations/:invitationId/accept` | login | Terima → insert `team_members` + status `accepted` |
| DELETE | `/api/v1/teams/invitations/:invitationId` | login | Tolak/withdraw (invitee sendiri, atau admin team) |

### 4.3 Ubah — `server/src/modules/projects/handlers/projects.routes.ts` (dulu `server/src/api/projects.routes.ts`)

- `getOwnedProject` → `getProjectWithRole`
- `GET /` → project semua team user, tambah field `teamId`, `role`
- `POST /` → body `{ name, description, teamId }`; pemohon harus member team
- `GET /:id`, `GET /:id/state`, `GET /:id/export` → member mana pun
- `PATCH /:id`, `DELETE /:id`, `PUT /:id/state`, `POST /import` → editor+
- `POST /import` → body bertambah `teamId` untuk restore-ke-proyek-baru
- Granular `/api/v1/projects/:id/{entity}/:entityId` via `entity-router.ts` (ETag + `If-Match` optional → 409); cascade server-side

### 4.4 Ubah — `server/src/modules/mcp/application/state-db.ts` (dulu `server/src/mcp/state-db.ts`)

- `findRow` → join `team_members` (reuse authz)
- `saveState` → tolak viewer (throw `McpError`); auth via OAuth bearer `requireMcpKey` (scope `mcp`/`mcp:read`/`mcp:write`), bukan API key

---

## 5. Frontend (`app/src`)

| File | Perubahan |
|---|---|
| `lib/types.ts` | `Team`, `TeamMember`, `Invitation`, `Project.teamId/role` |
| `lib/api.ts` | Fungsi teams + `createProject(teamId)` |
| `state/teams-context.tsx` | Baru: load teams + pending invites |
| `state/project-context.tsx` | Simpan `role` user di project aktif |
| `features/layout/Sidebar.tsx` | Project dikelompokkan per team + link TeamPage |
| `features/teams/TeamPage.tsx` | Baru: anggota, invite, undangan pending |
| `features/teams/InviteModal.tsx` | Baru |
| `features/dashboard/DashboardPage.tsx` | Badge nama team per kartu |
| `features/dashboard/NewProjectModal.tsx` | Dropdown pilih team |
| `features/project/ProjectPage.tsx` | Viewer: sembunyikan Delete + tombol edit (via `canEdit`); router URL-based (`react-router` v7, ADR-016), bukan `navigation-context` |
| `features/*/RowMenu.tsx` | Kebab standar ≤640px (Issues/Decisions/Tests/Releases/Whiteboard/Labels/Templates) + `stopPropagation`; TemplatesPage icon-only + kebab (ADR-054) |
| `features/billing/*` (`BillingTab`, `PlanLimitModal`, `/billing/:teamId`, `/pricing`) | Plan card + usage meter + upgrade admin-only + riwayat; checkout `{teamId, packageId, priceId}` (ADR-044/045) |
| `features/integrations/*` (GitHub App + GCal) | Connect/disconnect admin-only; mapping repo/project; banner suggest; link retained bergambar "disconnected" (ADR-052/059) |
| `state/navigation-context.tsx` + `Layout.tsx` | View baru `team` |

**UI gating:** semua halaman tab menerima `canEdit` dari project context; tombol New/Edit/Delete disembunyikan saat viewer. **Server tetap penjaga akhir.**

---

## 6. Dokumentasi Terkait

- Update `technical-design.md` §3.3 (tabel DB), §5 (API), §6 (authz)
- Update `roadmap.md` Phase 3 + deferral log
- Update README (fitur + arsitektur)

---

## 7. Verifikasi

1. `npm run build` (app + server) & `npm run lint`
2. Smoke test: user A buat team → buat project → invite email user B → B accept → B lihat semua tab → B viewer ditolak edit (403) → A promosi B ke editor → B bisa edit → MCP key B viewer ditolak `saveState`
3. `npm run db:migrate` berjalan tanpa merusak data lama (backfill)

---

*End of Team Collaboration Design Document.*
