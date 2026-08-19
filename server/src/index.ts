import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { logger } from './lib/logger.js';
import { RoomRegistry } from './realtime/rooms.js';
import { createRealtimeServer } from './realtime/ws-server.js';
import { attachRoomRegistry } from './realtime/broadcast.js';

async function main() {
  await migrate(pool);
  // Peringatan boot (audit 2026-08b, CFG-1): di belakang reverse proxy,
  // TRUST_PROXY=true wajib agar rate limit & trust proxy memakai IP client.
  if (config.NODE_ENV === 'production' && !config.TRUST_PROXY) {
    logger.warn(
      'TRUST_PROXY=false in production — jika server berada di belakang reverse proxy, ' +
        'rate limiting akan memakai IP proxy (semua pengguna berbagi satu bucket). Set TRUST_PROXY=true.',
    );
  }
  const app = createApp();
  const server = http.createServer(app);
  const registry = new RoomRegistry();
  attachRoomRegistry(registry);
  const realtime = createRealtimeServer(server, registry);
  server.listen(config.PORT, () => {
    logger.info('devhub-server listening', { port: config.PORT, env: config.NODE_ENV });
  });

  const shutdown = async (signal: string) => {
    logger.info('Shutting down', { signal });
    realtime.close();
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Fail-fast untuk rejection/exception tak tertangkap (audit 2026-08b, WS-1):
  // Node ≥15 crash default pada unhandledRejection, tapi tanpa log konteks.
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      error: reason instanceof Error ? reason.stack ?? reason.message : reason,
    });
    process.exit(1);
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.stack ?? err.message });
    process.exit(1);
  });
}

void main().catch((err) => {
  logger.error('Startup failed', { error: err instanceof Error ? err.message : err });
  process.exit(1);
});