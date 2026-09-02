// @ts-nocheck
export interface Env {
  SUGA_ORIGIN: string;
  ASSETS: any;
}

export default {
  async fetch(request: Request, env: Env, _ctx: any): Promise<Response> {
    const url = new URL(request.url);

    const isApi =
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/mcp') ||
      url.pathname.startsWith('/oauth/') ||
      url.pathname === '/health' ||
      url.pathname.startsWith('/.well-known/');

    // WebSocket upgrade for /ws
    const isWs = url.pathname.startsWith('/ws');

    // WebSocket upgrade must be proxied with webSocket passthrough, not generic fetch
    if (isWs) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }
      const rawOrigin = env.SUGA_ORIGIN?.trim() || '';
      const sugaOrigin = rawOrigin.startsWith('http') ? rawOrigin : `https://${rawOrigin}`;
      const targetUrl = new URL(url.pathname + url.search, sugaOrigin);
      const wsReq = new Request(targetUrl.toString(), request);
      wsReq.headers.set('x-forwarded-host', url.host);
      wsReq.headers.set('x-forwarded-proto', url.protocol.slice(0, -1));
      const cfIp = request.headers.get('cf-connecting-ip');
      if (cfIp) wsReq.headers.set('x-real-ip', cfIp);
      return fetch(wsReq);
    }

    if (isApi) {
      const rawOrigin = env.SUGA_ORIGIN?.trim() || '';
      const sugaOrigin = rawOrigin.startsWith('http') ? rawOrigin : `https://${rawOrigin}`;
      const targetUrl = new URL(url.pathname + url.search, sugaOrigin);

      const headers = new Headers(request.headers);
      // Forward original host/proto for server's baseUrl() & frontendOrigin()
      headers.set('x-forwarded-host', url.host);
      headers.set('x-forwarded-proto', url.protocol.slice(0, -1));
      const cfIp = request.headers.get('cf-connecting-ip');
      if (cfIp) headers.set('x-real-ip', cfIp);
      // Ensure host header is target host for fetch
      headers.set('host', targetUrl.host);

      const init: RequestInit & { duplex?: string } = {
        method: request.method,
        headers,
        redirect: 'manual',
      };

      // Only include body for methods that allow it
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        // @ts-ignore duplex for streaming
        init.body = request.body;
        // @ts-ignore
        init.duplex = 'half';
      }

      let sugaRes: Response;
      try {
        sugaRes = await fetch(new Request(targetUrl.toString(), init));
      } catch (e) {
        return new Response('Bad Gateway: Suga origin unreachable', { status: 502 });
      }

      const resHeaders = new Headers(sugaRes.headers);

      // Rewrite Set-Cookie: strip Domain so it becomes first-party (devhub...)
      // Cloudflare aggregates Set-Cookie via getSetCookie() if available; fallback
      // must not lose multiple cookies (session + oauth state) on a single header.
      const cookies: string[] = [];
      // @ts-ignore getSetCookie exists on Headers in Workers
      const getSetCookie = (sugaRes.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
      if (typeof getSetCookie === 'function') {
        cookies.push(...getSetCookie.call(sugaRes.headers));
        resHeaders.delete('Set-Cookie');
      } else {
        const single = sugaRes.headers.get('Set-Cookie');
        if (single) {
          // Headers.get() may have folded multiple Set-Cookie into comma-separated;
          // splitting on ", " is unsafe for Expires, but Suga uses Max-Age, so safe-ish.
          // Better: keep as single if only one; multiple cookies would still be folded,
          // so preserve it as-is after Domain strip.
          cookies.push(single);
          resHeaders.delete('Set-Cookie');
        }
      }
      for (const c of cookies) {
        const rewritten = c.replace(/Domain=[^;]+;?\s*/gi, '');
        resHeaders.append('Set-Cookie', rewritten);
      }

      return new Response(sugaRes.body, {
        status: sugaRes.status,
        statusText: sugaRes.statusText,
        headers: resHeaders,
      });
    }

    // Fallback to static assets (SPA)
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not Found', { status: 404 });
  },
} as any;
