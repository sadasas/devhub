import type { Request } from 'express';
import { config } from '../config.js';

/**
 * Returns public origin for OAuth discovery & WWW-Authenticate.
 * Respects Cloudflare Worker forwarding: x-forwarded-host/proto.
 * Falls back to Host/protocol for local dev.
 */
export function getBaseUrl(req: Request): string {
  const protoHeader = req.headers['x-forwarded-proto'] as string | undefined;
  const proto = protoHeader?.split(',')[0]?.trim() || req.protocol;
  const hostHeader = req.headers['x-forwarded-host'] as string | undefined;
  const host = hostHeader?.split(',')[0]?.trim() || req.get('host') || `localhost:${config.PORT}`;
  return `${proto}://${host}`;
}
