import type { ExportDocument, Project, State, User } from './types';

const API_BASE: string = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers,
      ...init,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?');
  }

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const err = (
      body as {
        error?: { code?: string; message?: string; details?: unknown };
      } | null
    )?.error;
    throw new ApiError(res.status, err?.code ?? 'INTERNAL', err?.message ?? res.statusText, err?.details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ id: string; email: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<User>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<User>('/auth/me'),

  listProjects: async () => {
    const res = await request<{ projects: Project[] }>('/projects');
    return res.projects;
  },
  createProject: (name: string, description: string) =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),
  getProject: (projectId: string) => request<Project>(`/projects/${encodeURIComponent(projectId)}`),
  patchProject: (
    projectId: string,
    patch: Partial<Pick<Project, 'name' | 'description' | 'status'>>,
  ) =>
    request<Project>(`/projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteProject: (projectId: string) =>
    request<void>(`/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' }),

  getState: async (projectId: string) => {
    const res = await request<{ state: State }>(`/projects/${encodeURIComponent(projectId)}/state`);
    return res.state;
  },
  putState: (projectId: string, state: State) =>
    request<{ ok: true }>(`/projects/${encodeURIComponent(projectId)}/state`, {
      method: 'PUT',
      body: JSON.stringify({ state }),
    }),
  exportProject: (projectId: string) =>
    request<ExportDocument>(`/projects/${encodeURIComponent(projectId)}/export`),
  importProject: (doc: ExportDocument) =>
    request<{ restored: boolean; projectId: string }>('/projects/import', {
      method: 'POST',
      body: JSON.stringify(doc),
    }),
};
