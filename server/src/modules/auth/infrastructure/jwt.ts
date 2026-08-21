import jwt from 'jsonwebtoken';
import { config } from '../../../config.js';
import { pool } from '../../../db/pool.js';

export const JWT_TTL_SECONDS = 24 * 60 * 60; // 24h

export interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
  v: number;
}

export function signToken(userId: string, version: number): string {
  return jwt.sign({ v: version }, config.JWT_SECRET, {
    subject: userId,
    expiresIn: JWT_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || !decoded.sub) return null;
    return {
      sub: decoded.sub,
      iat: decoded.iat as number,
      exp: decoded.exp as number,
      v: typeof decoded.v === 'number' ? decoded.v : 0,
    };
  } catch {
    return null;
  }
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const result = await pool.query<{ jwt_version: number }>(
    'SELECT jwt_version FROM users WHERE id = $1',
    [payload.sub],
  );
  const user = result.rows[0];
  if (!user || user.jwt_version !== payload.v) return null;
  return payload.sub;
}
