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

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many password attempts, try again later' } },
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<{ id: string }>(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, passwordHash],
    );
    const userId = result.rows[0]?.id;
    if (!userId) throw new ApiError(500, 'INTERNAL', 'Failed to create user');
    await client.query(
      `WITH t AS (
         INSERT INTO teams (name, created_by) VALUES ('Personal', $1) RETURNING id
       )
       INSERT INTO team_members (team_id, user_id, role)
       SELECT id, $1, 'owner' FROM t`,
      [userId],
    );
    await client.query('COMMIT');
    setSessionCookie(res, userId);
    res.status(201).json({ id: userId, email });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if ((err as { code?: string })?.code === '23505') {
      throw new ApiError(409, 'CONFLICT', 'Email already registered');
    }
    throw err;
  } finally {
    client.release();
  }
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

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });

authRouter.patch('/password', passwordLimiter, requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid password data', parsed.error.issues);
  }
  const { currentPassword, newPassword } = parsed.data;
  const result = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId],
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    throw new ApiError(401, 'INVALID_PASSWORD', 'Current password is incorrect');
  }
  const passwordHash = await hashPassword(newPassword);
  await pool.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [
    userId,
    passwordHash,
  ]);
  res.json({ ok: true });
});

const profileSchema = z
  .object({
    displayName: z.string().trim().max(60, 'Display name must be at most 60 characters').optional(),
    bio: z.string().trim().max(500, 'Bio must be at most 500 characters').optional(),
  })
  .refine((v) => v.displayName !== undefined || v.bio !== undefined, {
    message: 'At least one field must be provided',
  });

authRouter.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const result = await pool.query<{ id: string; email: string; display_name: string; bio: string; created_at: string }>(
    'SELECT id, email, display_name, bio, created_at FROM users WHERE id = $1',
    [userId],
  );
  const user = result.rows[0];
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
  res.json(toUser(user));
});

authRouter.patch('/profile', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid profile data', parsed.error.issues);
  }
  const { displayName, bio } = parsed.data;
  const result = await pool.query<ProfileRow>(
    `UPDATE users
     SET display_name = COALESCE($2, display_name),
         bio = COALESCE($3, bio),
         updated_at = now()
     WHERE id = $1
     RETURNING id, email, display_name, bio, created_at`,
    [userId, displayName ?? null, bio ?? null],
  );
  const user = result.rows[0];
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
  res.json(toUser(user));
});

interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  bio: string;
  created_at: string;
}

function toUser(row: ProfileRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    bio: row.bio,
    createdAt: row.created_at,
  };
}
