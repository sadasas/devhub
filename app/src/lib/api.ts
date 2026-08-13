import type {
  Invitation,
  McpKey,
  McpKeyCreated,
  Project,
  PublicProject,
  State,
  Team,
  TeamInvitation,
  TeamMember,
  TeamRole,
  User,
} from './types';
import type { ProjectStats } from './stats';
import type { ExportDocument } from './types';

const API_BASE: string = import.meta.env.VITE_API_URL ?? '/api';
const REQUEST_TIMEOUT_MS = 15_000;

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

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
  const { headers: initHeaders, signal: initSignal, ...rest } = init ?? {};
  const headers = new Headers(initHeaders);
  if (rest.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  if (initSignal) {
    if (initSignal.aborted) controller.abort();
    else initSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers,
      ...rest,
      signal: controller.signal,
    });
  } catch {
    if (timedOut) throw new ApiError(0, 'TIMEOUT', 'Request timed out');
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const err = (
      body as {
        error?: { code?: string; message?: string; details?: unknown };
      } | null
    )?.error;
    if (res.status === 401 && !path.startsWith('/auth/')) {
      unauthorizedHandler?.();
    }
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
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  updateProfile: (patch: Partial<Pick<User, 'displayName' | 'bio'>>) =>
    request<User>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  listProjects: async () => {
    const res = await request<{ projects: Project[] }>('/projects');
    return res.projects;
  },
  createProject: (name: string, description: string, teamId: string) =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description, teamId }),
    }),
  getProject: (projectId: string) => request<Project>(`/projects/${encodeURIComponent(projectId)}`),
  projectStats: async () => {
    const res = await request<{ projects: Array<{ projectId: string } & ProjectStats> }>('/projects/stats');
    return res.projects;
  },
  patchProject: (
    projectId: string,
    patch: Partial<Pick<Project, 'name' | 'description' | 'status' | 'visibility' | 'prd'>>,
  ) =>
    request<Project>(`/projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteProject: (projectId: string) =>
    request<void>(`/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' }),

  exportProjectDoc: (projectId: string) =>
    request<ExportDocument>(`/projects/${encodeURIComponent(projectId)}/export`),
  importProjectDoc: (doc: ExportDocument) =>
    request<{ projectId: string; restored: boolean }>('/projects/import', {
      method: 'POST',
      body: JSON.stringify(doc),
    }),

  getState: async (projectId: string) => {
    const res = await request<{ state: State; version: number }>(
      `/projects/${encodeURIComponent(projectId)}/state`,
    );
    return { state: res.state, version: res.version };
  },
  putState: (projectId: string, state: State, version: number, keepalive = false) =>
    request<{ ok: true; version: number }>(`/projects/${encodeURIComponent(projectId)}/state`, {
      method: 'PUT',
      body: JSON.stringify({ state, version }),
      keepalive,
    }),

  getPublicProject: async (projectId: string) => {
    const res = await request<{ project: PublicProject }>(
      `/public/projects/${encodeURIComponent(projectId)}`,
    );
    return res.project;
  },
  getPublicState: async (projectId: string) => {
    const res = await request<{ state: State; version: number }>(
      `/public/projects/${encodeURIComponent(projectId)}/state`,
    );
    return { state: res.state, version: res.version };
  },

  listKeys: async () => {
    const res = await request<{ keys: McpKey[] }>('/keys');
    return res.keys;
  },
  createKey: (name?: string) =>
    request<McpKeyCreated>('/keys', {
      method: 'POST',
      body: JSON.stringify({ name: name ?? '' }),
    }),
  revokeKey: (keyId: string) =>
    request<{ ok: true }>(`/keys/${encodeURIComponent(keyId)}`, { method: 'DELETE' }),

  listTeams: async () => {
    const res = await request<{ teams: Team[] }>('/teams');
    return res.teams;
  },
  createTeam: (name: string) =>
    request<{ team: Team }>('/teams', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }).then((r) => r.team),
  renameTeam: (teamId: string, name: string) =>
    request<{ ok: true }>(`/teams/${encodeURIComponent(teamId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  deleteTeam: (teamId: string) =>
    request<{ ok: true }>(`/teams/${encodeURIComponent(teamId)}`, { method: 'DELETE' }),
  listMembers: async (teamId: string) => {
    const res = await request<{ members: TeamMember[] }>(
      `/teams/${encodeURIComponent(teamId)}/members`,
    );
    return res.members;
  },
  setMemberRole: (teamId: string, userId: string, role: TeamRole) =>
    request<{ ok: true }>(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  removeMember: (teamId: string, userId: string) =>
    request<{ ok: true }>(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }),
  inviteMember: (teamId: string, email: string, role: Exclude<TeamRole, 'owner'>) =>
    request<{ ok: true }>(`/teams/${encodeURIComponent(teamId)}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  listInvitations: async () => {
    const res = await request<{ invitations: Invitation[] }>('/teams/invitations');
    return res.invitations;
  },
  listTeamInvitations: async (teamId: string) => {
    const res = await request<{ invitations: TeamInvitation[] }>(
      `/teams/${encodeURIComponent(teamId)}/invitations`,
    );
    return res.invitations;
  },
  acceptInvitation: (teamId: string, invitationId: string) =>
    request<{ ok: true; teamId: string; teamName: string }>(
      `/teams/${encodeURIComponent(teamId)}/invitations/${encodeURIComponent(invitationId)}/accept`,
      { method: 'POST' },
    ),
  declineInvitation: (teamId: string, invitationId: string) =>
    request<{ ok: true }>(
      `/teams/${encodeURIComponent(teamId)}/invitations/${encodeURIComponent(invitationId)}`,
      { method: 'DELETE' },
    ),
};
