// Team slug helpers — client mirror of server/src/modules/teams/domain/slug.ts.
// Keep RESERVED_TEAM_SLUGS + format rules in sync manually (coding-standards §3).

export const TEAM_SLUG_MIN_LENGTH = 3;
export const TEAM_SLUG_MAX_LENGTH = 48;

export const TEAM_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  'well-known',
  'workspace',
  'workspaces',
]);

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

export function buildFallbackTeamSlug(): string {
  let rand = '';
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  try {
    const buf = new Uint32Array(4);
    globalThis.crypto?.getRandomValues(buf);
    for (let i = 0; i < 4; i += 1) {
      rand += alphabet[(buf[i] ?? 0) % 36];
    }
  } catch {
    for (let i = 0; i < 4; i += 1) {
      rand += alphabet[Math.floor(Math.random() * 36)];
    }
  }
  if (rand.length < 4) rand = `${rand}xxxx`.slice(0, 4);
  return `team-${rand}`;
}

// Static route segments that must never be treated as a team slug.
// Used by Layout to derive team context from /:slug/... URLs.
export const STATIC_ROUTE_SEGMENTS: ReadonlySet<string> = new Set([
  'project',
  'p',
  'team',
  'billing',
  'invites',
  'connected',
  'keys',
  'templates',
  'profile',
  'docs',
  'pricing',
  'payments',
  'reset-password',
  'verify-email',
]);
