import 'cookie-parser';
import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { signToken, JWT_TTL_SECONDS } from '../auth/jwt.js';
import { requireAuth, getUserId } from '../auth/middleware/requireAuth.js';
import { SESSION_COOKIE, ApiError } from '../app.js';
import { config } from '../config.js';

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email').max(254),
  password: z.string().min(1).max(128),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts, try again later' } },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many registrations from this IP' } },
});

function setSessionCookie(res: Response, userId: string): void {
  res.cookie(SESSION_COOKIE, signToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.COOKIE_SECURE,
    maxAge: JWT_TTL_SECONDS * 1000,
    path: '/',
  });
}

export const authRouter = Router();

authRouter.post('/register', registerLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid registration data', parsed.error.issues);
  }
  const { email, password } = parsed.data;
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new ApiError(409, 'CONFLICT', 'Email already registered');
  }
  const passwordHash = await hashPassword(password);
  const result = await pool.query<{ id: string }>(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
    [email, passwordHash],
  );
  const userId = result.rows[0]?.id;
  if (!userId) throw new ApiError(500, 'INTERNAL', 'Failed to create user');
  setSessionCookie(res, userId);
  res.status(201).json({ id: userId, email });
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid login data', parsed.error.issues);
  }
  const { email, password } = parsed.data;
  const result = await pool.query<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE email = $1',
    [email],
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password');
  }
  setSessionCookie(res, user.id);
  res.json({ id: user.id, email });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const result = await pool.query<{ id: string; email: string }>(
    'SELECT id, email FROM users WHERE id = $1',
    [userId],
  );
  const user = result.rows[0];
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
  res.json(user);
});
