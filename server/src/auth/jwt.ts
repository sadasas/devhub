import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const JWT_TTL_SECONDS = 24 * 60 * 60; // 24h

export interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
}

export function signToken(userId: string): string {
  return jwt.sign({}, config.JWT_SECRET, {
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
    };
  } catch {
    return null;
  }
}
