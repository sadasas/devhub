import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

export function requireMcpKey(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const [scheme, key] = header.split(' ');
  const expected = config.MCP_API_KEY;
  const valid =
    scheme === 'Bearer' &&
    typeof key === 'string' &&
    expected.length === key.length &&
    timingSafeEqual(Buffer.from(key), Buffer.from(expected));
  if (!valid) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid MCP API key' } });
    return;
  }
  next();
}
