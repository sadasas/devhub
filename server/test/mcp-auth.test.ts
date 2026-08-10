import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { TestAgent } from 'supertest';
import { createApp } from '../src/app.js';
import { resetDb } from './setup.js';

const app = createApp();

const MCP_ACCEPT = 'application/json, text/event-stream';

let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  return `192.0.2.${ipCounter % 255}`;
}

async function register(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .set('X-Forwarded-For', uniqueIp())
    .send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  const cookie = (res.headers['set-cookie'] as unknown as string[] | undefined)?.[0];
  expect(cookie).toBeDefined();
  return cookie!.split(';')[0]!;
}

async function createKey(cookie: string): Promise<string> {
  const res = await request(app)
    .post('/api/keys')
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({});
  expect(res.status).toBe(201);
  return res.body.key as string;
}

async function createProject(cookie: string): Promise<string> {
  const res = await request(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({ name: 'Test project' });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

function mcpCall(key: string, body: unknown): TestAgent {
  const req = request(app)
    .post('/mcp')
    .set('Accept', MCP_ACCEPT)
    .set('X-Forwarded-For', uniqueIp());
  if (key) req.set('Authorization', `Bearer ${key}`);
  return req.send(body);
}

async function toolCall(key: string, name: string, args: Record<string, unknown>) {
  const res = await mcpCall(key, {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: args },
  });
  return res;
}

describe('MCP auth and ownership', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rejects requests without a key', async () => {
    const res = await mcpCall('', {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an invalid key', async () => {
    const res = await mcpCall('devhub_invalid-key', {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a revoked key', async () => {
    const cookie = await register('revoked@test.dev');
    const created = await request(app).post('/api/keys').set('Cookie', cookie).send({});
    const id = created.body.id as string;
    const key = created.body.key as string;

    await request(app).delete(`/api/keys/${id}`).set('Cookie', cookie);

    const res = await mcpCall(key, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });
    expect(res.status).toBe(401);
  });

  it('serves tools with a valid key', async () => {
    const cookie = await register('valid@test.dev');
    const key = await createKey(cookie);
    const res = await mcpCall(key, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });
    expect(res.status).toBe(200);
    const tools = res.body.result?.tools as { name: string }[] | undefined;
    expect(tools?.some((t) => t.name === 'project_state')).toBe(true);
    expect(tools?.some((t) => t.name === 'create_task')).toBe(true);
  });

  it('cannot read another user project', async () => {
    const cookieA = await register('owner@test.dev');
    const projectId = await createProject(cookieA);
    const keyA = await createKey(cookieA);

    const cookieB = await register('other@test.dev');
    const keyB = await createKey(cookieB);

    const res = await toolCall(keyB, 'project_state', { projectId });
    expect(res.status).toBe(200);
    if (res.body.error) {
      expect(res.body.error.message).toContain('Project not found');
    } else {
      expect(res.body.result?.isError).toBe(true);
      expect(JSON.stringify(res.body.result)).toContain('Project not found');
    }
  });

  it('reads and updates own project', async () => {
    const cookie = await register('mine@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const read = await toolCall(key, 'project_state', { projectId });
    expect(read.status).toBe(200);
    expect(read.body.result?.content?.[0]?.text).toContain('"projectId"');

    const create = await toolCall(key, 'create_task', { projectId, title: 'First task' });
    expect(create.status).toBe(200);
    const createdText = create.body.result?.content?.[0]?.text ?? JSON.stringify(create.body);
    expect(createdText).toContain('First task');

    const readAgain = await toolCall(key, 'project_state', { projectId });
    expect(readAgain.body.result?.content?.[0]?.text).toContain('"tasks": 1');
  });

  it('returns a validation error for invalid arguments', async () => {
    const cookie = await register('badargs@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const res = await toolCall(key, 'create_task', { projectId });
    expect(res.status).toBe(200);
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('-32602');
  });

  it('project_state exposes schema and tech stack data', async () => {
    const cookie = await register('schema@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const addTable = await toolCall(key, 'add_table', {
      projectId,
      name: 'users',
      comment: 'App users',
      indexes: ['lower(email)'],
      columns: [
        { name: 'id', type: 'uuid', primaryKey: true },
        { name: 'email', type: 'text', nullable: false },
      ],
    });
    expect(addTable.status).toBe(200);
    const tableText = addTable.body.result?.content?.[0]?.text ?? '';
    expect(tableText).toContain('users');
    expect(tableText).toContain('"columns": 2');

    const addTech = await toolCall(key, 'add_tech', {
      projectId,
      name: 'React',
      version: '19.2.0',
      category: 'frontend',
      status: 'current',
      notes: 'UI library',
    });
    expect(addTech.status).toBe(200);
    expect(addTech.body.result?.content?.[0]?.text).toContain('React');

    const read = await toolCall(key, 'project_state', { projectId });
    const text = read.body.result?.content?.[0]?.text ?? JSON.stringify(read.body);
    expect(text).toContain('"tables": 1');
    expect(text).toContain('"users"');
    expect(text).toContain('"primaryKey": true');
    expect(text).toContain('"React"');
    expect(text).toContain('"category": "frontend"');
    expect(text).toContain('"notes": "UI library"');
  });

  it('add_relation links tables and validates column ids', async () => {
    const cookie = await register('rel@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const t1 = await toolCall(key, 'add_table', {
      projectId,
      name: 'authors',
      columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
    });
    const t1Text = t1.body.result?.content?.[0]?.text ?? '';
    const t1Id = JSON.parse(t1Text).id as string;

    const t2 = await toolCall(key, 'add_table', {
      projectId,
      name: 'books',
      columns: [
        { name: 'id', type: 'uuid', primaryKey: true },
        { name: 'author_id', type: 'uuid' },
      ],
    });
    const t2Text = t2.body.result?.content?.[0]?.text ?? '';
    const t2Id = JSON.parse(t2Text).id as string;

    const read = await toolCall(key, 'project_state', { projectId });
    const tables = JSON.parse(read.body.result?.content?.[0]?.text ?? '').tables as {
      id: string;
      columns: { id: string; name: string }[];
    }[];
    const authors = tables.find((t) => t.id === t1Id);
    const books = tables.find((t) => t.id === t2Id);
    const fromColumnId = authors!.columns.find((c) => c.name === 'id')!.id;
    const toColumnId = books!.columns.find((c) => c.name === 'author_id')!.id;

    const bad = await toolCall(key, 'add_relation', {
      projectId,
      fromTableId: t1Id,
      fromColumnId: '00000000-0000-4000-8000-000000000000',
      toTableId: t2Id,
      toColumnId,
    });
    expect(bad.body.result?.isError).toBe(true);
    expect(bad.body.result?.content?.[0]?.text).toContain('fromColumnId not found');

    const rel = await toolCall(key, 'add_relation', {
      projectId,
      fromTableId: t1Id,
      fromColumnId,
      toTableId: t2Id,
      toColumnId,
      cardinality: '1:N',
      onDelete: 'cascade',
    });
    expect(rel.status).toBe(200);
    expect(rel.body.result?.content?.[0]?.text).toContain('"cardinality": "1:N"');

    const readAgain = await toolCall(key, 'project_state', { projectId });
    expect(readAgain.body.result?.content?.[0]?.text).toContain('"relations": 1');
  });

  it('rejects duplicate table and tech names', async () => {
    const cookie = await register('dup@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    await toolCall(key, 'add_table', { projectId, name: 'users' });
    const dupTable = await toolCall(key, 'add_table', { projectId, name: 'users' });
    expect(dupTable.body.result?.isError).toBe(true);
    expect(dupTable.body.result?.content?.[0]?.text).toContain('already exists');

    await toolCall(key, 'add_tech', { projectId, name: 'React' });
    const dupTech = await toolCall(key, 'add_tech', { projectId, name: 'react' });
    expect(dupTech.body.result?.isError).toBe(true);
    expect(dupTech.body.result?.content?.[0]?.text).toContain('already exists');
  });
});
