import { ApiError } from "../../../../shared/errors.js";

export interface YoutubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

export interface YoutubeSearchDeps {
  apiKey: string;
  fetchImpl?: typeof fetch;
  dailyCap?: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 100;
const DAILY_CAP_DEFAULT = 10;

// In-memory, per-process (documented limitation): guards the shared Google
// quota against bursts. Restarts/pods reset counters — acceptable for a
// capped, cached search box; revisit with a DB table if abused.
const cache = new Map<string, { at: number; data: YoutubeVideo[] }>();
const quota = new Map<string, { day: string; count: number }>();

/** Test seam: clear cache + quota counters. */
export function __resetYoutubeSearchForTests(): void {
  cache.clear();
  quota.clear();
}

function dayKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

interface SearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
  };
}

/**
 * Search YouTube (public videos, embeddable only) through the Data API v3.
 * Throws 429 YOUTUBE_QUOTA_EXHAUSTED on local cap or upstream quota errors,
 * 502 YOUTUBE_UPSTREAM on other upstream/network failures.
 */
export async function searchYouTubeVideos(
  userId: string,
  query: string,
  maxResults: number,
  deps: YoutubeSearchDeps,
): Promise<{ results: YoutubeVideo[]; cached: boolean }> {
  const { apiKey, fetchImpl = fetch, dailyCap = DAILY_CAP_DEFAULT } = deps;
  const normalized = query.trim().toLowerCase();
  const cacheKey = `${normalized}:${maxResults}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { results: hit.data, cached: true };
  }

  const day = dayKey();
  const used = quota.get(userId);
  const usedToday = used && used.day === day ? used.count : 0;
  if (usedToday >= dailyCap) {
    throw new ApiError(
      429,
      "YOUTUBE_QUOTA_EXHAUSTED",
      "Daily YouTube search quota exhausted, try again tomorrow",
    );
  }

  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&type=video&videoEmbeddable=true` +
    `&maxResults=${maxResults}&q=${encodeURIComponent(query.trim())}` +
    `&key=${encodeURIComponent(apiKey)}`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { Accept: "application/json", "User-Agent": "devhub-youtube/1.0" },
    });
  } catch {
    throw new ApiError(502, "YOUTUBE_UPSTREAM", "YouTube search is unreachable right now");
  }
  if (res.status === 403) {
    throw new ApiError(429, "YOUTUBE_QUOTA_EXHAUSTED", "YouTube API quota exhausted, try again tomorrow");
  }
  if (!res.ok) {
    throw new ApiError(502, "YOUTUBE_UPSTREAM", `YouTube search failed (upstream ${res.status})`);
  }
  const json = (await res.json()) as { items?: SearchItem[] };
  const results: YoutubeVideo[] = [];
  for (const item of json.items ?? []) {
    const videoId = item?.id?.videoId;
    if (!videoId) continue;
    results.push({
      videoId,
      title: item.snippet?.title ?? videoId,
      channelTitle: item.snippet?.channelTitle ?? "",
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
    });
  }

  quota.set(userId, { day, count: usedToday + 1 });
  cache.set(cacheKey, { at: Date.now(), data: results });
  if (cache.size > CACHE_MAX) {
    const first = cache.keys().next();
    if (!first.done) cache.delete(first.value);
  }
  return { results, cached: false };
}
