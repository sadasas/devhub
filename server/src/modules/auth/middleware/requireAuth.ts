import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../../shared/errors.js';
import { SESSION_COOKIE } from '../../../shared/http.js';
import { verifySession } from '../infrastructure/jwt.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const userId = await verifySession(token);
    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Session expired or invalid');
    }
    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}

export function getUserId(req: Request): string {
  if (!req.userId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return req.userId;
}
