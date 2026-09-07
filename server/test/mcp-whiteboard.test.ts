import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { TestAgent } from 'supertest';
import { app, createKey, createProject, getFirstTeamId, inviteUser, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

const MCP_ACCEPT = 'application/json, text/event-stream';
const API = '/api/v1';

function mcpCall(key: string, body: unknown): TestAgent {
  const req = request(app)
    .post('/mcp')
    .set('Accept', MCP_ACCEPT)
    .set('X-Forwarded-For', uniqueIp());
  if (key) req.set('Authorization', `Bearer ${key}`);
  return req.send(body);
}

async function toolCall(key: string, name: string, args: Record<string, unknown>) {
  return mcpCall(key, {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: args },
  });
}

async function toolText(key: string, name: string, args: Record<string, unknown>): Promise<string> {
  const res = await toolCall(key, name, args);
  expect(res.status).toBe(200);
  return (res.body.result?.content?.[0]?.text ?? '') as string;
}

async function fetchState(cookie: string, projectId: string) {
  const res = await request(app)
    .get(`${API}/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(res.status).toBe(200);
  return res.body.state as {
    whiteboards: Array<{ id: string; name: string; description: string; elements: Array<{ id: string; kind: string }> }>;
  };
}

const STICKY = { kind: 'sticky', x: 0, y: 0, w: 200, h: 120, color: '#e8b955', text: 'Architecture' };
const TEXT_EL = { kind: 'text', x: 0, y: 200, color: '#e4e4e7', fontSize: 16, text: 'Layer' };
const EDGE_EL = {
  kind: 'edge',
  x1: 0,
  y1: 150,
  x2: 200,
  y2: 150,
  color: '#8b5cf6',
  width: 2,
  arrowhead: true,
  arrowStyle: 'solid',
  dash: 'dashed',
  label: 'flow',
  sourceNodeId: null,
  targetNodeId: null,
};

describe('MCP whiteboard tools', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lists the whiteboard tools over MCP', async () => {
    const cookie = await register('wb-tools@test.dev');
    const key = await createKey(cookie);
    const res = await mcpCall(key, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });
    expect(res.status).toBe(200);
    const tools = res.body.result?.tools as { name: string }[] | undefined;
    expect(tools?.some((t) => t.name === 'create_whiteboard')).toBe(true);
    expect(tools?.some((t) => t.name === 'update_whiteboard')).toBe(true);
  });

  it('creates a board with elements and assigns ids to id-less elements', async () => {
    const cookie = await register('wb-create@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const text = await toolText(key, 'create_whiteboard', {
      projectId,
      name: 'Architecture',
      description: 'Layer map',
      elements: [STICKY, TEXT_EL, EDGE_EL],
    });
    const result = JSON.parse(text) as { id: string; name: string; elementCount: number };
    expect(result.name).toBe('Architecture');
    expect(result.elementCount).toBe(3);

    const state = await fetchState(cookie, projectId);
    expect(state.whiteboards).toHaveLength(1);
    const board = state.whiteboards[0]!;
    expect(board.id).toBe(result.id);
    expect(board.description).toBe('Layer map');
    expect(board.elements).toHaveLength(3);
    for (const el of board.elements) {
      expect(el.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    }
    const kinds = board.elements.map((e) => e.kind).sort();
    expect(kinds).toEqual(['edge', 'sticky', 'text']);
  });

  it('creates a board without elements (empty canvas)', async () => {
    const cookie = await register('wb-empty@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const text = await toolText(key, 'create_whiteboard', { projectId, name: 'Blank' });
    const result = JSON.parse(text) as { elementCount: number };
    expect(result.elementCount).toBe(0);

    const state = await fetchState(cookie, projectId);
    expect(state.whiteboards[0]?.name).toBe('Blank');
    expect(state.whiteboards[0]?.elements).toEqual([]);
  });

  it('rejects a 51st board (fifty per project cap)', async () => {
    const cookie = await register('wb-cap@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    for (let i = 1; i <= 50; i += 1) {
      await toolCall(key, 'create_whiteboard', { projectId, name: `Board ${i}` });
    }
    const fiftyFirst = await toolCall(key, 'create_whiteboard', { projectId, name: 'Board 51' });
    expect(fiftyFirst.body.result?.isError).toBe(true);
    expect(fiftyFirst.body.result?.content?.[0]?.text).toContain('Whiteboard limit reached');
  });

  it('rejects more than 1000 elements', async () => {
    const cookie = await register('wb-1000@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const elements = [...Array(1001)].map((_, i) => ({ ...TEXT_EL, text: `x${i}` }));
    const res = await toolCall(key, 'create_whiteboard', { projectId, name: 'Burst', elements });
    expect(res.body.result?.isError).toBe(true);
    expect(JSON.stringify(res.body.result)).toContain('elements');
  });

  it('rejects malformed elements with a clear message', async () => {
    const cookie = await register('wb-bad@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const res = await toolCall(key, 'create_whiteboard', {
      projectId,
      name: 'Bad',
      elements: [{ kind: 'sticky', text: 'missing x and w' }],
    });
    expect(res.body.result?.isError).toBe(true);
    const message = res.body.result?.content?.[0]?.text as string;
    expect(message).toContain('Invalid whiteboard elements');
  });

  it('updates name and description while preserving elements', async () => {
    const cookie = await register('wb-rename@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const created = await toolText(key, 'create_whiteboard', {
      projectId,
      name: 'Draft',
      elements: [STICKY],
    });
    const boardId = (JSON.parse(created) as { id: string }).id;

    const updated = await toolText(key, 'update_whiteboard', {
      projectId,
      whiteboardId: boardId,
      name: 'Final',
      description: 'Shipped',
    });
    expect(JSON.parse(updated)).toMatchObject({ name: 'Final', elementCount: 1 });

    const state = await fetchState(cookie, projectId);
    const board = state.whiteboards[0]!;
    expect(board.name).toBe('Final');
    expect(board.description).toBe('Shipped');
    expect(board.elements).toHaveLength(1);
    expect(board.elements[0]?.kind).toBe('sticky');
  });

  it('replaces elements wholesale on update', async () => {
    const cookie = await register('wb-replace@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const created = await toolText(key, 'create_whiteboard', {
      projectId,
      name: 'Draft',
      elements: [STICKY, TEXT_EL],
    });
    const boardId = (JSON.parse(created) as { id: string }).id;

    await toolText(key, 'update_whiteboard', {
      projectId,
      whiteboardId: boardId,
      elements: [EDGE_EL],
    });

    const state = await fetchState(cookie, projectId);
    expect(state.whiteboards[0]?.elements).toHaveLength(1);
    expect(state.whiteboards[0]?.elements[0]?.kind).toBe('edge');
    expect(state.whiteboards[0]?.elements[0]).toMatchObject({ dash: 'dashed', arrowStyle: 'solid' });
  });

  it('does not log a no-op update', async () => {
    const cookie = await register('wb-noop@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const created = await toolText(key, 'create_whiteboard', { projectId, name: 'Same' });
    const boardId = (JSON.parse(created) as { id: string }).id;

    await toolText(key, 'update_whiteboard', { projectId, whiteboardId: boardId, name: 'Same' });

    const activityRes = await request(app)
      .get(`${API}/projects/${projectId}/activity`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    const items = activityRes.body.items as Array<{ entity: string; action: string }>;
    expect(items.filter((i) => i.entity === 'whiteboards' && i.action === 'updated')).toHaveLength(0);
    expect(items.filter((i) => i.entity === 'whiteboards' && i.action === 'created')).toHaveLength(1);
  });

  it('rejects an unknown board id', async () => {
    const cookie = await register('wb-unknown@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const res = await toolCall(key, 'update_whiteboard', {
      projectId,
      whiteboardId: '00000000-0000-4000-8000-000000000000',
      name: 'X',
    });
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('Whiteboard not found');
  });

  it('rejects a viewer writing to the project', async () => {
    const ownerCookie = await register('wb-owner@test.dev');
    const teamId = await getFirstTeamId(ownerCookie);
    const projectId = await createProject(ownerCookie, 'Viewer board project', teamId);

    const viewerCookie = await register('wb-viewer@test.dev');
    await inviteUser(ownerCookie, viewerCookie, teamId, 'viewer');
    const viewerKey = await createKey(viewerCookie);

    const res = await toolCall(viewerKey, 'create_whiteboard', { projectId, name: 'Nope' });
    expect(res.status).toBe(200);
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('No write access');
  });

  it('WB-10: patch adds, updates and deletes elements granularly', async () => {
    const cookie = await register('wb-patch@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const created = await toolText(key, 'create_whiteboard', {
      projectId,
      name: 'Patch me',
      elements: [STICKY, TEXT_EL],
    });
    const boardId = (JSON.parse(created) as { id: string }).id;
    const before = await fetchState(cookie, projectId);
    const stickyId = before.whiteboards[0]!.elements.find((e) => e.kind === 'sticky')!.id;
    const textId = before.whiteboards[0]!.elements.find((e) => e.kind === 'text')!.id;

    const patched = await toolText(key, 'patch_whiteboard', {
      projectId,
      whiteboardId: boardId,
      add: [{ ...TEXT_EL, text: 'appended' }],
      update: [{ id: stickyId, patch: { text: 'renamed' } }],
      delete: [textId],
    });
    expect(JSON.parse(patched)).toMatchObject({ added: 1, updated: 1, deleted: 1, elementCount: 2 });

    const after = await fetchState(cookie, projectId);
    const texts = after.whiteboards[0]!.elements.map((e) => (e as { text?: string }).text).sort();
    expect(texts).toEqual(['appended', 'renamed']);
  });

  it('WB-10: patch cascades incident edges when a node is deleted', async () => {
    const cookie = await register('wb-patch-edge@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const created = await toolText(key, 'create_whiteboard', { projectId, name: 'Edges' });
    const boardId = (JSON.parse(created) as { id: string }).id;
    const nodeA = '11111111-1111-4111-8111-111111111111';
    const nodeB = '22222222-2222-4222-8222-222222222222';
    const edgeC = '33333333-3333-4333-8333-333333333333';
    await toolText(key, 'patch_whiteboard', {
      projectId,
      whiteboardId: boardId,
      add: [
        { ...STICKY, id: nodeA, text: 'A' },
        { ...STICKY, id: nodeB, x: 300, text: 'B' },
        { ...EDGE_EL, id: edgeC, sourceNodeId: nodeA, targetNodeId: nodeB },
      ],
    });

    const patched = await toolText(key, 'patch_whiteboard', {
      projectId,
      whiteboardId: boardId,
      delete: [nodeA],
    });
    expect(JSON.parse(patched)).toMatchObject({ deleted: 2, elementCount: 1 });

    const after = await fetchState(cookie, projectId);
    expect(after.whiteboards[0]!.elements.map((e) => e.id)).toEqual([nodeB]);
  });

  it('WB-10: patch rejects unknown ids, kind changes and duplicates', async () => {
    const cookie = await register('wb-patch-bad@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const created = await toolText(key, 'create_whiteboard', {
      projectId,
      name: 'Strict',
      elements: [STICKY],
    });
    const boardId = (JSON.parse(created) as { id: string }).id;
    const stickyId = (await fetchState(cookie, projectId)).whiteboards[0]!.elements[0]!.id;

    const unknown = await toolCall(key, 'patch_whiteboard', {
      projectId,
      whiteboardId: boardId,
      update: [{ id: '00000000-0000-4000-8000-000000000000', patch: { text: 'x' } }],
    });
    expect(unknown.body.result?.isError).toBe(true);
    expect(unknown.body.result?.content?.[0]?.text).toContain('Unknown element id');

    const kindChange = await toolCall(key, 'patch_whiteboard', {
      projectId,
      whiteboardId: boardId,
      update: [{ id: stickyId, patch: { kind: 'text' } }],
    });
    expect(kindChange.body.result?.isError).toBe(true);
    expect(kindChange.body.result?.content?.[0]?.text).toContain('immutable');

    const dup = await toolCall(key, 'patch_whiteboard', {
      projectId,
      whiteboardId: boardId,
      add: [{ ...TEXT_EL, id: stickyId }],
    });
    expect(dup.body.result?.isError).toBe(true);
    expect(dup.body.result?.content?.[0]?.text).toContain('Duplicate element id');
  });
});
