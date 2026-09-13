import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { isNetworkError } from '../lib/idb-provider';
import { getMeta, putMeta } from '../lib/idb';
import type { Invitation, Team, TeamRole } from '../lib/types';

interface TeamsContextValue {
  teams: Team[] | null;
  invitations: Invitation[];
  loading: boolean;
  error: string | null;
  loadError: unknown;
  refresh: () => Promise<void>;
  createTeam: (name: string, icon?: string | null, slug?: string) => Promise<Team>;
  renameTeam: (teamId: string, name: string, icon?: string | null) => Promise<void>;
  renameSlug: (teamId: string, slug: string) => Promise<Team>;
  deleteTeam: (teamId: string) => Promise<void>;
  inviteMember: (teamId: string, email: string, role: Exclude<TeamRole, 'owner'>) => Promise<void>;
  acceptInvitation: (teamId: string, invitationId: string) => Promise<void>;
  declineInvitation: (teamId: string, invitationId: string) => Promise<void>;
}

const TeamsContext = createContext<TeamsContextValue | null>(null);

export function TeamsProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    try {
      const [teamList, inviteList] = await Promise.all([api.listTeams(), api.listInvitations()]);
      setTeams(teamList);
      setInvitations(inviteList);
      setError(null);
      setLoadError(null);
      void putMeta('teams', teamList).catch(() => { /* best-effort cache */ });
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await getMeta<Team[]>('teams').catch(() => undefined);
        if (cached) {
          setTeams(cached);
          setError(null);
      setLoadError(null);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load teams');
        setLoadError(err);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load teams');
        setLoadError(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTeam = useCallback(
    async (name: string, icon?: string | null, slug?: string) => {
      const team = await api.createTeam(name, icon ?? null, slug?.trim() ? slug.trim() : undefined);
      setTeams((prev) => (prev ? [...prev, team] : [team]));
      return team;
    },
    [],
  );

  const renameSlug = useCallback(async (teamId: string, slug: string) => {
    const team = await api.renameTeamSlug(teamId, slug);
    setTeams((prev) => (prev ? prev.map((t) => (t.id === teamId ? team : t)) : prev));
    return team;
  }, []);

  const renameTeam = useCallback(
    async (teamId: string, name: string, icon?: string | null) => {
      await api.renameTeam(teamId, name, icon);
      setTeams((prev) =>
        prev
          ? prev.map((t) => (t.id === teamId ? { ...t, name, ...(icon !== undefined ? { icon } : {}) } : t))
          : prev,
      );
    },
    [],
  );

  const deleteTeam = useCallback(async (teamId: string) => {
    await api.deleteTeam(teamId);
    setTeams((prev) => (prev ? prev.filter((t) => t.id !== teamId) : prev));
  }, []);

  const inviteMember = useCallback(async (teamId: string, email: string, role: Exclude<TeamRole, 'owner'>) => {
    await api.inviteMember(teamId, email, role);
  }, []);

  const acceptInvitation = useCallback(
    async (teamId: string, invitationId: string) => {
      await api.acceptInvitation(teamId, invitationId);
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      await refresh();
    },
    [refresh],
  );

  const declineInvitation = useCallback(async (teamId: string, invitationId: string) => {
    await api.declineInvitation(teamId, invitationId);
    setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
  }, []);

  const value = useMemo(
    () => ({
      teams,
      invitations,
      loading,
      error,
      loadError,
      refresh,
      createTeam,
      renameTeam,
      renameSlug,
      deleteTeam,
      inviteMember,
      acceptInvitation,
      declineInvitation,
    }),
    [
      teams,
      invitations,
      loading,
      error,
      loadError,
      refresh,
      createTeam,
      renameTeam,
      renameSlug,
      deleteTeam,
      inviteMember,
      acceptInvitation,
      declineInvitation,
    ],
  );

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
}

export function useTeams(): TeamsContextValue {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error('useTeams must be used within TeamsProvider');
  return ctx;
}
