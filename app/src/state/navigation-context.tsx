import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type View =
  | { name: 'dashboard' }
  | { name: 'project'; projectId: string }
  | { name: 'keys' }
  | { name: 'mcp' };

interface NavigationContextValue {
  view: View;
  openDashboard: () => void;
  openProject: (projectId: string) => void;
  openKeys: () => void;
  openMcpGuide: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>({ name: 'dashboard' });

  const openDashboard = useCallback(() => setView({ name: 'dashboard' }), []);
  const openProject = useCallback((projectId: string) => setView({ name: 'project', projectId }), []);
  const openKeys = useCallback(() => setView({ name: 'keys' }), []);
  const openMcpGuide = useCallback(() => setView({ name: 'mcp' }), []);

  const value = useMemo(
    () => ({ view, openDashboard, openProject, openKeys, openMcpGuide }),
    [view, openDashboard, openProject, openKeys, openMcpGuide],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}
