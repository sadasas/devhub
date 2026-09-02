import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setUnauthorizedHandler } from '../lib/api';
import { isNetworkError } from '../lib/idb-provider';
import { clearAllMeta, deleteMeta, getMeta, putMeta } from '../lib/idb';
import type { User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((u) => {
        if (!cancelled) {
          setUser(u);
          void putMeta('user', u).catch(() => { /* best-effort cache */ });
        }
      })
      .catch((err) => {
        /* not authenticated — fine; offline — bootstrap from cache */
        if (!cancelled && isNetworkError(err)) {
          void getMeta<User>('user')
            .then((cached) => {
              if (!cancelled && cached) setUser(cached);
            })
            .catch(() => { /* no cached session */ });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      void deleteMeta('user').catch(() => {});
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await api.login(email, password);
    const u = await api.me();
    setUser(u);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await api.register(email, password);
    const u = await api.me();
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      try { await clearAllMeta(); } catch {
        try { await deleteMeta('user'); } catch { /* ignore */ }
      }
      try {
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch { /* ignore */ }
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, setUser }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useOptionalAuth(): { user: User | null } {
  const ctx = useContext(AuthContext);
  return { user: ctx?.user ?? null };
}
