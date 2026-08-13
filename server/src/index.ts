import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { logger } from './lib/logger.js';

async function main() {
  await migrate(pool);
  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info('devhub-server listening', { port: config.PORT, env: config.NODE_ENV });
  });

  const shutdown = async (signal: string) => {
    logger.info('Shutting down', { signal });
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main().catch((err) => {
  logger.error('Startup failed', { error: err instanceof Error ? err.message : err });
  process.exit(1);
});