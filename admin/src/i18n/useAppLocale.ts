import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from './index';
import { LANG_STORAGE_KEY } from './index';

export const LANGUAGES: readonly { code: AppLanguage; nativeName: string }[] = [
  { code: 'en', nativeName: 'English' },
  { code: 'id', nativeName: 'Bahasa Indonesia' },
];

export function useAppLocale() {
  const { i18n: instance } = useTranslation();
  const lang: AppLanguage = instance.resolvedLanguage === 'id' ? 'id' : 'en';
  const setLang = useCallback(
    (next: AppLanguage) => {
      if (!LANGUAGES.some((l) => l.code === next)) return;
      void instance.changeLanguage(next);
      try {
        localStorage.setItem(LANG_STORAGE_KEY, next);
      } catch {
        /* storage unavailable */
      }
      document.documentElement.lang = next;
    },
    [instance],
  );
  return { lang, setLang };
}
