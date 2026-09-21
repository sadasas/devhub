/**
 * SATU-SATUNYA file yang boleh `import 'resend'`.
 *
 * - Hormati kill-switch `MAIL_ENABLED=false` (antrean tetap jalan, kirim ditunda).
 * - Bedakan error permanen (validasi → tidak di-retry) vs retryable (rate-limit,
 *   5xx, network → backoff via outbox).
 */
import { Resend } from 'resend';
import { config } from '../../config.js';
import type { MailSender } from './mail.port.js';

export class MailNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MailNotConfiguredError';
  }
}

export class MailSendError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.name = 'MailSendError';
    this.retryable = retryable;
  }
}

let client: Resend | null = null;

function getClient(): Resend {
  if (!config.MAIL_ENABLED) {
    throw new MailNotConfiguredError('MAIL_ENABLED=false — pengiriman email dimatikan, antrean ditahan');
  }
  if (!config.RESEND_API_KEY) {
    throw new MailNotConfiguredError('RESEND_API_KEY belum diisi');
  }
  if (!config.MAIL_FROM) {
    throw new MailNotConfiguredError('MAIL_FROM belum diisi');
  }
  client ??= new Resend(config.RESEND_API_KEY);
  return client;
}

/** Validation error Resend (422 dsb) = permanen; sisanya retryable. */
function isPermanentResendErrorName(name: string | undefined): boolean {
  return name === 'validation_error';
}

export const resendSender: MailSender = {
  async send({ to, subject, html, text }) {
    const c = getClient();
    let result: Awaited<ReturnType<typeof c.emails.send>>;
    try {
      result = await c.emails.send({ from: config.MAIL_FROM, to, subject, html, text });
    } catch (err: unknown) {
      throw new MailSendError(err instanceof Error ? err.message : String(err), true);
    }
    if (result.error) {
      throw new MailSendError(
        `${result.error.name}: ${result.error.message}`,
        !isPermanentResendErrorName(result.error.name),
      );
    }
    if (!result.data) {
      throw new MailSendError('Resend returned no data and no error', true);
    }
    return { id: result.data.id };
  },
};
