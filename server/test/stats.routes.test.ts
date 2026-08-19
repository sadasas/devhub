import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, register, createProject } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { resetDb } from './setup.js';

const API = '/api/v1';

async function userIdOf(cookie: string): Promise<string> {
  const me = await request(app).get(`${API}/auth/me`).set('Cookie', cookie);
  return (me.body as { id: string }).id;
}

async function addActivity(
  userId: string,
  projectId: string,
  daysAgo: number,
  entity: string,
  action: 'created' | 'updated' | 'deleted',
  changes: Record<string, { from: unknown; to: unknown }> = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO activity_log (project_id, entity, entity_id, action, author_id, author_name, summary, changes, created_at)
     VALUES ($1, $2, gen_random_uuid(), $3, $4, 'Tester', 'entry', $5::jsonb, now() - make_interval(days => $6))`,
    [projectId, entity, action, userId, JSON.stringify(changes), daysAgo],
  );
}

function doneChange(): Record<string, { from: unknown; to: unknown }> {
  return { status: { from: 'todo', to: 'done' } };
}

function resolvedChange(): Record<string, { from: unknown; to: unknown }> {
  return { status: { from: 'open', to: 'resolved' } };
}

describe('user stats API (GET /me/stats)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects without a session', async () => {
    const res = await request(app).get(`${API}/auth/me/stats`);
    expect(res.status).toBe(401);
  });

  it('returns a zero-filled 365-day window for a fresh user', async () => {
    const cookie = await register('stats-empty@test.dev');
    const res = await request(app).get(`${API}/auth/me/stats`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(365);
    expect(res.body.totalContributions).toBe(0);
    expect(res.body.taskCompletions).toBe(0);
    expect(res.body.issuesResolved).toBe(0);
    expect(res.body.activeDays).toBe(0);
    expect(res.body.currentStreak).toBe(0);
    expect(res.body.longestStreak).toBe(0);
  });

  it('counts contributions, task completions and resolved issues per user', async () => {
    const cookie = await register('stats-count@test.dev');
    const userId = await userIdOf(cookie);
    const projectId = await createProject(cookie);

    await addActivity(userId, projectId, 1, 'tasks', 'created');
    await addActivity(userId, projectId, 1, 'tasks', 'created');
    await addActivity(userId, projectId, 1, 'issues', 'created');
    await addActivity(userId, projectId, 0, 'tasks', 'updated', doneChange());
    await addActivity(userId, projectId, 0, 'tasks', 'updated', doneChange());
    await addActivity(userId, projectId, 0, 'issues', 'updated', resolvedChange());
    await addActivity(userId, projectId, 0, 'tasks', 'updated', { title: { from: 'a', to: 'b' } });

    const res = await request(app).get(`${API}/auth/me/stats`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.totalContributions).toBe(7);
    expect(res.body.taskCompletions).toBe(2);
    expect(res.body.issuesResolved).toBe(1);
    expect(res.body.activeDays).toBe(2);
    expect(res.body.days).toHaveLength(365);

    const today = res.body.days.at(-1) as { date: string; count: number };
    const yesterday = res.body.days.at(-2) as { date: string; count: number };
    expect(today.count).toBe(4);
    expect(yesterday.count).toBe(3);
  });

  it('only counts stats for the requesting user', async () => {
    const cookieA = await register('stats-a@test.dev');
    const cookieB = await register('stats-b@test.dev');
    const userIdA = await userIdOf(cookieA);
    const projectIdA = await createProject(cookieA);

    await addActivity(userIdA, projectIdA, 0, 'tasks', 'created');

    const resB = await request(app).get(`${API}/auth/me/stats`).set('Cookie', cookieB);
    expect(resB.status).toBe(200);
    expect(resB.body.totalContributions).toBe(0);
  });

  it('computes current and longest streaks from daily activity', async () => {
    const cookie = await register('stats-streak@test.dev');
    const userId = await userIdOf(cookie);
    const projectId = await createProject(cookie);

    // Run panjang: 5 hari beruntun berakhir kemarin (hari ini kosong) -> current 5
    for (const daysAgo of [1, 2, 3, 4, 5]) {
      await addActivity(userId, projectId, daysAgo, 'tasks', 'created');
    }
    // Run pendek terpisah: 2 hari beruntun jauh di masa lalu -> longest tetap 5
    for (const daysAgo of [20, 21]) {
      await addActivity(userId, projectId, daysAgo, 'issues', 'created');
    }

    const res = await request(app).get(`${API}/auth/me/stats`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(5);
    expect(res.body.longestStreak).toBe(5);
  });

  it('counts today as part of the current streak', async () => {
    const cookie = await register('stats-streak-today@test.dev');
    const userId = await userIdOf(cookie);
    const projectId = await createProject(cookie);

    for (const daysAgo of [0, 1, 2]) {
      await addActivity(userId, projectId, daysAgo, 'tasks', 'created');
    }

    const res = await request(app).get(`${API}/auth/me/stats`).set('Cookie', cookie);
    expect(res.body.currentStreak).toBe(3);
    expect(res.body.longestStreak).toBe(3);
  });
});