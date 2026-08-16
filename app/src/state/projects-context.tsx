import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { isNetworkError } from '../lib/idb-provider';
import { getMeta, putMeta } from '../lib/idb';
import type { Project, PublicTab } from '../lib/types';

interface ProjectsContextValue {
  projects: Project[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (name: string, description: string, teamId: string) => Promise<Project>;
  update: (
    projectId: string,
    patch: Partial<Pick<Project, 'name' | 'description' | 'status' | 'visibility' | 'prd'> & { publicTabs: PublicTab[] }>,
  ) => Promise<Project>;
  remove: (projectId: string) => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await api.listProjects();
      setProjects(list);
      setError(null);
      void putMeta('projects', list).catch(() => { /* best-effort cache */ });
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await getMeta<Project[]>('projects').catch(() => undefined);
        if (cached) {
          setProjects(cached);
          setError(null);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load projects');
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (name: string, description: string, teamId: string) => {
      const project = await api.createProject(name, description, teamId);
      setProjects((prev) => (prev ? [...prev, project] : [project]));
      return project;
    },
    [],
  );

  const remove = useCallback(async (projectId: string) => {
    await api.deleteProject(projectId);
    setProjects((prev) => (prev ? prev.filter((p) => p.id !== projectId) : prev));
  }, []);

  const update = useCallback(
    async (
      projectId: string,
      patch: Partial<Pick<Project, 'name' | 'description' | 'status' | 'visibility' | 'prd'> & { publicTabs: PublicTab[] }>,
    ) => {
      const project = await api.patchProject(projectId, patch);
      setProjects((prev) =>
        prev ? prev.map((p) => (p.id === projectId ? project : p)) : prev,
      );
      return project;
    },
    [],
  );

  const value = useMemo(
    () => ({ projects, loading, error, refresh, create, update, remove }),
    [projects, loading, error, refresh, create, update, remove],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider');
  return ctx;
}
