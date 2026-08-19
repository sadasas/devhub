import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { TestAgent } from 'supertest';
import { app, createKey, createProject, getFirstTeamId, inviteUser, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

const MCP_ACCEPT = 'application/json, text/event-stream';

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
    const created = await request(app).post('/api/v1/keys').set('Cookie', cookie).send({ name: 'x' });
    const id = created.body.id as string;
    const key = created.body.key as string;

    await request(app).delete(`/api/v1/keys/${id}`).set('Cookie', cookie);

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

  it('update_prd edits the PRD and project_state exposes it', async () => {
    const cookie = await register('prd@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const update = await toolCall(key, 'update_prd', {
      projectId,
      purpose: 'Build a task manager',
      goals: 'Ship v1 in Q3',
    });
    expect(update.status).toBe(200);
    const updateText = update.body.result?.content?.[0]?.text ?? JSON.stringify(update.body);
    expect(updateText).toContain('"purpose": "Build a task manager"');
    expect(updateText).toContain('"goals": "Ship v1 in Q3"');
    expect(updateText).toContain('"features": ""');

    const read = await toolCall(key, 'project_state', { projectId });
    const readText = read.body.result?.content?.[0]?.text ?? '';
    expect(readText).toContain('"name"');
    expect(readText).toContain('"prd"');
    expect(readText).toContain('"purpose": "Build a task manager"');
    expect(readText).toContain('"outOfScope": ""');
  });

  it('update_prd preserves untouched sections and clears with empty strings', async () => {
    const cookie = await register('prd2@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    await toolCall(key, 'update_prd', { projectId, scope: 'Web app only' });
    const second = await toolCall(key, 'update_prd', { projectId, features: '', scope: 'Web + mobile' });
    const secondText = second.body.result?.content?.[0]?.text ?? JSON.stringify(second.body);
    expect(secondText).toContain('"features": ""');
    expect(secondText).toContain('"scope": "Web + mobile"');
    expect(secondText).toContain('"purpose": ""');
  });

  it('update_prd rejects a viewer', async () => {
    const ownerCookie = await register('prd-owner@test.dev');
    const teamId = await getFirstTeamId(ownerCookie);
    const projectId = await createProject(ownerCookie, 'Viewer project', teamId);

    const viewerCookie = await register('prd-viewer@test.dev');
    await inviteUser(ownerCookie, viewerCookie, teamId, 'viewer');
    const viewerKey = await createKey(viewerCookie);

    const res = await toolCall(viewerKey, 'update_prd', { projectId, purpose: 'hack' });
    expect(res.status).toBe(200);
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('No write access');
  });

  it('update_prd rejects an unknown project', async () => {
    const cookie = await register('prd3@test.dev');
    const key = await createKey(cookie);

    const res = await toolCall(key, 'update_prd', {
      projectId: '00000000-0000-4000-8000-000000000000',
      purpose: 'x',
    });
    expect(res.status).toBe(200);
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('Project not found');
  });

  it('update_issue changes status, severity and linked task', async () => {
    const cookie = await register('issue@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const created = await toolCall(key, 'add_issue', {
      projectId,
      title: 'Chart crash',
      severity: 'high',
      reproduction: 'Load minute data',
    });
    const issueId = JSON.parse(created.body.result?.content?.[0]?.text ?? '').id as string;

    const task = await toolCall(key, 'create_task', { projectId, title: 'Fix chart' });
    const taskId = JSON.parse(task.body.result?.content?.[0]?.text ?? '').id as string;

    const updated = await toolCall(key, 'update_issue', {
      projectId,
      issueId,
      status: 'resolved',
      severity: 'medium',
      linkedTaskId: taskId,
    });
    expect(updated.status).toBe(200);
    const updatedText = updated.body.result?.content?.[0]?.text ?? JSON.stringify(updated.body);
    expect(updatedText).toContain('"status": "resolved"');
    expect(updatedText).toContain('"severity": "medium"');
    expect(updatedText).toContain(taskId);

    const read = await toolCall(key, 'project_state', { projectId });
    const readText = read.body.result?.content?.[0]?.text ?? '';
    expect(readText).toContain('"issues": 1');
    expect(readText).toContain('"status": "resolved"');
  });

  it('update_issue clears the linked task with null', async () => {
    const cookie = await register('issue2@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const created = await toolCall(key, 'add_issue', { projectId, title: 'Bug A' });
    const issueId = JSON.parse(created.body.result?.content?.[0]?.text ?? '').id as string;
    const task = await toolCall(key, 'create_task', { projectId, title: 'Task A' });
    const taskId = JSON.parse(task.body.result?.content?.[0]?.text ?? '').id as string;

    await toolCall(key, 'update_issue', { projectId, issueId, linkedTaskId: taskId });
    const cleared = await toolCall(key, 'update_issue', { projectId, issueId, linkedTaskId: null });
    const clearedText = cleared.body.result?.content?.[0]?.text ?? JSON.stringify(cleared.body);
    expect(clearedText).toContain('"linkedTaskId": null');
  });

  it('update_issue rejects an unknown issue', async () => {
    const cookie = await register('issue3@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const res = await toolCall(key, 'update_issue', {
      projectId,
      issueId: '00000000-0000-4000-8000-000000000000',
      status: 'resolved',
    });
    expect(res.status).toBe(200);
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('Issue not found');
  });

  it('update_issue rejects an invalid status', async () => {
    const cookie = await register('issue4@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const res = await toolCall(key, 'update_issue', {
      projectId,
      issueId: '00000000-0000-4000-8000-000000000000',
      status: 'invalid',
    });
    expect(res.status).toBe(200);
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('-32602');
  });

  it('add_relation rejects an identical duplicate relation', async () => {
    const cookie = await register('duprel@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const t1 = await toolCall(key, 'add_table', {
      projectId,
      name: 'authors',
      columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
    });
    const t1Id = JSON.parse(t1.body.result?.content?.[0]?.text ?? '').id as string;
    const t2 = await toolCall(key, 'add_table', {
      projectId,
      name: 'books',
      columns: [
        { name: 'id', type: 'uuid', primaryKey: true },
        { name: 'author_id', type: 'uuid' },
      ],
    });
    const t2Id = JSON.parse(t2.body.result?.content?.[0]?.text ?? '').id as string;

    const read = await toolCall(key, 'project_state', { projectId });
    const tables = JSON.parse(read.body.result?.content?.[0]?.text ?? '').tables as {
      id: string;
      columns: { id: string; name: string }[];
    }[];
    const authors = tables.find((t) => t.id === t1Id);
    const books = tables.find((t) => t.id === t2Id);
    const fromColumnId = authors!.columns.find((c) => c.name === 'id')!.id;
    const toColumnId = books!.columns.find((c) => c.name === 'author_id')!.id;

    const first = await toolCall(key, 'add_relation', {
      projectId,
      fromTableId: t1Id,
      fromColumnId,
      toTableId: t2Id,
      toColumnId,
    });
    expect(first.body.result?.isError).not.toBe(true);
    const relationId = JSON.parse(first.body.result?.content?.[0]?.text ?? '').id as string;

    const dup = await toolCall(key, 'add_relation', {
      projectId,
      fromTableId: t1Id,
      fromColumnId,
      toTableId: t2Id,
      toColumnId,
      cardinality: '1:N',
    });
    expect(dup.body.result?.isError).toBe(true);
    expect(dup.body.result?.content?.[0]?.text).toContain('already exists');
    expect(dup.body.result?.content?.[0]?.text).toContain(relationId);

    const readAgain = await toolCall(key, 'project_state', { projectId });
    expect(readAgain.body.result?.content?.[0]?.text).toContain('"relations": 1');
  });

  it('delete_relation removes exactly one relation and rejects unknown ids', async () => {
    const cookie = await register('delrel@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const t1 = await toolCall(key, 'add_table', {
      projectId,
      name: 'authors',
      columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
    });
    const t1Id = JSON.parse(t1.body.result?.content?.[0]?.text ?? '').id as string;
    const t2 = await toolCall(key, 'add_table', {
      projectId,
      name: 'books',
      columns: [
        { name: 'id', type: 'uuid', primaryKey: true },
        { name: 'author_id', type: 'uuid' },
        { name: 'publisher_id', type: 'uuid' },
      ],
    });
    const t2Id = JSON.parse(t2.body.result?.content?.[0]?.text ?? '').id as string;

    const read = await toolCall(key, 'project_state', { projectId });
    const tables = JSON.parse(read.body.result?.content?.[0]?.text ?? '').tables as {
      id: string;
      columns: { id: string; name: string }[];
    }[];
    const authors = tables.find((t) => t.id === t1Id);
    const books = tables.find((t) => t.id === t2Id);
    const fromColumnId = authors!.columns.find((c) => c.name === 'id')!.id;
    const authorToColumnId = books!.columns.find((c) => c.name === 'author_id')!.id;
    const publisherToColumnId = books!.columns.find((c) => c.name === 'publisher_id')!.id;

    const rel1 = await toolCall(key, 'add_relation', {
      projectId,
      fromTableId: t1Id,
      fromColumnId,
      toTableId: t2Id,
      toColumnId: authorToColumnId,
    });
    const rel1Id = JSON.parse(rel1.body.result?.content?.[0]?.text ?? '').id as string;
    const rel2 = await toolCall(key, 'add_relation', {
      projectId,
      fromTableId: t1Id,
      fromColumnId,
      toTableId: t2Id,
      toColumnId: publisherToColumnId,
    });
    const rel2Id = JSON.parse(rel2.body.result?.content?.[0]?.text ?? '').id as string;

    const unknown = await toolCall(key, 'delete_relation', {
      projectId,
      relationId: '00000000-0000-4000-8000-000000000000',
    });
    expect(unknown.body.result?.isError).toBe(true);
    expect(unknown.body.result?.content?.[0]?.text).toContain('Relation not found');

    const del = await toolCall(key, 'delete_relation', { projectId, relationId: rel1Id });
    expect(del.status).toBe(200);
    const delText = del.body.result?.content?.[0]?.text ?? JSON.stringify(del.body);
    expect(delText).toContain('"deleted": true');
    expect(delText).toContain('"remainingRelations": 1');

    const readAgain = await toolCall(key, 'project_state', { projectId });
    const readText = readAgain.body.result?.content?.[0]?.text ?? '';
    expect(readText).toContain('"relations": 1');
    expect(readText).not.toContain(rel1Id);
    expect(readText).toContain(rel2Id);
  });
});
