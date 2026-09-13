/**
 * Zero-team route guard decision (pure, unit-tested).
 * Used by Layout: users without any team bounce off team-scoped pages.
 * Allowlist: the onboarding page itself (`/`), invitation accepts
 * (`/invites`), and account settings (`/profile`, team-independent).
 * Loading (`teams === null`) and logged-out always render normally.
 */
export type TeamlessRoute = 'allow' | 'toHome' | 'toInvites';

const TEAMLESS_OK = new Set(['/', '/invites', '/profile']);

export function resolveTeamlessRedirect(opts: {
  userPresent: boolean;
  teams: readonly unknown[] | null;
  invitationCount: number;
  pathname: string;
}): TeamlessRoute {
  if (!opts.userPresent) return 'allow';
  if (opts.teams === null) return 'allow';
  if (opts.teams.length > 0) return 'allow';
  if (TEAMLESS_OK.has(opts.pathname)) return 'allow';
  if (opts.invitationCount > 0) return 'toInvites';
  return 'toHome';
}
