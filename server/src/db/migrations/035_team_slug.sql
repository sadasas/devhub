-- 035_team_slug: global unique team slug + history table for old-slug redirects.
-- DECISION: history as separate table team_slug_history (not TEXT[] on teams).
-- Rationale: per-rename timeline (created_at), global UNIQUE(slug) so old slugs stay
-- reserved for other teams and can redirect, indexed lookup without scanning teams,
-- no unbounded array growth on the hot row. Reclaiming own old slug deletes that
-- history row in the same txn as the teams.slug UPDATE (see teamService.renameTeamSlug).
-- Keep RESERVED list in sync with server/src/modules/teams/domain/slug.ts.

ALTER TABLE teams ADD COLUMN IF NOT EXISTS slug text;

CREATE TABLE IF NOT EXISTS team_slug_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  r RECORD;
  v_base text;
  v_candidate text;
  v_suffix text;
  v_trunc text;
  v_n int;
  v_reserved text[] := ARRAY[
    'about','account','accounts','activity','admin','api','assets','auth','billing','blog',
    'chat','connected','create','dashboard','delete','demo','dev','devhub','docs','edit',
    'favicon','forgot-password','health','help','home','invite','invites','invitations','join',
    'keys','leave','login','logout','manifest','mcp','members','new','notifications','null',
    'oauth','org','organization','p','payments','pricing','prod','profile','project','projects',
    'public','reset-password','robots','root','search','settings','sitemap','staging','static',
    'status','support','team','teams','templates','test','trial','undefined','usage','user',
    'users','verify','well-known','workspace','workspaces'
  ];
BEGIN
  FOR r IN SELECT id, name FROM teams WHERE slug IS NULL ORDER BY created_at ASC, id ASC LOOP
    -- Slugify name: lower, runs of non-alphanumerics -> '-', trim hyphens, cap 48.
    v_base := lower(regexp_replace(COALESCE(r.name, ''), '[^a-z0-9]+', '-', 'g'));
    v_base := trim(both '-' from v_base);
    IF length(v_base) > 48 THEN
      v_base := substring(v_base from 1 for 48);
      v_base := trim(both '-' from v_base);
    END IF;
    -- Fallback team-xxxx when empty, too short (<3), or reserved.
    IF v_base IS NULL OR v_base = '' OR length(v_base) < 3 OR v_base = ANY(v_reserved) THEN
      v_base := 'team-' || substring(replace(r.id::text, '-', '') from 1 for 4);
      v_base := lower(v_base);
    END IF;
    -- Deduplicate with -2, -3, ... against already-backfilled rows.
    v_candidate := v_base;
    v_n := 2;
    LOOP
      EXIT WHEN NOT EXISTS (SELECT 1 FROM teams WHERE slug = v_candidate);
      v_suffix := '-' || v_n::text;
      v_trunc := substring(v_base from 1 for (48 - length(v_suffix)));
      v_trunc := trim(trailing '-' from v_trunc);
      IF v_trunc = '' THEN
        v_trunc := 'team';
      END IF;
      v_candidate := v_trunc || v_suffix;
      v_n := v_n + 1;
      -- Safety guard against pathological loops.
      IF v_n > 10000 THEN
        RAISE EXCEPTION 'slug backfill loop exceeded for team %', r.id;
      END IF;
    END LOOP;
    UPDATE teams SET slug = v_candidate, updated_at = now() WHERE id = r.id;
  END LOOP;
END $$;

-- Enforce NOT NULL + global uniqueness only after backfill completes.
ALTER TABLE teams ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_teams_slug') THEN
    CREATE UNIQUE INDEX uq_teams_slug ON teams (slug);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_team_slug_history_slug') THEN
    CREATE UNIQUE INDEX uq_team_slug_history_slug ON team_slug_history (slug);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_team_slug_history_team_id') THEN
    CREATE INDEX idx_team_slug_history_team_id ON team_slug_history (team_id);
  END IF;
END $$;
