-- Hardening: CHECK constraints, unique key hashes, optimistic locking, JWT versioning
-- Audit 2026-08 (docs/04-audit-server-2026-08.md)

-- 1. mcp_keys.key_hash must be unique (audit S5: require-key memakai rows[0] dari query ambigu)
--    Dedupe dulu: pertahankan baris terlama, hapus duplikatnya.
DELETE FROM mcp_keys a
USING mcp_keys b
WHERE a.key_hash = b.key_hash AND a.created_at > b.created_at;

CREATE UNIQUE INDEX uq_mcp_keys_key_hash ON mcp_keys (key_hash);

-- 2. Optimistic locking untuk PUT state (audit S2): setiap penulisan menaikkan versi
ALTER TABLE projects ADD COLUMN version integer NOT NULL DEFAULT 1;

-- 3. JWT versioning (audit S10): bump saat ganti password untuk invalidasi sesi lain
ALTER TABLE users ADD COLUMN jwt_version integer NOT NULL DEFAULT 1;

-- 4. CHECK constraints — integritas role/status tidak hanya di layer app (audit S5)
ALTER TABLE team_members
  ADD CONSTRAINT chk_team_members_role CHECK (role IN ('owner', 'admin', 'editor', 'viewer'));

ALTER TABLE invitations
  ADD CONSTRAINT chk_invitations_role CHECK (role IN ('admin', 'editor', 'viewer'));

ALTER TABLE projects
  ADD CONSTRAINT chk_projects_status CHECK (status IN ('active', 'archived'));

ALTER TABLE projects
  ADD CONSTRAINT chk_projects_visibility CHECK (visibility IN ('private', 'public'));
