import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import idCommon from './locales/id/common.json';
import enShell from './locales/en/shell.json';
import idShell from './locales/id/shell.json';
import enAccount from './locales/en/account.json';
import idAccount from './locales/id/account.json';
import enTracker from './locales/en/tracker.json';
import idTracker from './locales/id/tracker.json';
import enProject from './locales/en/project.json';
import idProject from './locales/id/project.json';
import enExtras from './locales/en/extras.json';
import idExtras from './locales/id/extras.json';

export const LANG_STORAGE_KEY = 'devhub.lang';
export const FALLBACK_LANG: AppLanguage = 'en';

export type AppLanguage = 'en' | 'id';
export type AppNamespace = 'common';

export function detectInitialLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'en' || stored === 'id') return stored;
  } catch {
    /* storage unavailable */
  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('id')) {
    return 'id';
  }
  return FALLBACK_LANG;
}

export const i18n = i18next.createInstance();

export const i18nInit: Promise<unknown> = i18n
  .use(initReactI18next)
  .init({
  lng: detectInitialLanguage(),
  fallbackLng: FALLBACK_LANG,
  defaultNS: 'common',
  resources: {
    en: { common: enCommon, shell: enShell, account: enAccount, tracker: enTracker, project: enProject, extras: enExtras },
    id: { common: idCommon, shell: idShell, account: idAccount, tracker: idTracker, project: idProject, extras: idExtras },
  },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.resolvedLanguage ?? FALLBACK_LANG;
}
