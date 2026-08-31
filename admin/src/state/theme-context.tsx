import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { detectInitialTheme, THEME_KEY, type ResolvedTheme, type ThemePref } from '../lib/theme';

interface ThemeContextValue {
  pref: ThemePref;
  resolved: ResolvedTheme;
  setTheme: (pref: ThemePref) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#f4f4f5' : '#0a0a0c');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => detectInitialTheme());
  const [systemLight, setSystemLight] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  });

  const resolved: ResolvedTheme = useMemo(() => {
    if (pref === 'light' || pref === 'dark') return pref;
    return systemLight ? 'light' : 'dark';
  }, [pref, systemLight]);

  const setTheme = useCallback((next: ThemePref) => {
    setPrefState(next);
    try {
      if (next === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    applyTheme(resolved);
    try {
      if (pref === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, pref);
    } catch {}
  }, [pref, resolved]);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      const isLight = 'matches' in e ? e.matches : mql.matches;
      setSystemLight(isLight);
    };
    // Safari <14 fallback
    if (mql.addEventListener) mql.addEventListener('change', handler as (e: MediaQueryListEvent) => void);
    else (mql as unknown as { addListener: (cb: () => void) => void }).addListener(() => handler(mql));
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler as (e: MediaQueryListEvent) => void);
      else (mql as unknown as { removeListener: (cb: () => void) => void }).removeListener(() => handler(mql));
    };
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return;
      const next = e.newValue as ThemePref | null;
      if (next === 'light' || next === 'dark' || next === 'system' || next === null) {
        setPrefState(next ?? 'system');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const value = useMemo(() => ({ pref, resolved, setTheme }), [pref, resolved, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
