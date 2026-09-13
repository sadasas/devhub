import { describe, expect, it } from 'vitest';
import {
  buildFallbackTeamSlug,
  isReservedTeamSlug,
  isValidTeamSlugFormat,
  normalizeTeamSlug,
  slugifyTeamName,
} from './team-slug';

describe('team-slug helpers', () => {
  it('validates format (length, charset, hyphens)', () => {
    expect(isValidTeamSlugFormat('acme')).toBe(true);
    expect(isValidTeamSlugFormat('acme-corp-2')).toBe(true);
    expect(isValidTeamSlugFormat('ab')).toBe(false);
    expect(isValidTeamSlugFormat('-acme')).toBe(false);
    expect(isValidTeamSlugFormat('acme-')).toBe(false);
    expect(isValidTeamSlugFormat('acme--corp')).toBe(false);
    expect(isValidTeamSlugFormat('Acme')).toBe(false);
    expect(isValidTeamSlugFormat('acme_corp')).toBe(false);
    expect(isValidTeamSlugFormat('a'.repeat(49))).toBe(false);
  });

  it('slugifies names', () => {
    expect(slugifyTeamName('Acme Corp!')).toBe('acme-corp');
    expect(slugifyTeamName('  ---  ')).toBe('');
    expect(normalizeTeamSlug('  Acme-Corp ')).toBe('acme-corp');
  });

  it('reserves static words', () => {
    for (const w of [
      'invites',
      'docs',
      'pricing',
      'payments',
      'profile',
      'templates',
      'connected',
      'billing',
      'api',
      'p',
      'team',
      'settings',
      'members',
      'projects',
      'admin',
    ]) {
      expect(isReservedTeamSlug(w)).toBe(true);
    }
    expect(isReservedTeamSlug('acme')).toBe(false);
  });

  it('builds team-xxxx fallback', () => {
    expect(buildFallbackTeamSlug()).toMatch(/^team-[a-z0-9]{4}$/);
  });
});
