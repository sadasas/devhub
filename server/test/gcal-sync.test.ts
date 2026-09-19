/**
 * T3 push worker: insert/patch(delete)/retry kuota Google Calendar.
 * Pure unit (fake store + mock fetchImpl) — tanpa DB, tanpa network.
 *
 * Kasus locked:
 * 1) 429 rateLimitExceeded → outbox + backoff ~1m (op 'upsert')
 * 2) 401 invalid_grant → needs_reconnect, stop retry (tanpa outbox)
 * 3) double-insert idempoten (insert kedua menjadi patch, 1x POST)
 * 4) patch on reschedule (PATCH body memuat tanggal baru)
 * + worker processOutbox retry sukses + skip saat sync_disabled.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  syncTaskCreated,
  syncTaskUpdated,
  syncTaskDeleted,
  processOutbox,
  __clearGcalInflightForTests,
  type SyncDeps,
} from '../src/modules/integrations/gcal/application/sync-service.js';
import { taskToEvent } from '../src/modules/integrations/gcal/application/mapping.js';
import type {
  GcalStore,
  GcalOutboxRow,
  EnqueueOutboxInput,
} from '../src/modules/integrations/gcal/infrastructure/gcal-repository.js';
import {
  computeNextRetry,
  GCAL_MAX_ATTEMPTS,
} from '../src/modules/integrations/gcal/infrastructure/gcal-repository.js';

const PROJECT_ID = randomUUID();
const TASK_ID = randomUUID();
const USER_ID = randomUUID();
const FIXED_NOW = new Date('2026-09-17T00:00:00.000Z');

class FakeStore implements GcalStore {
  settings = new Map<string, { calendarId: string; syncEnabled: boolean }>();
  connections = new Map<string, { refreshTokenEnc: string; accessTokenEnc: string | null; expiry: Date | null; status: 'connected' | 'needs_reconnect' }>();
  maps = new Map<string, { eventId: string; calendarId: string }>();
  outbox: GcalOutboxRow[] = [];
  seq = 0;

  async getProjectSettings(projectId: string) {
    return this.settings.get(projectId) ?? null;
  }
  async getConnection(userId: string) {
    const c = this.connections.get(userId);
    if (!c) return null;
    return { userId, ...c };
  }
  async updateConnectionTokens(userId: string, accessTokenEnc: string, expiry: Date) {
    const c = this.connections.get(userId);
    if (!c) return;
    this.connections.set(userId, { ...c, accessTokenEnc, expiry, status: 'connected' });
  }
  async markNeedsReconnect(userId: string) {
    const c = this.connections.get(userId);
    if (!c) return;
    this.connections.set(userId, { ...c, status: 'needs_reconnect' });
  }
  async getEventMap(projectId: string, taskId: string) {
    return this.maps.get(`${projectId}:${taskId}`) ?? null;
  }
  async upsertEventMap(projectId: string, taskId: string, eventId: string, calendarId: string) {
    this.maps.set(`${projectId}:${taskId}`, { eventId, calendarId });
  }
  async deleteEventMap(projectId: string, taskId: string) {
    this.maps.delete(`${projectId}:${taskId}`);
  }
  async enqueueOutbox(input: EnqueueOutboxInput) {
    const now = input.now ?? FIXED_NOW;
    this.outbox = this.outbox.filter(
      (r) => !(r.projectId === input.projectId && r.taskId === input.taskId && r.attempts < GCAL_MAX_ATTEMPTS),
    );
    this.seq += 1;
    this.outbox.push({
      id: `outbox-${this.seq}`,
      projectId: input.projectId,
      taskId: input.taskId,
      op: input.op,
      attempts: 0,
      nextRetryAt: computeNextRetry(1, now),
      payload: input.payload,
      createdAt: now,
    });
  }
  async listDueOutbox(limit: number, now: Date) {
    return this.outbox
      .filter((r) => r.nextRetryAt <= now && r.attempts < GCAL_MAX_ATTEMPTS)
      .sort((a, b) => a.nextRetryAt.getTime() - b.nextRetryAt.getTime())
      .slice(0, limit);
  }
  async markOutboxForRetry(id: string, attempts: number, nextRetryAt: Date) {
    const row = this.outbox.find((r) => r.id === id);
    if (row) {
      row.attempts = attempts;
      row.nextRetryAt = nextRetryAt;
    }
  }
  async deleteOutbox(id: string) {
    this.outbox = this.outbox.filter((r) => r.id !== id);
  }
  async resolveUserForProject(_projectId: string, preferredUserId?: string) {
    if (preferredUserId && this.connections.get(preferredUserId)?.status === 'connected') {
      return preferredUserId;
    }
    for (const [uid, c] of this.connections) {
      if (c.status === 'connected') return uid;
    }
    return null;
  }
}

function seedConnected(store: FakeStore) {
  store.settings.set(PROJECT_ID, { calendarId: 'primary', syncEnabled: true });
  store.connections.set(USER_ID, {
    refreshTokenEnc: 'enc:refresh-123',
    accessTokenEnc: 'enc:access-123',
    expiry: new Date(FIXED_NOW.getTime() + 3600_000),
    status: 'connected',
  });
}

function testDeps(store: FakeStore, fetchImpl: typeof fetch): SyncDeps {
  return {
    store,
    fetchImpl,
    now: () => new Date(FIXED_NOW),
    clientId: 'test-client',
    clientSecret: 'test-secret',
    encrypt: (s: string) => `enc:${s}`,
    decrypt: (s: string) => {
      if (!s.startsWith('enc:')) throw new Error('bad blob');
      return s.slice(4);
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function baseTask(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    projectId: PROJECT_ID,
    title: 'Ship calendar sync',
    status: 'todo',
    priority: 'medium',
    labels: [] as string[],
    description: '',
    startDate: '2026-09-20',
    dueDate: '2026-09-22',
    ...overrides,
  };
}

beforeEach(() => {
  __clearGcalInflightForTests();
});

describe('gcal mapping kontrak T3 (sanity)', () => {
  it('prefix [Done], all-day, extendedProperties, null tanpa tanggal', () => {
    const done = taskToEvent(baseTask({ status: 'done', title: 'Release' }));
    expect(done?.summary).toBe('[Done] Release');
    const ev = taskToEvent(baseTask());
    expect(ev?.start).toEqual({ date: '2026-09-20' });
    expect(ev?.end).toEqual({ date: '2026-09-22' });
    expect(ev?.extendedProperties.private).toEqual({ devhubTaskId: TASK_ID, projectId: PROJECT_ID });
    expect(taskToEvent(baseTask({ startDate: null, dueDate: null }))).toBeNull();
    const single = taskToEvent(baseTask({ startDate: '2026-09-25', dueDate: null }));
    expect(single?.start).toEqual({ date: '2026-09-25' });
    expect(single?.end).toEqual({ date: '2026-09-26' });
  });
});

describe('gcal sync-service T3 (mock fetch)', () => {
  it('429 rateLimitExceeded → outbox upsert + backoff ~1m', async () => {
    const store = new FakeStore();
    seedConnected(store);
    const fetchImpl = (async () =>
      jsonResponse(429, {
        error: { code: 429, message: 'Rate Limit Exceeded', errors: [{ reason: 'rateLimitExceeded' }] },
      })) as typeof fetch;
    const res = await syncTaskCreated(PROJECT_ID, baseTask(), USER_ID, testDeps(store, fetchImpl));
    expect(res.status).toBe('queued');
    expect(store.outbox).toHaveLength(1);
    const row = store.outbox[0]!;
    expect(row.op).toBe('upsert');
    expect(row.attempts).toBe(0);
    const delta = row.nextRetryAt.getTime() - FIXED_NOW.getTime();
    expect(delta).toBeGreaterThanOrEqual(55_000);
    expect(delta).toBeLessThanOrEqual(65_000);
    expect(await store.getEventMap(PROJECT_ID, TASK_ID)).toBeNull();
  });

  it('401 invalid credentials → needs_reconnect, stop retry (tanpa outbox)', async () => {
    const store = new FakeStore();
    seedConnected(store);
    const fetchImpl = (async () =>
      jsonResponse(401, {
        error: { code: 401, message: 'Invalid Credentials', errors: [{ reason: 'authError' }] },
      })) as typeof fetch;
    const res = await syncTaskCreated(PROJECT_ID, baseTask(), USER_ID, testDeps(store, fetchImpl));
    expect(res.status).toBe('needs-reconnect');
    expect((await store.getConnection(USER_ID))?.status).toBe('needs_reconnect');
    expect(store.outbox).toHaveLength(0);
    expect(await store.getEventMap(PROJECT_ID, TASK_ID)).toBeNull();
  });

  it('double-insert idempoten: POST sekali, kedua menjadi PATCH', async () => {
    const store = new FakeStore();
    seedConnected(store);
    let posts = 0;
    let patches = 0;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST') {
        posts += 1;
        return jsonResponse(200, { id: 'evt_123' });
      }
      if (method === 'PATCH') {
        patches += 1;
        return jsonResponse(200, { id: 'evt_123' });
      }
      return jsonResponse(500, { error: { message: 'unexpected' } });
    }) as typeof fetch;
    const deps = testDeps(store, fetchImpl);
    const first = await syncTaskCreated(PROJECT_ID, baseTask(), USER_ID, deps);
    expect(first.status).toBe('inserted');
    expect(first.eventId).toBe('evt_123');
    const second = await syncTaskCreated(PROJECT_ID, baseTask(), USER_ID, deps);
    expect(second.status).toBe('patched');
    expect(posts).toBe(1);
    expect(patches).toBe(1);
    expect((await store.getEventMap(PROJECT_ID, TASK_ID))?.eventId).toBe('evt_123');
  });

  it('patch on reschedule: PATCH body memuat tanggal baru', async () => {
    const store = new FakeStore();
    seedConnected(store);
    await store.upsertEventMap(PROJECT_ID, TASK_ID, 'evt_123', 'primary');
    let patchedBody: unknown = null;
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      patchedBody = JSON.parse(String(init?.body ?? '{}')) as unknown;
      return jsonResponse(200, { id: 'evt_123' });
    }) as typeof fetch;
    const before = baseTask({ dueDate: '2026-09-22' });
    const after = baseTask({ dueDate: '2026-10-05' });
    const res = await syncTaskUpdated(PROJECT_ID, after, USER_ID, before, testDeps(store, fetchImpl));
    expect(res.status).toBe('patched');
    const body = patchedBody as { start: { date: string }; end: { date: string } };
    expect(body.start).toEqual({ date: '2026-09-20' });
    expect(body.end).toEqual({ date: '2026-10-05' });
  });

  it('hapus tanggal → delete event + bersihkan map', async () => {
    const store = new FakeStore();
    seedConnected(store);
    await store.upsertEventMap(PROJECT_ID, TASK_ID, 'evt_123', 'primary');
    let deleted = false;
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      if ((init?.method ?? '').toUpperCase() === 'DELETE') {
        deleted = true;
        return new Response(null, { status: 204 });
      }
      return jsonResponse(500, { error: { message: 'unexpected' } });
    }) as typeof fetch;
    const res = await syncTaskUpdated(
      PROJECT_ID,
      baseTask({ startDate: null, dueDate: null }),
      USER_ID,
      baseTask(),
      testDeps(store, fetchImpl),
    );
    expect(res.status).toBe('deleted');
    expect(deleted).toBe(true);
    expect(await store.getEventMap(PROJECT_ID, TASK_ID)).toBeNull();
  });

  it('sync_disabled → skip tanpa call Google', async () => {
    const store = new FakeStore();
    store.settings.set(PROJECT_ID, { calendarId: 'primary', syncEnabled: false });
    store.connections.set(USER_ID, {
      refreshTokenEnc: 'enc:refresh-123',
      accessTokenEnc: 'enc:access-123',
      expiry: new Date(FIXED_NOW.getTime() + 3600_000),
      status: 'connected',
    });
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return jsonResponse(200, { id: 'evt_x' });
    }) as typeof fetch;
    const res = await syncTaskCreated(PROJECT_ID, baseTask(), USER_ID, testDeps(store, fetchImpl));
    expect(res.status).toBe('skipped');
    expect(called).toBe(false);
  });

  it('worker processOutbox: upsert tertunda sukses setelah kuota pulih', async () => {
    const store = new FakeStore();
    seedConnected(store);
    const rateLimited = (async () =>
      jsonResponse(429, {
        error: { code: 429, message: 'Rate Limit Exceeded', errors: [{ reason: 'rateLimitExceeded' }] },
      })) as typeof fetch;
    const queued = await syncTaskCreated(PROJECT_ID, baseTask(), USER_ID, testDeps(store, rateLimited));
    expect(queued.status).toBe('queued');
    expect(store.outbox).toHaveLength(1);
    // Majukan waktu melewati backoff 1m, lalu kuota pulih.
    const laterNow = new Date(FIXED_NOW.getTime() + 2 * 60_000);
    const okFetch = (async () => jsonResponse(200, { id: 'evt_999' })) as typeof fetch;
    const deps: SyncDeps = {
      ...testDeps(store, okFetch),
      now: () => laterNow,
    };
    const summary = await processOutbox(deps, 50);
    expect(summary.processed).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(store.outbox).toHaveLength(0);
    expect((await store.getEventMap(PROJECT_ID, TASK_ID))?.eventId).toBe('evt_999');
  });

  it('delete tanpa map → skip idempoten (tanpa call)', async () => {
    const store = new FakeStore();
    seedConnected(store);
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    const res = await syncTaskDeleted(PROJECT_ID, { id: TASK_ID }, USER_ID, testDeps(store, fetchImpl));
    expect(res.status).toBe('skipped');
    expect(called).toBe(false);
  });
});
