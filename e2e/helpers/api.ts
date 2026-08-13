import { request, type APIRequestContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3100';
const OWNER_STATE = path.join(HERE, '..', '.auth', 'owner.json');

export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function uniqueEmail(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.devhub.test`;
}

export function uniqueIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 250) + 2}`;
}

export async function ownerContext(): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_BASE,
    storageState: OWNER_STATE,
    extraHTTPHeaders: { 'X-Forwarded-For': uniqueIp() },
  });
}

export async function getTeamId(ctx: APIRequestContext): Promise<string> {
  const res = await ctx.get('/api/v1/teams');
  if (!res.ok()) throw new Error(`getTeamId failed (${res.status()}): ${await res.text()}`);
  const body = (await res.json()) as { teams: { id: string }[] };
  const team = body.teams[0];
  if (!team) throw new Error('getTeamId: no team found');
  return team.id;
}

export async function getProjectVersion(ctx: APIRequestContext, projectId: string): Promise<number> {
  const res = await ctx.get(`/api/v1/projects/${projectId}/state`);
  if (!res.ok()) throw new Error(`getProjectVersion failed (${res.status()}): ${await res.text()}`);
  const body = (await res.json()) as { version: number };
  return body.version;
}

export async function createProject(
  ctx: APIRequestContext,
  teamId: string,
  name: string,
  description = '',
): Promise<string> {
  const res = await ctx.post('/api/v1/projects', { data: { name, description, teamId } });
  if (!res.ok()) throw new Error(`createProject failed (${res.status()}): ${await res.text()}`);
  const body = (await res.json()) as { id: string };
  return body.id;
}

export async function addEntity<T>(
  ctx: APIRequestContext,
  projectId: string,
  key: string,
  payload: Record<string, unknown>,
): Promise<{ entity: T; version: number }> {
  const res = await ctx.post(`/api/v1/projects/${projectId}/${key}`, { data: payload });
  if (!res.ok()) throw new Error(`addEntity ${key} failed (${res.status()}): ${await res.text()}`);
  const body = (await res.json()) as { entity: T; version: number };
  return body;
}

export async function patchEntity<T>(
  ctx: APIRequestContext,
  projectId: string,
  key: string,
  entityId: string,
  patch: Record<string, unknown>,
): Promise<{ entity: T; version: number }> {
  const version = await getProjectVersion(ctx, projectId);
  const res = await ctx.patch(`/api/v1/projects/${projectId}/${key}/${entityId}`, {
    headers: { 'If-Match': String(version) },
    data: patch,
  });
  if (!res.ok()) throw new Error(`patchEntity ${key} failed (${res.status()}): ${await res.text()}`);
  const body = (await res.json()) as { entity: T; version: number };
  return body;
}

export async function deleteEntity(
  ctx: APIRequestContext,
  projectId: string,
  key: string,
  entityId: string,
): Promise<void> {
  const version = await getProjectVersion(ctx, projectId);
  const res = await ctx.delete(`/api/v1/projects/${projectId}/${key}/${entityId}`, {
    headers: { 'If-Match': String(version) },
  });
  if (!res.ok()) throw new Error(`deleteEntity ${key} failed (${res.status()}): ${await res.text()}`);
}

export async function registerUser(
  ctx: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const res = await ctx.post('/api/v1/auth/register', {
    headers: { 'X-Forwarded-For': uniqueIp() },
    data: { email, password },
  });
  if (!res.ok()) throw new Error(`registerUser failed (${res.status()}): ${await res.text()}`);
  const cookies = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value.split(';')[0]);
  return cookies.join('; ');
}
