import { describe, expect, it } from 'vitest';
import { isDcrRedirectAllowed, isLoopbackOrigin } from '../src/modules/oauth/oauth.routes.js';

describe('DCR redirect allowlist (RFC 8252 loopback)', () => {
  it('mengenali loopback http dengan/tanpa port', () => {
    expect(isLoopbackOrigin('http://127.0.0.1:19876')).toBe(true);
    expect(isLoopbackOrigin('http://localhost:54321')).toBe(true);
    expect(isLoopbackOrigin('http://localhost')).toBe(true);
    expect(isLoopbackOrigin('http://127.0.0.1')).toBe(true);
  });

  it('menolak bukan-loopback dan jebakan subdomain', () => {
    expect(isLoopbackOrigin('https://localhost:8443')).toBe(false);
    expect(isLoopbackOrigin('http://localhost.evil.com')).toBe(false);
    expect(isLoopbackOrigin('http://evil.com')).toBe(false);
    expect(isLoopbackOrigin('file:///tmp/cb')).toBe(false);
  });

  it('loopback lolos di semua environment (kasus CLI MCP production)', () => {
    // allowedOrigins kosong + simulasi production: tidak ada lagi isDev.
    expect(isDcrRedirectAllowed('http://127.0.0.1:19876', new Set())).toBe(true);
    expect(isDcrRedirectAllowed('http://localhost:3000', new Set())).toBe(true);
  });

  it('origin remote wajib allowlist, evil.com selalu ditolak', () => {
    const allowed = new Set(['https://devhub.nrawangbatin.my.id']);
    expect(isDcrRedirectAllowed('https://devhub.nrawangbatin.my.id', allowed)).toBe(true);
    expect(isDcrRedirectAllowed('https://evil.com', allowed)).toBe(false);
    expect(isDcrRedirectAllowed('https://evil.com', new Set())).toBe(false);
  });
});
