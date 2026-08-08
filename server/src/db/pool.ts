import { Pool } from 'pg';
import { loadConfig } from '../config.js';

export function createPool(env: NodeJS.ProcessEnv = process.env): Pool {
  const cfg = loadConfig(env);
  return new Pool({ connectionString: cfg.DATABASE_URL });
}

export const pool = createPool();
