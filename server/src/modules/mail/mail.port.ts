/**
 * Port pengiriman email transaksional (ADR: Resend SDK + MailPort + mail_outbox).
 *
 * - Satu-satunya implementasi adalah `resend.adapter.ts` (satu-satunya file
 *   yang boleh `import 'resend'`). Pindah provider = ganti 1 adapter.
 * - Template dirender dari fungsi TS polos (`templates.ts`), tanpa react-email.
 */
import { z } from 'zod';

export const mailTemplateSchema = z.enum(['reset', 'invite', 'verify']);
export type MailTemplate = z.infer<typeof mailTemplateSchema>;

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

export interface MailSendResult {
  /** ID dari provider (Resend `data.id`) — untuk korelasi log. */
  id: string;
}

export interface MailSender {
  send(input: { to: string; subject: string; html: string; text: string }): Promise<MailSendResult>;
}

export interface QueuedMailRow {
  id: string;
  to_email: string;
  template: string;
  payload: unknown;
  attempts: number;
}
