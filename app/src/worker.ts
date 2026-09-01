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
      url.pathname === '/health' ||
      url.pathname.startsWith('/.well-known/');

    // WebSocket upgrade for /ws
    const isWs = url.pathname.startsWith('/ws');

    if (isApi || isWs) {
      const targetUrl = new URL(url.pathname + url.search, env.SUGA_ORIGIN);

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
      // Cloudflare aggregates Set-Cookie via getSetCookie() if available
      const cookies: string[] = [];
      // @ts-ignore getSetCookie exists on Headers in Workers
      if (typeof (sugaRes.headers as any).getSetCookie === 'function') {
        cookies.push(...(sugaRes.headers as any).getSetCookie());
        resHeaders.delete('Set-Cookie');
      } else {
        const single = sugaRes.headers.get('Set-Cookie');
        if (single) {
          cookies.push(single);
          resHeaders.delete('Set-Cookie');
        }
      }
      for (const c of cookies) {
        const rewritten = c.replace(/Domain=[^;]+;?\s*/gi, '');
        resHeaders.append('Set-Cookie', rewritten);
      }

      // Remove content-encoding/length that may be invalid after streaming
      // Let runtime handle

      return new Response(sugaRes.body, {
        status: sugaRes.status,
        statusText: sugaRes.statusText,
        headers: resHeaders,
      });
    }

    // Fallback to static assets (SPA)
    return env.ASSETS.fetch(request);
  },
} as any;
