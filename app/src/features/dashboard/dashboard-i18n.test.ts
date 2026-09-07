import { describe, expect, it } from 'vitest';
import { i18n } from '../../i18n';
import enAccount from '../../i18n/locales/en/account.json';
import idAccount from '../../i18n/locales/id/account.json';

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
