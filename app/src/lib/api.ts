import type {
  ActivityUnreadSummary,
  BillingPackage,
  BillingStatus,
  ChatMessage,
  ChatRef,
  ChatResolvedRef,
  Invitation,
  McpKeyList,
  McpKeyCreated,
  PaymentHistoryItem,
  Project,
  ProjectTemplate,
  PublicProject,
  PublicTab,
  State,
  Team,
  TeamInvitation,
  TeamMember,
  TeamRole,
  User,
  UserStats,
} from './types';
import type { ProjectStats } from './stats';
import type { ExportDocument } from './types';

const API_BASE: string = import.meta.env.VITE_API_URL ?? '/api/v1';
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

export type GranularEntity =
  | 'tasks'
  | 'issues'
  | 'testCases'
  | 'techEntries'
  | 'tables'
  | 'relations'
  | 'schemaVersions'
  | 'decisions'
  | 'milestones'
  | 'apiCollections'
  | 'apiEndpoints'
  | 'whiteboards';

export type GranularEntityRecord = Record<string, unknown> & { id: string };

export interface SearchHit {
  entity: GranularEntity;
  entityId: string;
  title: string;
  field: string;
  snippet: string;
  score: number;
}

export interface ProjectSearchResult {
  projectId: string;
  projectName: string;
  hits: SearchHit[];
}

export type ActivityAction = 'created' | 'updated' | 'deleted';

export interface ActivityEntry {
  id: string;
  projectId: string;
  entity: GranularEntity;
  entityId: string;
  action: ActivityAction;
  authorId: string | null;
  authorName: string;
  summary: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  createdAt: string;
}

interface EntityListResult {
  items: GranularEntityRecord[];
  nextCursor: string | null;
  version: number;
}

export interface EntityResult {
  entity: GranularEntityRecord;
  version: number;
}

