import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type View =
  | { name: 'dashboard' }
  | { name: 'project'; projectId: string }
  | { name: 'team'; teamId: string }
  | { name: 'invites' }
  | { name: 'keys' }
  | { name: 'mcp' };

interface NavigationContextValue {
  view: View;
  openDashboard: () => void;
  openProject: (projectId: string) => void;
  openTeam: (teamId: string) => void;
  openInvites: () => void;
  openKeys: () => void;
  openMcpGuide: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>({ name: 'dashboard' });

  const openDashboard = useCallback(() => setView({ name: 'dashboard' }), []);
  const openProject = useCallback((projectId: string) => setView({ name: 'project', projectId }), []);
  const openTeam = useCallback((teamId: string) => setView({ name: 'team', teamId }), []);
  const openInvites = useCallback(() => setView({ name: 'invites' }), []);
  const openKeys = useCallback(() => setView({ name: 'keys' }), []);
  const openMcpGuide = useCallback(() => setView({ name: 'mcp' }), []);

  const value = useMemo(
    () => ({ view, openDashboard, openProject, openTeam, openInvites, openKeys, openMcpGuide }),
    [view, openDashboard, openProject, openTeam, openInvites, openKeys, openMcpGuide],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}
