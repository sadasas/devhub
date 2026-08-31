import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { pool } from '../../../db/pool.js';
import { hashPassword, verifyPassword } from '../infrastructure/password.js';
import { signToken, JWT_TTL_SECONDS } from '../infrastructure/jwt.js';
import { requireAuth, getUserId } from '../middleware/requireAuth.js';
import { ApiError } from '../../../shared/errors.js';
import { SESSION_COOKIE } from '../../../shared/http.js';
import { config } from '../../../config.js';
import { withTransaction, parseOrThrow } from '../../../shared/db.js';
import { computeUserStats } from '../application/user-stats.js';

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
  validate: { trustProxy: false },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts, try again later' } },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many registrations from this IP' } },
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many password attempts, try again later' } },
});

// Dummy hash untuk login timing (audit 2026-08b, AUTH-1): email yang tidak
// terdaftar tetap menjalankan bcrypt.compare sehingga waktu respons seragam.
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!dummyHash) dummyHash = await hashPassword('dummy-password-for-timing');
  return dummyHash;
}

function setSessionCookie(res: Response, userId: string, version: number): void {
  // Deploy lintas-situs (FE di Vercel, BE di Render) mewajibkan SameSite=None + Secure
  // agar cookie sesi ikut dikirim pada fetch/XHR/WS lintas-origin. Produksi = cross-site.
  res.cookie(SESSION_COOKIE, signToken(userId, version), {
    httpOnly: true,
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: config.COOKIE_SECURE,
    maxAge: JWT_TTL_SECONDS * 1000,
    path: '/',
  });
}

export const authRouter = Router();

authRouter.post('/register', registerLimiter, async (req, res) => {
  const { email, password } = parseOrThrow(registerSchema, req.body, 'Invalid registration data');
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new ApiError(409, 'CONFLICT', 'Email already registered');
  }
  const passwordHash = await hashPassword(password);
  let userId: string;
  try {
    userId = await withTransaction(pool, async (client) => {
      const result = await client.query<{ id: string }>(
        'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $1) RETURNING id',
        [email, passwordHash],
      );
      const id = result.rows[0]?.id;
      if (!id) throw new ApiError(500, 'INTERNAL', 'Failed to create user');
      await client.query(
        `WITH t AS (
           INSERT INTO teams (name, created_by) VALUES ('Personal', $1) RETURNING id
         )
         INSERT INTO team_members (team_id, user_id, role)
         SELECT id, $1, 'owner' FROM t`,
        [id],
      );
      return id;
    });
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      throw new ApiError(409, 'CONFLICT', 'Email already registered');
    }
    throw err;
  }
  setSessionCookie(res, userId, 1);
  res.status(201).json({ id: userId, email });
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = parseOrThrow(loginSchema, req.body, 'Invalid login data');
  const result = await pool.query<{ id: string; password_hash: string; jwt_version: number }>(
    'SELECT id, password_hash, jwt_version FROM users WHERE email = $1',
    [email],
  );
  const user = result.rows[0];
  const valid = await verifyPassword(password, user?.password_hash ?? (await getDummyHash()));
  if (!user || !valid) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password');
  }
  setSessionCookie(res, user.id, user.jwt_version);
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
  const { currentPassword, newPassword } = parseOrThrow(
    changePasswordSchema,
    req.body,
    'Invalid password data',
  );
  const result = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId],
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    throw new ApiError(401, 'INVALID_PASSWORD', 'Current password is incorrect');
  }
  const passwordHash = await hashPassword(newPassword);
  const updated = await pool.query<{ jwt_version: number }>(
    'UPDATE users SET password_hash = $2, jwt_version = jwt_version + 1, updated_at = now() WHERE id = $1 RETURNING jwt_version',
    [userId, passwordHash],
  );
  const newVersion = updated.rows[0]?.jwt_version;
  if (!newVersion) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
  setSessionCookie(res, userId, newVersion);
  res.json({ ok: true });
});

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email').max(254),
});

const resetSchema = z.object({
  token: z.string().min(10).max(500),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many reset attempts, try again later' } },
});

const profileSchema = z
  .object({
    displayName: z.string().trim().max(60, 'Display name must be at most 60 characters').optional(),
    bio: z.string().trim().max(500, 'Bio must be at most 500 characters').optional(),
  })
  .refine((v) => v.displayName !== undefined || v.bio !== undefined, {
    message: 'At least one field must be provided',
  });

authRouter.post('/forgot-password', forgotLimiter, async (req, res) => {
  const { email } = parseOrThrow(forgotSchema, req.body, 'Invalid email');
  const result = await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  // Always return ok to avoid email enumeration (even if user not found)
  if (!user) {
    res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' });
    return;
  }
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await pool.query(
    'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1,$2,$3)',
    [token, user.id, expiresAt],
  );
  // For MVP: return token directly (in production, send email)
  // Also invalidate previous unused tokens for this user
  await pool.query(
    "DELETE FROM password_reset_tokens WHERE user_id = $1 AND token != $2 AND used_at IS NULL AND expires_at < now()",
    [user.id, token],
  );
  res.json({
    ok: true,
    message: 'If that email exists, a reset link has been sent.',
    // Expose token in dev/test for e2e; hide in production
    ...(config.NODE_ENV !== 'production' ? { token, expiresAt: expiresAt.toISOString() } : {}),
  });
});

authRouter.post('/reset-password', forgotLimiter, async (req, res) => {
  const { token, newPassword } = parseOrThrow(resetSchema, req.body, 'Invalid reset data');
  const result = await pool.query<{ user_id: string; expires_at: string; used_at: string | null }>(
    'SELECT user_id, expires_at, used_at FROM password_reset_tokens WHERE token = $1',
    [token],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(400, 'INVALID_TOKEN', 'Invalid or expired reset token');
  if (row.used_at) throw new ApiError(400, 'INVALID_TOKEN', 'Reset token already used');
  if (new Date(row.expires_at).getTime() < Date.now()) throw new ApiError(400, 'INVALID_TOKEN', 'Reset token expired');

  const passwordHash = await hashPassword(newPassword);
  await pool.query('BEGIN');
  try {
    await pool.query(
      'UPDATE users SET password_hash = $2, jwt_version = jwt_version + 1, updated_at = now() WHERE id = $1',
      [row.user_id, passwordHash],
    );
    await pool.query('UPDATE password_reset_tokens SET used_at = now() WHERE token = $1', [token]);
    // Invalidate all other reset tokens for user
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND token != $2', [row.user_id, token]);
    // Invalidate OAuth tokens (force re-login for agents)
    await pool.query('DELETE FROM oauth_access_tokens WHERE user_id = $1', [row.user_id]);
    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }
  res.json({ ok: true });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const result = await pool.query<{ id: string; email: string; display_name: string; bio: string; role: string; created_at: string }>(
    'SELECT id, email, display_name, bio, role, created_at FROM users WHERE id = $1',
    [userId],
  );
  const user = result.rows[0];
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'User not found');
  res.json(toUser(user));
});

authRouter.get('/me/stats', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  res.json(await computeUserStats(userId));
});

authRouter.patch('/profile', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const { displayName, bio } = parseOrThrow(profileSchema, req.body, 'Invalid profile data');
  const result = await pool.query<ProfileRow>(
    `UPDATE users
     SET display_name = COALESCE($2, display_name),
         bio = COALESCE($3, bio),
         updated_at = now()
     WHERE id = $1
     RETURNING id, email, display_name, bio, role, created_at`,
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
  role: string;
  created_at: string;
}

function toUser(row: ProfileRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    bio: row.bio,
    role: row.role,
    createdAt: row.created_at,
  };
}
