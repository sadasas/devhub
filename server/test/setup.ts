import { afterAll, beforeAll } from 'vitest';
import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';

export async function resetDb(): Promise<void> {
  await pool.query('TRUNCATE mcp_keys, projects, users RESTART IDENTITY CASCADE');
}

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});
