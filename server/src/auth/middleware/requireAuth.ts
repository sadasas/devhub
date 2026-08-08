import type { NextFunction, Request, Response } from 'express';
import { SESSION_COOKIE, ApiError } from '../../app.js';
import { verifyToken } from '../jwt.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const payload = verifyToken(token);
  if (!payload) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired or invalid');
  }
  req.userId = payload.sub;
  next();
}

export function getUserId(req: Request): string {
  if (!req.userId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return req.userId;
}
