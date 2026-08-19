import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { Pool } from 'pg';
import { loadConfig } from '../config.js';
import { logger } from '../lib/logger.js';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

const MIGRATION_LOCK_KEY = 727_403_101; // hashtext('devhub_migrations')

export async function migrate(pool: Pool): Promise<string[]> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const executed: string[] = [];
  const client = await pool.connect();
  try {
    // Advisory lock: pastikan hanya satu instance yang apply migrasi
    // (multi-instance deploy bisa start bersamaan dan double-apply).
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    try {
      // Snapshot `applied` dibaca SETELAH lock diakuisisi (audit 2026-08b, DB-7):
      // instance kedua yang menunggu lock tidak boleh memakai snapshot basi.
      const applied = new Set(
        (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map(
          (r) => r.name,
        ),
      );
      for (const file of files) {
        if (applied.has(file)) continue;
        const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          executed.push(file);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {});
    }
  } finally {
    client.release();
  }
  return executed;
}

async function main() {
  const cfg = loadConfig();
  const pool = new Pool({ connectionString: cfg.DATABASE_URL });
  try {
    const executed = await migrate(pool);
    if (executed.length === 0) {
      logger.info('No pending migrations.');
    } else {
      logger.info(`Applied migrations: ${executed.join(', ')}`);
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((err) => {
    logger.error('Migration failed', { error: err instanceof Error ? err.message : err });
    process.exit(1);
  });
}