function entityPath(projectId: string, entity: GranularEntity, entityId?: string): string {
  const base = `/projects/${encodeURIComponent(projectId)}/${entity}`;
  return entityId ? `${base}/${encodeURIComponent(entityId)}` : base;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ id: string; email: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    // Server hanya mengirim {id, email}; profil lengkap via /auth/me (audit 2026-08b, CLIENT-3)
    request<{ id: string; email: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<User>('/auth/me'),
  getProviders: () =>
    request<{ providers: { id: string; enabled: boolean }[]; google: boolean; github: boolean }>('/auth/providers'),
  getLinked: () =>
    request<{ linked: { provider: string; provider_account_id: string; email: string | null; avatar_url: string | null; created_at: string }[] }>(
      '/auth/linked',
    ),
  unlinkProvider: (provider: string) =>
    request<{ ok: true }>(`/auth/linked/${encodeURIComponent(provider)}`, { method: 'DELETE' }),
  forgotPassword: (email: string) =>
    request<{ ok: true; message: string; token?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ ok: true }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
  changePassword: (currentPassword: string | null | undefined, newPassword: string) =>
    request<{ ok: true }>('/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword: currentPassword ?? '', newPassword }),
    }),
  updateProfile: (patch: Partial<Pick<User, 'displayName' | 'bio'>>) =>
    request<User>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  meStats: () => request<UserStats>('/auth/me/stats'),

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
  projectDailyStats: async (days = 7) => {
    const res = await request<{ days: Array<{ date: string; created: number; done: number }> }>(`/projects/stats/daily?days=${days}`);
    return res.days;
  },
  projectNextUp: async (limit = 3) => {
    const res = await request<{ tasks: Array<{ projectId: string; projectName: string; taskId: string; title: string; dueDate: string; priority: string; status: string }> }>(
      `/projects/stats/next-up?limit=${limit}`,
    );
    return res.tasks;
  },
  patchProject: (
    projectId: string,
    patch: Partial<Pick<Project, 'name' | 'description' | 'status' | 'visibility' | 'prd'> & { publicTabs: PublicTab[] }>,
  ) =>
    request<Project>(`/projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteProject: (projectId: string) =>
    request<void>(`/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' }),
  patchTimelineOrder: (projectId: string, timelineOrder: Record<string, string[]>, version?: number) =>
    request<{ ok: true; version: number }>(`/projects/${encodeURIComponent(projectId)}/timeline-order`, {
      method: 'PATCH',
      body: JSON.stringify({ timelineOrder }),
      headers: version !== undefined ? { 'If-Match': `"${version}"` } : undefined,
    }),

  exportProjectDoc: (projectId: string) =>
    request<ExportDocument>(`/projects/${encodeURIComponent(projectId)}/export`),
  importProjectDoc: (doc: ExportDocument) =>
    request<{ projectId: string; restored: boolean }>('/projects/import', {
      method: 'POST',
      body: JSON.stringify(doc),
    }),

  saveTemplate: (projectId: string, name: string, description: string) =>
    request<{ template: ProjectTemplate }>('/templates', {
      method: 'POST',
      body: JSON.stringify({ projectId, name, description }),
    }).then((r) => r.template),
  listTemplates: async () => {
    const res = await request<{ templates: ProjectTemplate[] }>('/templates');
    return res.templates;
  },
  getTemplate: async (templateId: string) => {
    // Server mengembalikan state DI DALAM template (audit 2026-08b, CLIENT-1)
    const res = await request<{ template: ProjectTemplate & { state: State } }>(
      `/templates/${encodeURIComponent(templateId)}`,
    );
    return res;
  },
  deleteTemplate: (templateId: string) =>
    request<{ ok: true }>(`/templates/${encodeURIComponent(templateId)}`, {
      method: 'DELETE',
    }),
  instantiateTemplate: (templateId: string, name?: string, description?: string) =>
    request<{ projectId: string }>(`/templates/${encodeURIComponent(templateId)}/instantiate`, {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  getState: async (projectId: string) => {
    const res = await request<{ state: State; version: number }>(
      `/projects/${encodeURIComponent(projectId)}/state`,
    );
    return { state: res.state, version: res.version };
  },
  listEntities: async (
    projectId: string,
    entity: GranularEntity,
    cursor?: { after?: string; limit?: number },
  ): Promise<EntityListResult> => {
    const qs = new URLSearchParams();
    if (cursor?.after) qs.set('after', cursor.after);
    if (cursor?.limit) qs.set('limit', String(cursor.limit));
    const suffix = qs.size > 0 ? `?${qs.toString()}` : '';
    return request<EntityListResult>(`${entityPath(projectId, entity)}${suffix}`);
  },
  createEntity: (
    projectId: string,
    entity: GranularEntity,
    payload: Record<string, unknown>,
  ) => request<EntityResult>(entityPath(projectId, entity), { method: 'POST', body: JSON.stringify(payload) }),
  getEntity: (projectId: string, entity: GranularEntity, entityId: string) =>
    request<EntityResult>(entityPath(projectId, entity, entityId)),
  patchEntity: (
    projectId: string,
    entity: GranularEntity,
    entityId: string,
    payload: Record<string, unknown>,
    version?: number,
    keepalive = false,
  ) =>
    request<EntityResult>(entityPath(projectId, entity, entityId), {
      method: 'PATCH',
      body: JSON.stringify(payload),
      headers: version !== undefined ? { 'If-Match': `"${version}"` } : undefined,
      keepalive,
    }),
  deleteEntity: (
    projectId: string,
    entity: GranularEntity,
    entityId: string,
    version?: number,
    keepalive = false,
  ) =>
    request<{ ok: true; version: number }>(entityPath(projectId, entity, entityId), {
      method: 'DELETE',
      headers: version !== undefined ? { 'If-Match': `"${version}"` } : undefined,
      keepalive,
    }),

  search: async (q: string, signal?: AbortSignal, limit?: number) => {
    const qs = new URLSearchParams({ q });
    if (limit !== undefined) qs.set('limit', String(limit));
    const res = await request<{ results: ProjectSearchResult[] }>(`/search?${qs.toString()}`, {
      signal,
    });
    return res.results;
  },

  fetchActivity: async (
    projectId: string,
    opts?: { entity?: GranularEntity; entityId?: string; authorId?: string; limit?: number },
  ) => {
    const qs = new URLSearchParams();
    if (opts?.entity) qs.set('entity', opts.entity);
    if (opts?.entityId) qs.set('entityId', opts.entityId);
    if (opts?.authorId) qs.set('authorId', opts.authorId);
    if (opts?.limit !== undefined) qs.set('limit', String(opts.limit));
    const suffix = qs.size > 0 ? `?${qs.toString()}` : '';
    const res = await request<{ items: ActivityEntry[] }>(
      `/projects/${encodeURIComponent(projectId)}/activity${suffix}`,
    );
    return res.items;
  },

  /** Badge unread server-side (ADR M32) — agregat SQL vs watermark di DB. */
  fetchActivityUnread: (projectId: string) =>
    request<ActivityUnreadSummary>(`/projects/${encodeURIComponent(projectId)}/activity/unread`),

  fetchActivityUnreadBatch: (projectIds: string[]) =>
    request<{ summaries: Record<string, ActivityUnreadSummary> }>('/projects/activity/unread/batch', {
      method: 'POST',
      body: JSON.stringify({ projectIds }),
    }),

  /** Tandai tab sudah dibaca; server yang menulis timestamp now(). */
  setTabReadWatermark: (projectId: string, tab: string) =>
    request<{ ok: true }>(
      `/projects/${encodeURIComponent(projectId)}/read-watermarks/${encodeURIComponent(tab)}`,
      { method: 'PUT' },
    ),

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

  listKeys: async (opts: { page?: number; perPage?: number } = {}) => {
    const qs = new URLSearchParams();
    if (opts.page !== undefined) qs.set('page', String(opts.page));
    if (opts.perPage !== undefined) qs.set('perPage', String(opts.perPage));
    const suffix = qs.size > 0 ? `?${qs.toString()}` : '';
    const res = await request<McpKeyList>(`/keys${suffix}`);
    return res;
  },
  createKey: (name: string) =>
    request<McpKeyCreated>('/keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  revokeKey: (keyId: string) =>
    request<{ ok: true }>(`/keys/${encodeURIComponent(keyId)}`, { method: 'DELETE' }),
  revealKey: async (keyId: string) => {
    const res = await request<{ key: string }>(`/keys/${encodeURIComponent(keyId)}/reveal`);
    return res.key;
  },

  authorizedApps: () =>
    request<{ apps: Array<{ clientId: string; clientName: string; redirectUris: string[]; scope: string; resource: string; tokenPrefix: string; expiresAt: string; createdAt: string }>; total: number }>('/oauth/authorized-apps'),
  revokeAuthorizedApp: (clientId: string) =>
    request<{ ok: true; revoked: number }>(`/oauth/authorized-apps/${encodeURIComponent(clientId)}`, { method: 'DELETE' }),

  listTeams: async () => {
    const res = await request<{ teams: Team[] }>('/teams');
    return res.teams;
  },
  createTeam: (name: string, icon?: string | null) =>
    request<{ team: Team }>('/teams', {
      method: 'POST',
      body: JSON.stringify({ name, ...(icon !== undefined ? { icon } : {}) }),
    }).then((r) => r.team),
  renameTeam: (teamId: string, name: string, icon?: string | null) =>
    request<{ ok: true }>(`/teams/${encodeURIComponent(teamId)}`, {
      method: 'PATCH',
      body: JSON.stringify(icon !== undefined ? { name, icon } : { name }),
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
  listMessages: async (
    teamId: string,
    opts: { limit?: number; before?: string; beforeId?: string } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts.before) params.set('before', opts.before);
    if (opts.beforeId) params.set('beforeId', opts.beforeId);
    const qs = params.toString();
    const res = await request<{
      messages: ChatMessage[];
      nextCursor: string | null;
      nextCursorId?: string | null;
    }>(`/teams/${encodeURIComponent(teamId)}/messages${qs ? `?${qs}` : ''}`);
    return res;
  },
  sendMessage: async (teamId: string, content: string, refs: ChatRef[] = []) => {
    const res = await request<{ message: ChatMessage }>(
      `/teams/${encodeURIComponent(teamId)}/messages`,
      { method: 'POST', body: JSON.stringify({ content, refs }) },
    );
    return res.message;
  },
  resolveChatRefs: async (teamId: string, refs: ChatRef[]) => {
    const res = await request<{ refs: ChatResolvedRef[] }>(
      `/teams/${encodeURIComponent(teamId)}/messages/resolve-refs`,
      { method: 'POST', body: JSON.stringify({ refs }) },
    );
    return res.refs;
  },
  deleteMessage: (teamId: string, messageId: string) =>
    request<{ ok: true }>(
      `/teams/${encodeURIComponent(teamId)}/messages/${encodeURIComponent(messageId)}`,
      { method: 'DELETE' },
    ),
  setMessagesRead: (teamId: string, lastReadAt: string) =>
    request<{ ok: true }>(`/teams/${encodeURIComponent(teamId)}/messages/read`, {
      method: 'PUT',
      body: JSON.stringify({ lastReadAt }),
    }),
  getUnreadCount: async (teamId: string) => {
    const res = await request<{ unread: number }>(
      `/teams/${encodeURIComponent(teamId)}/messages/unread`,
    );
    return res.unread;
  },

  startCheckout: (teamId: string, packageId: string, priceId: string) =>
    request<{ orderId: string; url: string; amount: number; packageName: string; durationDays: number }>(
      '/billing/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ teamId, packageId, priceId }),
      },
    ),
  resumePayment: (orderId: string) =>
    request<{ url: string }>(`/billing/resume/${encodeURIComponent(orderId)}`),
  cancelPayment: (orderId: string) =>
    request<{ ok: boolean }>(`/billing/cancel/${encodeURIComponent(orderId)}`, { method: 'POST' }),
  listPackages: () => request<{ packages: BillingPackage[] }>('/billing/packages'),
  billingStatus: (teamId: string) =>
    request<BillingStatus>(`/billing/status/${encodeURIComponent(teamId)}`),
  paymentHistory: () => request<{ payments: PaymentHistoryItem[] }>('/billing/payments'),
  getPayment: (orderId: string) =>
    request<{ payment: PaymentHistoryItem }>(`/billing/payments/${encodeURIComponent(orderId)}`),
};
