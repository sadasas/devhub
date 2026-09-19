import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { logger } from './shared/logger.js';
import { RoomRegistry } from './modules/realtime/infrastructure/rooms.js';
import { createRealtimeServer } from './modules/realtime/handlers/ws-server.js';
import { attachRoomRegistry } from './modules/realtime/infrastructure/broadcast.js';

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
  // T3 GCal outbox worker: interval in-process 60s (tanpa cron lib baru).
  // - Di-skip saat NODE_ENV=test agar suite vitest deterministik.
  // - Nonaktifkan via GCAL_OUTBOX_POLL=false bila scheduler eksternal
  //   (systemd timer / pg_cron) memanggil POST /api/v1/integrations/gcal/outbox/process.
  // - Aman multi-instance: SELECT due + satu-pending-per-task (coalescing) membuat
  //   double-process idempoten (insert→patch via event_map).
  if (config.NODE_ENV !== 'test' && process.env.GCAL_OUTBOX_POLL !== 'false') {
    const timer = setInterval(() => {
      void import('./modules/integrations/gcal/application/sync-service.js')
        .then((m) => m.processOutbox())
        .catch((err: unknown) => {
          logger.warn('gcal outbox poll failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }, 60_000);
    timer.unref();
  }
  // M31 mail outbox worker: interval in-process 60s (tanpa cron lib baru).
  // - Di-skip saat NODE_ENV=test agar suite vitest deterministik.
  // - Di-skip saat MAIL_ENABLED=false (kill-switch: antrean ditahan, tidak kirim).
  // - Nonaktifkan via MAIL_OUTBOX_POLL=false bila scheduler eksternal
  //   memanggil POST /api/v1/mail/outbox/process.
  // - Aman multi-instance: SELECT ... FOR UPDATE SKIP LOCKED membuat
  //   double-process tidak mengambil baris yang sama.
  if (config.NODE_ENV !== 'test' && config.MAIL_ENABLED && process.env.MAIL_OUTBOX_POLL !== 'false') {
    const mailTimer = setInterval(() => {
      void import('./modules/mail/outbox.js')
        .then((m) => m.processMailOutbox())
        .catch((err: unknown) => {
          logger.warn('mail outbox poll failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }, 60_000);
    mailTimer.unref();
  }
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