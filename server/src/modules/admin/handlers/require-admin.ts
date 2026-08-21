import type { NextFunction, Request, Response } from 'express';
import { pool } from '../../../db/pool.js';
import { ApiError } from '../../../shared/errors.js';

export async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const result = await pool.query<{ role: string }>('SELECT role FROM users WHERE id = $1', [
      req.userId,
    ]);
    if (result.rows[0]?.role !== 'admin') {
      throw new ApiError(403, 'FORBIDDEN', 'Admin access required');
    }
    next();
  } catch (err) {
    next(err);
  }
}
