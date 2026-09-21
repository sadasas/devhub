/**
 * Outbox transactional email — enqueue + worker retry.
 *
 * - Pola sama dengan GCal outbox: klaim baris due via `FOR UPDATE SKIP LOCKED`
 *   (aman multi-instance), backoff 1m/5m/30m, max 5x → dead-letter
 *   (`next_retry_at` tahun 9999, tetap bisa diaudit).
 * - `sender` di-inject agar unit test bisa pakai fake (tanpa network).
 * - Crash setelah kirim tapi sebelum mark-sent bisa double-send: diterima
 *   (window kecil, email idempoten dari sisi user — link token sekali pakai).
 */
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { config } from '../../config.js';
import { logger } from '../../shared/logger.js';
import { mailTemplateSchema, type MailTemplate, type MailSender, type QueuedMailRow } from './mail.port.js';
import { renderMail, MailTemplateError } from './templates.js';
import { resendSender, MailNotConfiguredError, MailSendError } from './resend.adapter.js';

export const MAIL_MAX_ATTEMPTS = 5;
const DEAD_LETTER_DATE = '9999-01-01T00:00:00.000Z';

function computeNextRetry(attempts: number, now: Date): Date {
  const delayMs = attempts <= 1 ? 60_000 : attempts === 2 ? 300_000 : 1_800_000;
  return new Date(now.getTime() + delayMs);
}

export async function enqueueMail(
  toEmail: string,
  template: MailTemplate,
  payload: Record<string, unknown>,
): Promise<string> {
  const valid = mailTemplateSchema.parse(template);
  const result = await pool.query<{ id: string }>(
    'INSERT INTO mail_outbox (to_email, template, payload) VALUES ($1, $2, $3) RETURNING id',
    [toEmail.trim().toLowerCase(), valid, JSON.stringify(payload)],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Failed to enqueue mail');
  return id;
}

async function markSent(id: string): Promise<void> {
  await pool.query("UPDATE mail_outbox SET status = 'sent', sent_at = now(), last_error = NULL WHERE id = $1", [id]);
}

async function markRetry(id: string, attempts: number, errMessage: string, now: Date): Promise<void> {
  if (attempts >= MAIL_MAX_ATTEMPTS) {
    await pool.query(
      "UPDATE mail_outbox SET status = 'failed', attempts = $2, next_retry_at = $3, last_error = $4 WHERE id = $1",
      [id, attempts, DEAD_LETTER_DATE, errMessage],
    );
    logger.warn('mail outbox dead-letter', { outboxId: id, attempts, error: errMessage });
    return;
  }
  await pool.query(
    'UPDATE mail_outbox SET attempts = $2, next_retry_at = $3, last_error = $4 WHERE id = $1',
    [id, attempts, computeNextRetry(attempts, now).toISOString(), errMessage],
  );
}

async function markFailedPermanent(id: string, attempts: number, errMessage: string): Promise<void> {
  await pool.query(
    "UPDATE mail_outbox SET status = 'failed', attempts = $2, next_retry_at = $3, last_error = $4 WHERE id = $1",
    [id, attempts, DEAD_LETTER_DATE, errMessage],
  );
}

async function holdForConfig(id: string, errMessage: string): Promise<void> {
  // MAIL belum dikonfigurasi (kill-switch / key kosong): tahan antrean tanpa
  // membakar attempts — flush otomatis saat konfigurasi dilengkapi.
  await pool.query(
    'UPDATE mail_outbox SET next_retry_at = $2, last_error = $3 WHERE id = $1',
    [id, new Date(Date.now() + 60_000).toISOString(), errMessage],
  );
}

export async function processMailOutbox(
  sender: MailSender = resendSender,
  limit = 50,
): Promise<{ processed: number; succeeded: number; failed: number; pending: number }> {
  const now = new Date();
  const claimed = await pool.query<QueuedMailRow>(
    `SELECT id, to_email, template, payload, attempts
       FROM mail_outbox
      WHERE status = 'pending' AND next_retry_at <= now() AND attempts < $1
      ORDER BY created_at
      LIMIT $2
      FOR UPDATE SKIP LOCKED`,
    [MAIL_MAX_ATTEMPTS, limit],
  );

  let succeeded = 0;
  let failed = 0;
  for (const row of claimed.rows) {
    const attempts = row.attempts + 1;
    try {
      const template = mailTemplateSchema.parse(row.template);
      const rendered = renderMail(template, row.payload, config.APP_PUBLIC_URL);
      const sent = await sender.send({ to: row.to_email, ...rendered });
      await markSent(row.id);
      logger.info('mail sent', { outboxId: row.id, template, providerId: sent.id });
      succeeded += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof MailNotConfiguredError) {
        await holdForConfig(row.id, message);
      } else if (
        err instanceof MailTemplateError ||
        err instanceof z.ZodError ||
        (err instanceof MailSendError && !err.retryable)
      ) {
        await markFailedPermanent(row.id, attempts, message);
      } else {
        await markRetry(row.id, attempts, message, now);
      }
      logger.warn('mail failed', { outboxId: row.id, error: message });
      failed += 1;
    }
  }

  const pending = await pool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM mail_outbox WHERE status = 'pending'",
  );
  return { processed: claimed.rows.length, succeeded, failed, pending: Number(pending.rows[0]?.count ?? '0') };
}
