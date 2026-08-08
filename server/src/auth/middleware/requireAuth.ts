import type { NextFunction, Request, Response } from 'express';
import { SESSION_COOKIE, ApiError } from '../../app.js';
import { verifyToken } from '../jwt.js';

export interface AuthedRequest extends Request {
  userId: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const payload = verifyToken(token);
  if (!payload) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired or invalid');
  }
  (req as AuthedRequest).userId = payload.sub;
  next();
}
