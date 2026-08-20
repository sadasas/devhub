import { Pool } from 'pg';
import { loadConfig } from '../config.js';

/**
 * Pool hardening (audit 2026-08b, DB-8):
 * - connectionTimeoutMillis: request tidak menggantung selamanya saat DB down
 * - statement_timeout: query besar tidak menahan koneksi tanpa batas
 * - ssl: diwajibkan di production (managed PG / Supabase)
 */
export function createPool(env: NodeJS.ProcessEnv = process.env): Pool {
  const cfg = loadConfig(env);
  const isProduction = cfg.NODE_ENV === 'production';
  return new Pool({
    connectionString: cfg.DATABASE_URL,
    max: cfg.PG_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    options: '-c statement_timeout=30000',
    ...(isProduction ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}

export const pool = createPool();
