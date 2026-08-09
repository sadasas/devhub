import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type View = { name: 'dashboard' } | { name: 'project'; projectId: string };

interface NavigationContextValue {
  view: View;
  openDashboard: () => void;
  openProject: (projectId: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>({ name: 'dashboard' });

  const openDashboard = useCallback(() => setView({ name: 'dashboard' }), []);
  const openProject = useCallback((projectId: string) => setView({ name: 'project', projectId }), []);

  const value = useMemo(() => ({ view, openDashboard, openProject }), [view, openDashboard, openProject]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}
