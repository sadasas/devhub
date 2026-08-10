# Team Collaboration Design — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft |
| **Version** | 0.1 |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-10 |
| **Related documents** | [Technical Design](technical-design.md) · [Roadmap](../01-project/roadmap.md) |

---

## 1. Keputusan Terkunci

| No | Keputusan |
|---|---|
| 1 | Model **team/workspace-based**: satu team menaungi banyak project |
| 2 | Invite **by email, hanya user terdaftar**; alur accept/decline (bukan auto-join) |
| 3 | Role: `owner` · `admin` · `editor` · `viewer` (read-only viewer dibutuhkan) |
| 4 | Satu project satu team (tidak ada share lintas team) |
| 5 | MCP keys per-user, akses mengikuti keanggotaan team pemilik key; write tool ditolak untuk viewer |
| 6 | Konflik edit: last-write-wins (`updatedAt` sudah ada); real-time ditunda |
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

---

## 4. API Server

### 4.1 Baru — `server/src/api/authz.ts`

- `getProjectWithRole(userId, projectId)` → `{ row, role } | undefined`
  via join `projects ⨝ team_members`.
- `assertRole(role, required)` → `ApiError(403, 'FORBIDDEN')` jika viewer.
- Dipakai REST **dan** MCP (`mcp/state-db.ts`).

### 4.2 Baru — `server/src/api/teams.routes.ts` (semua `requireAuth`)

| Method | Path | Role | Keterangan |
|---|---|---|---|
| GET | `/api/teams` | login | Semua team user + `role` user + jumlah member |
| POST | `/api/teams` | login | Buat team; creator jadi `owner` |
| GET | `/api/teams/:teamId` | member | Detail team |
| PATCH | `/api/teams/:teamId` | admin+ | Rename team |
| DELETE | `/api/teams/:teamId` | owner | Hapus team (project ikut terhapus via CASCADE) |
| GET | `/api/teams/:teamId/members` | member | Daftar anggota + role |
| PATCH | `/api/teams/:teamId/members/:userId` | admin+ | Ubah role (owner tidak bisa diturunkan) |
| DELETE | `/api/teams/:teamId/members/:userId` | admin+ | Hapus anggota (owner tidak bisa dihapus) |
| POST | `/api/teams/:teamId/invitations` | admin+ | `{ email, role }` — validasi email terdaftar, bukan member, belum ada invite pending; expire 7 hari |
| GET | `/api/teams/invitations` | login | Undangan pending untuk saya (dengan nama team) |
| POST | `/api/teams/invitations/:invitationId/accept` | login | Terima → insert `team_members` + status `accepted` |
| DELETE | `/api/teams/invitations/:invitationId` | login | Tolak/withdraw (invitee sendiri, atau admin team) |

### 4.3 Ubah — `server/src/api/projects.routes.ts`

- `getOwnedProject` → `getProjectWithRole`
- `GET /` → project semua team user, tambah field `teamId`, `role`
- `POST /` → body `{ name, description, teamId }`; pemohon harus member team
- `GET /:id`, `GET /:id/state`, `GET /:id/export` → member mana pun
- `PATCH /:id`, `DELETE /:id`, `PUT /:id/state`, `POST /import` → editor+
- `POST /import` → body bertambah `teamId` untuk restore-ke-proyek-baru

### 4.4 Ubah — `server/src/mcp/state-db.ts`

- `findRow` → join `team_members` (reuse authz)
- `saveState` → tolak viewer (throw `McpError`)

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
| `features/project/ProjectPage.tsx` | Viewer: sembunyikan Delete + tombol edit (via `canEdit`) |
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
