import { type Pool, type PoolClient } from 'pg';
import type { ZodType } from 'zod';
import { ApiError } from './errors.js';

export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    }
  } finally {
    client.release();
  }
}

export function parseOrThrow<T>(
  schema: ZodType<T>,
  body: unknown,
  message: string,
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', message, parsed.error.issues);
  }
  return parsed.data;
}