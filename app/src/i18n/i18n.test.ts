import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectInitialLanguage, FALLBACK_LANG, i18n, LANG_STORAGE_KEY } from './index';

function resetStorage() {
  localStorage.removeItem(LANG_STORAGE_KEY);
}

describe('i18n', () => {
  beforeEach(() => {
    resetStorage();
    document.documentElement.lang = '';
  });

  afterEach(() => {
    void i18n.changeLanguage(FALLBACK_LANG);
  });

  describe('detectInitialLanguage', () => {
    it('returns stored language when valid', () => {
      localStorage.setItem(LANG_STORAGE_KEY, 'id');
      expect(detectInitialLanguage()).toBe('id');
    });

    it('ignores invalid stored value and falls back', () => {
      localStorage.setItem(LANG_STORAGE_KEY, 'fr');
      expect(detectInitialLanguage()).toBe(FALLBACK_LANG);
    });

    it('detects Indonesian browser language', () => {
      const original = navigator.language;
      Object.defineProperty(window, 'navigator', {
        value: { ...navigator, language: 'id-ID' },
        writable: true,
      });
      expect(detectInitialLanguage()).toBe('id');
      Object.defineProperty(window, 'navigator', {
        value: { ...navigator, language: original },
        writable: true,
      });
    });

    it('falls back to en for non-Indonesian browsers without stored value', () => {
      expect(detectInitialLanguage()).toBe(FALLBACK_LANG);
    });
  });

  describe('init', () => {
    it('initializes with fallback en and resolves common namespace keys', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.t('language.toggle')).toBe('Change language');
    });

    it('translates keys in id locale', async () => {
      await i18n.changeLanguage('id');
      expect(i18n.t('language.toggle')).toBe('Ganti bahasa');
      expect(i18n.t('language.switchTo', { name: 'English' })).toBe('Ganti ke English');
    });

    it('falls back to en for missing id keys', async () => {
      await i18n.changeLanguage('id');
      expect(i18n.t('language.menu')).toBe('Bahasa');
    });
  });
});
