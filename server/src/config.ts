import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv({ quiet: true });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_TEST: z.string().optional(),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .refine(
      (v) => v !== 'change-me-to-a-random-string-of-at-least-32-chars',
      'JWT_SECRET must be replaced with a unique random string before running',
    ),
  PORT: z.coerce.number().int().positive().default(3000),
  PG_POOL_MAX: z.coerce.number().int().min(1).max(50).default(20),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  CORS_ORIGIN: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  PAKASIR_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  PAKASIR_SANDBOX: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  PAKASIR_SLUG: z.string().max(200).default(''),
  PAKASIR_API_KEY: z.string().max(500).default(''),
  APP_PUBLIC_URL: z.string().max(500).default(''),
  // OAuth social login — keep email+password, additive (030_social_auth)
  GOOGLE_CLIENT_ID: z.string().max(500).default(''),
  GOOGLE_CLIENT_SECRET: z.string().max(500).default(''),
  GITHUB_CLIENT_ID: z.string().max(500).default(''),
  GITHUB_CLIENT_SECRET: z.string().max(500).default(''),
  // Redirect origins — comma-separated extra allowed origins for OAuth callbacks (e.g. Vercel preview)
  OAUTH_REDIRECT_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }
  const data = parsed.data;
  if (data.NODE_ENV === 'production' && !data.COOKIE_SECURE) {
    throw new Error(
      'Invalid environment configuration:\nCOOKIE_SECURE: must be "true" in production (session cookie would be sent over plain HTTP)',
    );
  }
  return data;
}

export const config = loadConfig();
