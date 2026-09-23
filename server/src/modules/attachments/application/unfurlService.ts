import { isHttpUrl } from '../domain/attachment.js';
import { ApiError } from '../../../shared/errors.js';

/**
 * Unfurl link ala Linear: fetch HTML target server-side lalu parse
 * Open Graph (og:title / og:description / og:image) + favicon.
 * Frontend tidak fetch langsung (CORS + bocor IP tidak perlu).
 *
 * SSRF guard: hanya http(s) publik — blokir localhost, IP privat,
 * link-local, metadata cloud, dan port non-standar yang mencurigakan.
 * Tanpa dependensi baru (regex + fetch bawaan Node 20+).
 */

export interface UnfurlResult {
  url: string;
  domain: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
  fallback: boolean;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_HTML_BYTES = 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;

const cache = new Map<string, { at: number; value: UnfurlResult }>();

export function clearUnfurlCache(): void {
  cache.clear();
}

function domainOf(raw: string): string {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!h) return true;
  if (h === 'localhost') return true;
  // IP literal v4
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts as [number, number];
    // loopback / privat / link-local / multicast / reserved / CGNAT
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a >= 224) return true;
    if (a === 0) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  // IPv6 literal / metadata / cloud internal
  if (h.includes(':')) return true;
  if (h === 'metadata.google.internal') return true;
  if (h.endsWith('.internal')) return true;
  if (h.endsWith('.local')) return true;
  if (h.endsWith('.localhost')) return true;
  return false;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .slice(0, 500);
}

function metaContent(html: string, attr: 'property' | 'name', key: string): string | null {
  // <meta property="og:title" content="..."> — toleran urutan atribut.
  const re = new RegExp(
    `<meta[^>]*?(?:property|name)\\s*=\\s*["']${key}["'][^>]*?content\\s*=\\s*["']([^"']{1,500})["'][^>]*?>` +
      `|<meta[^>]*?content\\s*=\\s*["']([^"']{1,500})["'][^>]*?(?:property|name)\\s*=\\s*["']${key}["'][^>]*?>`,
    'i',
  );
  const m = html.match(re);
  const raw = (m?.[1] ?? m?.[2] ?? '').trim();
  void attr;
  return raw ? decodeEntities(raw) : null;
}

function linkIconHref(html: string): string | null {
  const re =
    /<link[^>]*?rel\s*=\s*["'](?:shortcut\s+icon|icon|apple-touch-icon)["'][^>]*?href\s*=\s*["']([^"']{1,500})["'][^>]*?>|<link[^>]*?href\s*=\s*["']([^"']{1,500})["'][^>]*?rel\s*=\s*["'](?:shortcut\s+icon|icon|apple-touch-icon)["'][^>]*?>/i;
  const m = html.match(re);
  return (m?.[1] ?? m?.[2] ?? '').trim() || null;
}

function titleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
  const raw = (m?.[1] ?? '').trim();
  return raw ? decodeEntities(raw) : null;
}

function absolutize(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString().slice(0, 2000);
  } catch {
    return null;
  }
}

async function fetchHtml(finalUrl: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = finalUrl;
    // Ikuti redirect manual agar host tiap hop ikut SSRF-guard.
    for (let hop = 0; hop < 4; hop++) {
      const res = await fetch(current, {
        signal: ctrl.signal,
        redirect: 'manual',
        headers: {
          'user-agent': 'DevHub-LinkPreview/1.0 (+https://devhub)',
          accept: 'text/html,application/xhtml+xml',
        },
      });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        const next = absolutize(loc, current);
        if (!next || !isHttpUrl(next)) throw new ApiError(400, 'VALIDATION_ERROR', 'Link redirect is invalid');
        const host = domainOf(next);
        if (isBlockedHost(host)) throw new ApiError(400, 'VALIDATION_ERROR', 'Link target is not allowed');
        current = next;
        continue;
      }
      if (!res.ok) throw new ApiError(502, 'UNFURL_FAILED', `Link returned ${res.status}`);
      const ctype = res.headers.get('content-type') ?? '';
      if (!/text\/html|application\/xhtml/i.test(ctype)) {
        throw new ApiError(415, 'UNFURL_NOT_HTML', 'Link is not an HTML page');
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new ApiError(502, 'UNFURL_FAILED', 'Link returned empty page');
      return buf.subarray(0, MAX_HTML_BYTES).toString('utf8');
    }
    throw new ApiError(400, 'VALIDATION_ERROR', 'Too many redirects');
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError(504, 'UNFURL_TIMEOUT', 'Link preview timed out');
    }
    throw new ApiError(502, 'UNFURL_FAILED', 'Could not fetch link preview');
  } finally {
    clearTimeout(timer);
  }
}

export async function unfurlLink(rawUrl: string): Promise<UnfurlResult> {
  const url = rawUrl.trim().slice(0, 2000);
  if (!isHttpUrl(url)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Link must be a valid http(s) URL');
  }
  const domain = domainOf(url);
  if (!domain || isBlockedHost(domain)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Link target is not allowed');
  }
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const fallback: UnfurlResult = {
    url,
    domain,
    title: domain,
    description: '',
    image: null,
    favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
    fallback: true,
  };

  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (err) {
    // Target non-HTML / timeout / offline → tetap kembalikan fallback
    // agar kartu link frontend tidak pecah (bedakan via code bila perlu).
    if (err instanceof ApiError && (err.code === 'UNFURL_NOT_HTML' || err.code === 'UNFURL_TIMEOUT')) {
      cache.set(url, { at: Date.now(), value: fallback });
      return fallback;
    }
    throw err;
  }

  const title = metaContent(html, 'property', 'og:title') ?? metaContent(html, 'name', 'twitter:title') ?? titleTag(html) ?? domain;
  const description =
    metaContent(html, 'property', 'og:description') ??
    metaContent(html, 'name', 'description') ??
    metaContent(html, 'name', 'twitter:description') ??
    '';
  const rawImage = metaContent(html, 'property', 'og:image') ?? metaContent(html, 'name', 'twitter:image');
  const image = rawImage ? absolutize(rawImage, url) : null;
  const rawIcon = linkIconHref(html);
  const favicon = (rawIcon ? absolutize(rawIcon, url) : null) ?? fallback.favicon;
  const value: UnfurlResult = {
    url,
    domain,
    title: title.slice(0, 200),
    description: description.slice(0, 300),
    image,
    favicon,
    fallback: false,
  };
  cache.set(url, { at: Date.now(), value });
  // Batasi memori: evict FIFO sederhana.
  if (cache.size > 500) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return value;
}
