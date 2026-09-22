// Team slug domain — pure helpers + reserved list (no express/pg).
// Decision: history lives in separate table team_slug_history (see 035_team_slug.sql),
// not a TEXT[] array on teams. Rationale: per-rename timeline (created_at),
// global UNIQUE(slug) reservation for redirects, indexed lookup without scanning
// the hot teams row, and clean reclaim of own old slugs in the same txn.

export const TEAM_SLUG_MIN_LENGTH = 3;
export const TEAM_SLUG_MAX_LENGTH = 48;

export const TEAM_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Globally reserved slugs: static app routes (App.tsx), API prefixes, and
// common single-word collisions. Final list lives here — keep the client
// mirror (app/src/lib/team-slug.ts) and migration 035 in sync.
export const RESERVED_TEAM_SLUGS: ReadonlySet<string> = new Set([
  'about',
  'account',
  'accounts',
  'activity',
  'admin',
  'api',
  'assets',
  'auth',
  'billing',
  'blog',
  'chat',
  'connected',
  'create',
  'dashboard',
  'delete',
  'demo',
  'dev',
  'devhub',
  'docs',
  'edit',
  'favicon',
  'forgot-password',
  'health',
  'help',
  'home',
  'invite',
  'invites',
  'invitations',
  'join',
  'keys',
  'leave',
  'login',
  'logout',
  'manifest',
  'mcp',
  'members',
  'new',
  'notifications',
  'null',
  'oauth',
  'org',
  'organization',
  'p',
  'payments',
  'pricing',
  'prod',
  'profile',
  'project',
  'projects',
  'public',
  'reset-password',
  'robots',
  'root',
  'search',
  'settings',
  'sitemap',
  'staging',
  'static',
  'status',
  'support',
  'team',
  'teams',
  'templates',
  'test',
  'trial',
  'undefined',
  'usage',
  'user',
  'users',
  'verify',
  'verify-email',
  'check-email',
  'well-known',
  'workspace',
  'workspaces',
]);

// Lowercase, replace runs of non-alphanumerics with a single hyphen,
// trim leading/trailing hyphens, cap at max length (re-trim after cut).
// Returns '' when nothing slug-safe remains — caller applies team-xxxx fallback.
export function slugifyTeamName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) return '';
  const truncated =
    slug.length > TEAM_SLUG_MAX_LENGTH ? slug.slice(0, TEAM_SLUG_MAX_LENGTH) : slug;
  return truncated.replace(/-+$/g, '');
}

export function normalizeTeamSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidTeamSlugFormat(slug: string): boolean {
  if (slug.length < TEAM_SLUG_MIN_LENGTH || slug.length > TEAM_SLUG_MAX_LENGTH) return false;
  return TEAM_SLUG_RE.test(slug);
}

export function isReservedTeamSlug(slug: string): boolean {
  return RESERVED_TEAM_SLUGS.has(slug.toLowerCase());
}

// Fallback pattern team-xxxx (spec): 4 hex chars from the team id when
// available, otherwise 4 random chars. Always valid format + never reserved
// (reserved set holds bare "team", not "team-xxxx").
export function buildFallbackTeamSlug(sourceId?: string): string {
  const clean = (sourceId ?? '').replace(/-/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.length >= 4) return `team-${clean.slice(0, 4)}`;
  let rand = '';
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  // crypto.getRandomValues is available in Node 22 + browsers; fall back to Math.random.
  try {
    const buf = new Uint32Array(4);
    (globalThis.crypto?.getRandomValues as ((a: Uint32Array) => void) | undefined)?.(buf);
    for (let i = 0; i < 4; i += 1) {
      rand += alphabet[(buf[i] ?? Math.floor(Math.random() * 36)) % 36];
    }
  } catch {
    for (let i = 0; i < 4; i += 1) {
      rand += alphabet[Math.floor(Math.random() * 36)];
    }
  }
  if (rand.length < 4) rand = `${rand}xxxx`.slice(0, 4);
  return `team-${rand}`;
}

// Truncate a base slug so base + suffix still fits the max length.
export function truncateForSuffix(base: string, suffix: string): string {
  const maxBase = TEAM_SLUG_MAX_LENGTH - suffix.length;
  if (base.length <= maxBase) return base;
  return base.slice(0, Math.max(1, maxBase)).replace(/-+$/g, '');
}
