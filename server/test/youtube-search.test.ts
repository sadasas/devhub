import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { config } from '../src/config.js';
import {
  __resetYoutubeSearchForTests,
  searchYouTubeVideos,
} from '../src/modules/integrations/youtube/application/search-service.js';

const API = '/api/v1/integrations/youtube';

function okFetch(items: unknown[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ items }),
  });
}

const FIXTURE = [
  {
    id: { videoId: 'abc123' },
    snippet: {
      title: 'lofi mix',
      channelTitle: 'NCS',
      thumbnails: { medium: { url: 'https://i.ytimg.com/vi/abc123/mqdefault.jpg' } },
    },
  },
  { id: {}, snippet: { title: 'no id row' } },
];

describe('youtube search proxy (radio queue source)', () => {
  let prevKey: string;

  beforeEach(async () => {
    await resetDb();
    __resetYoutubeSearchForTests();
    prevKey = config.YOUTUBE_API_KEY;
  });

  afterEach(() => {
    config.YOUTUBE_API_KEY = prevKey;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated search with 401', async () => {
    const res = await request(app).get(`${API}/search?q=lofi`);
    expect(res.status).toBe(401);
  });

  it('returns 503 YOUTUBE_NOT_CONFIGURED when the key is empty', async () => {
    config.YOUTUBE_API_KEY = '';
    const cookie = await register('yt-a@gmail.com');
    const res = await request(app)
      .get(`${API}/search?q=lofi`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('YOUTUBE_NOT_CONFIGURED');
  });

  it('rejects invalid query with 400', async () => {
    config.YOUTUBE_API_KEY = 'test-key';
    const cookie = await register('yt-b@gmail.com');
    const bad = await request(app)
      .get(`${API}/search?q=`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(bad.status).toBe(400);
    const long = await request(app)
      .get(`${API}/search?q=${'x'.repeat(101)}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(long.status).toBe(400);
  });

  it('maps upstream items, skips rows without videoId, and caches repeats', async () => {
    config.YOUTUBE_API_KEY = 'test-key';
    const fetchMock = okFetch(FIXTURE);
    vi.stubGlobal('fetch', fetchMock);
    const cookie = await register('yt-c@gmail.com');
    const get = () =>
      request(app).get(`${API}/search?q=lofi&maxResults=5`).set('Cookie', cookie).set('X-Forwarded-For', uniqueIp());

    const first = await get();
    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);
    expect(first.body.results).toEqual([
      {
        videoId: 'abc123',
        title: 'lofi mix',
        channelTitle: 'NCS',
        thumbnailUrl: 'https://i.ytimg.com/vi/abc123/mqdefault.jpg',
      },
    ]);

    const second = await get();
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps upstream 403 to 429 YOUTUBE_QUOTA_EXHAUSTED', async () => {
    config.YOUTUBE_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: () => Promise.resolve({}) }),
    );
    const cookie = await register('yt-d@gmail.com');
    const res = await request(app)
      .get(`${API}/search?q=lofi`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('YOUTUBE_QUOTA_EXHAUSTED');
  });

  it('enforces the daily per-user cap at the service level', async () => {
    const fetchMock = okFetch([]);
    const opts = { apiKey: 'test-key', fetchImpl: fetchMock as unknown as typeof fetch, dailyCap: 2 };
    await searchYouTubeVideos('u1', 'lofi', 5, opts);
    await searchYouTubeVideos('u1', 'jazz', 5, opts);
    await expect(searchYouTubeVideos('u1', 'rock', 5, opts)).rejects.toMatchObject({
      status: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Other users are unaffected.
    await searchYouTubeVideos('u2', 'rock', 5, opts);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
