import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { app, createTeam, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import {
  buildFallbackTeamSlug,
  isReservedTeamSlug,
  isValidTeamSlugFormat,
  slugifyTeamName,
} from '../src/modules/teams/domain/slug.js';

async function getTeam(cookie: string, teamId: string) {
  const res = await request(app)
    .get(`/api/v1/teams/${teamId}`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(res.status).toBe(200);
  return res.body.team as { id: string; slug: string; name: string };
}

describe('team slugs', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('validates slug format', () => {
    expect(isValidTeamSlugFormat('acme')).toBe(true);
    expect(isValidTeamSlugFormat('acme-corp-2')).toBe(true);
    expect(isValidTeamSlugFormat('ab')).toBe(false);
    expect(isValidTeamSlugFormat('-acme')).toBe(false);
    expect(isValidTeamSlugFormat('acme-')).toBe(false);
    expect(isValidTeamSlugFormat('acme--corp')).toBe(false);
    expect(isValidTeamSlugFormat('Acme')).toBe(false);
    expect(isValidTeamSlugFormat('acme_corp')).toBe(false);
    expect(isValidTeamSlugFormat('a'.repeat(49))).toBe(false);
  });

  it('slugifies names and falls back to team-xxxx', () => {
    expect(slugifyTeamName('Acme Corp!')).toBe('acme-corp');
    expect(slugifyTeamName('  ---  ')).toBe('');
    expect(buildFallbackTeamSlug('12345678-1234-1234-1234-123456789012')).toBe('team-1234');
    expect(buildFallbackTeamSlug()).toMatch(/^team-[a-z0-9]{4}$/);
  });

  it('reserves static route words', () => {
    for (const w of ['invites', 'docs', 'pricing', 'payments', 'profile', 'templates', 'connected', 'billing', 'api', 'p', 'team', 'settings', 'members', 'projects', 'admin']) {
      expect(isReservedTeamSlug(w)).toBe(true);
    }
    expect(isReservedTeamSlug('acme')).toBe(false);
  });

  it('auto-generates slug from name with -2 dedup', async () => {
    const cookie = await register('slug1@gmail.com');
    const id1 = await createTeam(cookie, 'Acme Corp');
    const t1 = await getTeam(cookie, id1);
    expect(t1.slug).toBe('acme-corp');
    const id2 = await createTeam(cookie, 'Acme Corp');
    const t2 = await getTeam(cookie, id2);
    expect(t2.slug).toBe('acme-corp-2');
  });

  it('falls back to team-xxxx for empty slugs', async () => {
    const cookie = await register('slug2@gmail.com');
    const id = await createTeam(cookie, '---');
    const t = await getTeam(cookie, id);
    expect(t.slug).toMatch(/^team-[a-z0-9]{4}$/);
  });

  it('rejects reserved and duplicate explicit slugs', async () => {
    const cookie = await register('slug3@gmail.com');
    const reserved = await request(app)
      .post('/api/v1/teams')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'X', slug: 'docs' });
    expect(reserved.status).toBe(400);

    const badFormat = await request(app)
      .post('/api/v1/teams')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'X', slug: 'Bad_Slug!' });
    expect(badFormat.status).toBe(400);

    await createTeam(cookie, 'Acme');
    const dup = await request(app)
      .post('/api/v1/teams')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Other', slug: 'acme' });
    expect(dup.status).toBe(409);
  });

  it('renames slug with history redirect', async () => {
    const cookie = await register('slug4@gmail.com');
    const teamId = await createTeam(cookie, 'Acme Corp');
    const before = await getTeam(cookie, teamId);
    expect(before.slug).toBe('acme-corp');

    const rename = await request(app)
      .patch(`/api/v1/teams/${teamId}/slug`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ slug: 'acme-2' });
    expect(rename.status).toBe(200);
    expect(rename.body.team.slug).toBe('acme-2');

    // Current slug resolves without redirect.
    const cur = await request(app)
      .get('/api/v1/teams/by-slug/acme-2')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(cur.status).toBe(200);
    expect(cur.body.team.id).toBe(teamId);
    expect(cur.body.redirectTo).toBeNull();

    // Old slug resolves with redirect info.
    const old = await request(app)
      .get('/api/v1/teams/by-slug/acme-corp')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(old.status).toBe(200);
    expect(old.body.team.id).toBe(teamId);
    expect(old.body.redirectTo).toBe('acme-2');

    // Old slug stays reserved for other teams.
    const other = await register('slug4b@gmail.com');
    const taken = await request(app)
      .post('/api/v1/teams')
      .set('Cookie', other)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Other', slug: 'acme-corp' });
    expect(taken.status).toBe(409);
  });

  it('checks slug availability with suggestion', async () => {
    const cookie = await register('slug5@gmail.com');
    await createTeam(cookie, 'Acme');

    const taken = await request(app)
      .get('/api/v1/teams/slug-check?slug=acme')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(taken.status).toBe(200);
    expect(taken.body.available).toBe(false);
    expect(taken.body.reason).toBe('taken');
    expect(taken.body.suggestion).toBe('acme-2');

    const reserved = await request(app)
      .get('/api/v1/teams/slug-check?slug=docs')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(reserved.body.available).toBe(false);
    expect(reserved.body.reason).toBe('reserved');

    const free = await request(app)
      .get('/api/v1/teams/slug-check?slug=brand-new-team')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(free.body.available).toBe(true);
  });

  it('hides by-slug from non-members', async () => {
    const owner = await register('slug6@gmail.com');
    const outsider = await register('slug6b@gmail.com');
    const teamId = await createTeam(owner, 'Acme Corp');
    const t = await getTeam(owner, teamId);
    const res = await request(app)
      .get(`/api/v1/teams/by-slug/${t.slug}`)
      .set('Cookie', outsider)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(404);
  });
});
