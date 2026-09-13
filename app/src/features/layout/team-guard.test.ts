import { describe, expect, it } from 'vitest';
import { resolveTeamlessRedirect } from './team-guard';

describe('resolveTeamlessRedirect', () => {
  it('allows while teams are loading', () => {
    expect(resolveTeamlessRedirect({ userPresent: true, teams: null, invitationCount: 0, pathname: '/pricing' })).toBe('allow');
  });
  it('allows logged-out visitors', () => {
    expect(resolveTeamlessRedirect({ userPresent: false, teams: [], invitationCount: 0, pathname: '/pricing' })).toBe('allow');
  });
  it('allows users that have a team anywhere', () => {
    expect(resolveTeamlessRedirect({ userPresent: true, teams: [{}], invitationCount: 0, pathname: '/pricing' })).toBe('allow');
  });
  it('allows the onboarding page, invites, and profile without a team', () => {
    for (const pathname of ['/', '/invites', '/profile']) {
      expect(resolveTeamlessRedirect({ userPresent: true, teams: [], invitationCount: 0, pathname })).toBe('allow');
    }
  });
  it('sends invitees to /invites from guarded pages', () => {
    expect(resolveTeamlessRedirect({ userPresent: true, teams: [], invitationCount: 2, pathname: '/pricing' })).toBe('toInvites');
    expect(resolveTeamlessRedirect({ userPresent: true, teams: [], invitationCount: 1, pathname: '/some-team/projects' })).toBe('toInvites');
  });
  it('sends teamless users without invites home', () => {
    expect(resolveTeamlessRedirect({ userPresent: true, teams: [], invitationCount: 0, pathname: '/pricing' })).toBe('toHome');
    expect(resolveTeamlessRedirect({ userPresent: true, teams: [], invitationCount: 0, pathname: '/project/abc' })).toBe('toHome');
  });
});
