import { request } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = process.env.E2E_TEST_DB ?? 'postgres://devhub:devhub@localhost:5433/devhub_test';
const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3100';
const OWNER_EMAIL = `owner-${Date.now()}@e2e.devhub.test`;
const OWNER_PASSWORD = 'E2ePassw0rd!';

function uniqueIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 250) + 2}`;
}

function parseSetCookie(header: string) {
  const [pair, ...attrs] = header.split(';');
  const eq = pair.indexOf('=');
  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  const cookie: Record<string, unknown> = {
    name,
    value,
    domain: 'localhost',
    path: '/',
    expires: -1,
    httpOnly: attrs.some((a) => a.trim().toLowerCase() === 'httponly'),
    secure: attrs.some((a) => a.trim().toLowerCase() === 'secure'),
    sameSite: 'Lax',
  };
  const maxAge = attrs.find((a) => a.trim().toLowerCase().startsWith('max-age='));
  if (maxAge) {
    cookie.expires = Math.floor(Date.now() / 1000) + Number(maxAge.split('=')[1]);
  }
  return cookie;
}

export default async function globalSetup(): Promise<void> {
  const pool = new pg.Pool({ connectionString: TEST_DB });
  try {
    await pool.query('TRUNCATE mcp_keys, projects, users RESTART IDENTITY CASCADE');
  } finally {
    await pool.end();
  }

  const ctx = await request.newContext({ baseURL: API_BASE });
  const res = await ctx.post('/api/v1/auth/register', {
    headers: { 'X-Forwarded-For': uniqueIp() },
    data: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`globalSetup: register failed (${res.status()}): ${await res.text()}`);
  }
  const cookies = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => parseSetCookie(h.value));
  if (cookies.length === 0) {
    throw new Error('globalSetup: no session cookie received');
  }
  await ctx.dispose();

  const authDir = path.join(HERE, '.auth');
  mkdirSync(authDir, { recursive: true });
  writeFileSync(
    path.join(authDir, 'owner.json'),
    JSON.stringify({ cookies, origins: [] }, null, 2),
  );
}
