import { describe, expect, it } from 'vitest';
import { i18n } from '../../i18n';
import enAccount from '../../i18n/locales/en/account.json';
import idAccount from '../../i18n/locales/id/account.json';
import type { Team } from '../../lib/types';
import { resolveDashboardTeamId, resolveDashboardTeamIdBySlug } from './DashboardPage';

type Dict = Record<string, unknown>;

function leaves(obj: Dict, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) out.push(...leaves(v as Dict, path));
    else out.push(path);
  }
  return out;
}

function get(obj: Dict, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => ((acc as Dict) ?? {})[k], obj);
}

describe('dashboard welcome i18n', () => {
  it('has identical welcome key sets in en and id with non-empty values', () => {
    const en = leaves((enAccount as Dict).dashboard as Dict, 'dashboard');
    const id = leaves((idAccount as Dict).dashboard as Dict, 'dashboard');
    const enWelcome = en.filter((k) => k.startsWith('dashboard.welcome.'));
    const idWelcome = id.filter((k) => k.startsWith('dashboard.welcome.'));
    expect(enWelcome.length).toBeGreaterThan(50);
    expect([...enWelcome].sort()).toEqual([...idWelcome].sort());
    for (const key of enWelcome) {
      const enVal = get(enAccount as unknown as Dict, key);
      const idVal = get(idAccount as unknown as Dict, key);
      expect(typeof enVal, key).toBe('string');
      expect(typeof idVal, key).toBe('string');
      expect((enVal as string).trim().length, key).toBeGreaterThan(0);
      expect((idVal as string).trim().length, key).toBeGreaterThan(0);
    }
  });

  it('resolves welcomeTitle in id without falling back to the english default', async () => {
    await i18n.changeLanguage('id');
    expect(i18n.t('account:dashboard.welcome.title', { name: 'Nrawang' })).toBe('Selamat datang kembali, Nrawang');
    await i18n.changeLanguage('en');
    expect(i18n.t('account:dashboard.welcome.title', { name: 'Nrawang' })).toBe('Welcome back, Nrawang');
  });

  it('pluralizes counts per language', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('account:dashboard.welcome.projects', { count: 1 })).toBe('1 project');
    expect(i18n.t('account:dashboard.welcome.projects', { count: 3 })).toBe('3 projects');
    expect(i18n.t('account:dashboard.welcome.invites', { count: 1 })).toBe('1 team invitation waiting for your decision');
    await i18n.changeLanguage('id');
    expect(i18n.t('account:dashboard.welcome.projects', { count: 1 })).toBe('1 proyek');
    expect(i18n.t('account:dashboard.welcome.invites', { count: 2 })).toBe('2 undangan tim menunggu keputusan Anda');
    await i18n.changeLanguage('en');
  });
});

describe('dashboard team i18n', () => {
  it('has identical team key sets in en and id with non-empty values', () => {
    const en = leaves((enAccount as Dict).dashboard as Dict, 'dashboard');
    const id = leaves((idAccount as Dict).dashboard as Dict, 'dashboard');
    const enTeam = en.filter((k) => k.startsWith('dashboard.team.'));
    const idTeam = id.filter((k) => k.startsWith('dashboard.team.'));
    expect(enTeam.length).toBeGreaterThan(10);
    expect([...enTeam].sort()).toEqual([...idTeam].sort());
    for (const key of enTeam) {
      const enVal = get(enAccount as unknown as Dict, key);
      const idVal = get(idAccount as unknown as Dict, key);
      expect(typeof enVal, key).toBe('string');
      expect(typeof idVal, key).toBe('string');
      expect((enVal as string).trim().length, key).toBeGreaterThan(0);
      expect((idVal as string).trim().length, key).toBeGreaterThan(0);
    }
  });

  it('resolves team tabs per language without fallback', async () => {
    await i18n.changeLanguage('id');
    expect(i18n.t('account:dashboard.team.tabProjects')).toBe('Proyek');
    expect(i18n.t('account:dashboard.team.tabMembers')).toBe('Anggota');
    expect(i18n.t('account:dashboard.team.tabSettings')).toBe('Pengaturan');
    await i18n.changeLanguage('en');
    expect(i18n.t('account:dashboard.team.tabProjects')).toBe('Projects');
    expect(i18n.t('account:dashboard.team.tabMembers')).toBe('Members');
    expect(i18n.t('account:dashboard.team.tabSettings')).toBe('Settings');
  });
});

describe('resolveDashboardTeamId', () => {
  const base: Team = {
    id: 't1',
    name: 'Alpha',
    icon: null,
    slug: 'alpha',
    role: 'owner',
    plan: 'free',
    planPackageName: 'Free',
    memberCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const teams: Team[] = [base, { ...base, id: 't2', name: 'Beta', slug: 'beta', role: 'viewer' }];

  it('prefers a valid ?team param (legacy cross-team honored)', () => {
    expect(resolveDashboardTeamId(teams, 't2', 't1')).toBe('t2');
  });

  it('falls back to a valid lastActive team when ?team is invalid', () => {
    expect(resolveDashboardTeamId(teams, 'nope', 't2')).toBe('t2');
    expect(resolveDashboardTeamId(teams, null, 't2')).toBe('t2');
  });

  it('falls back to teams[0] when neither param nor lastActive is valid', () => {
    expect(resolveDashboardTeamId(teams, null, null)).toBe('t1');
    expect(resolveDashboardTeamId(teams, 'nope', 'stale')).toBe('t1');
  });

  it('returns null for zero teams (onboarding state)', () => {
    expect(resolveDashboardTeamId([], null, null)).toBeNull();
    expect(resolveDashboardTeamId([], 't1', 't1')).toBeNull();
  });
});

describe('resolveDashboardTeamIdBySlug', () => {
  const base: Team = {
    id: 't1',
    name: 'Acme Corp',
    icon: null,
    slug: 'acme-corp',
    role: 'owner',
    plan: 'free',
    planPackageName: 'Free',
    memberCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const teams: Team[] = [base, { ...base, id: 't2', name: 'Beta', slug: 'beta' }];

  it('resolves exact slug case-insensitively', () => {
    expect(resolveDashboardTeamIdBySlug(teams, 'acme-corp')).toBe('t1');
    expect(resolveDashboardTeamIdBySlug(teams, 'ACME-CORP')).toBe('t1');
  });

  it('returns null for unknown or empty slugs (history/404 handled by server)', () => {
    expect(resolveDashboardTeamIdBySlug(teams, 'old-slug')).toBeNull();
    expect(resolveDashboardTeamIdBySlug(teams, null)).toBeNull();
    expect(resolveDashboardTeamIdBySlug(teams, '')).toBeNull();
  });
});
