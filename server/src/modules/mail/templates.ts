/**
 * Template email transaksional — fungsi TS polos (tanpa react-email).
 *
 * - Semua interpolasi user di-escape (`escapeHtml`) — anti XSS di client email.
 * - Link memakai `APP_PUBLIC_URL` (tidak pernah hardcode domain).
 * - Payload divalidasi zod: gagal validasi = permanent failure (tidak di-retry).
 */
import { z } from 'zod';
import type { MailTemplate, RenderedMail } from './mail.port.js';

export class MailTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MailTemplateError';
  }
}

const resetPayloadSchema = z.object({
  token: z.string().min(10).max(500),
  expiresMinutes: z.number().int().positive().max(24 * 60).default(60),
});

const invitePayloadSchema = z.object({
  teamName: z.string().trim().min(1).max(300),
  role: z.enum(['admin', 'editor', 'viewer']),
  expiresDays: z.number().int().positive().max(30).default(7),
});

const verifyPayloadSchema = z.object({
  token: z.string().min(10).max(500),
  expiresHours: z.number().int().positive().max(72).default(24),
});

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(title: string, bodyHtml: string, bodyText: string): RenderedMail {
  const safeTitle = escapeHtml(title);
  return {
    subject: `DevHub — ${title}`,
    html: `<!doctype html><html><body style="font-family:sans-serif;line-height:1.6;color:#111">`
      + `<h2 style="margin:0 0 12px">DevHub</h2>`
      + `<h3 style="margin:0 0 12px">${safeTitle}</h3>`
      + bodyHtml
      + `<hr style="margin:24px 0;border:none;border-top:1px solid #ddd">`
      + `<p style="font-size:12px;color:#666">Email otomatis DevHub — jangan dibalas.</p>`
      + `</body></html>`,
    text: `DevHub — ${title}\n\n${bodyText}\n\n--\nEmail otomatis DevHub — jangan dibalas.`,
  };
}

function resetTemplate(appUrl: string, payload: unknown): RenderedMail {
  const parsed = resetPayloadSchema.safeParse(payload);
  if (!parsed.success) throw new MailTemplateError(`Invalid reset payload: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  const link = `${appUrl}/reset-password?token=${encodeURIComponent(parsed.data.token)}`;
  return shell(
    'Reset password',
    `<p>Klik tombol di bawah untuk mengatur password baru (berlaku ${parsed.data.expiresMinutes} menit):</p>`
      + `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 20px;background:#0d7a5f;color:#fff;text-decoration:none;border-radius:6px">Reset password</a></p>`
      + `<p style="font-size:12px;color:#666">Jika tombol tidak berfungsi, salin link ini:<br>${escapeHtml(link)}</p>`
      + `<p style="font-size:12px;color:#666">Tidak meminta reset? Abaikan email ini.</p>`,
    `Klik link berikut untuk mengatur password baru (berlaku ${parsed.data.expiresMinutes} menit):\n${link}\n\nTidak meminta reset? Abaikan email ini.`,
  );
}

function inviteTemplate(appUrl: string, payload: unknown): RenderedMail {
  const parsed = invitePayloadSchema.safeParse(payload);
  if (!parsed.success) throw new MailTemplateError(`Invalid invite payload: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  const teamName = escapeHtml(parsed.data.teamName);
  const link = `${appUrl}/invites`;
  return shell(
    `Undangan team ${parsed.data.teamName}`,
    `<p>Kamu diundang ke team <strong>${teamName}</strong> sebagai <strong>${parsed.data.role}</strong> (berlaku ${parsed.data.expiresDays} hari).</p>`
      + `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 20px;background:#0d7a5f;color:#fff;text-decoration:none;border-radius:6px">Lihat undangan</a></p>`
      + `<p style="font-size:12px;color:#666">Atau buka: ${escapeHtml(link)}</p>`,
    `Kamu diundang ke team "${parsed.data.teamName}" sebagai ${parsed.data.role} (berlaku ${parsed.data.expiresDays} hari).\nLihat undangan: ${link}`,
  );
}

function verifyTemplate(appUrl: string, payload: unknown): RenderedMail {
  const parsed = verifyPayloadSchema.safeParse(payload);
  if (!parsed.success) throw new MailTemplateError(`Invalid verify payload: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  const link = `${appUrl}/verify-email?token=${encodeURIComponent(parsed.data.token)}`;
  return shell(
    'Verifikasi email',
    `<p>Klik tombol di bawah untuk memverifikasi email kamu (berlaku ${parsed.data.expiresHours} jam):</p>`
      + `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 20px;background:#0d7a5f;color:#fff;text-decoration:none;border-radius:6px">Verifikasi email</a></p>`
      + `<p style="font-size:12px;color:#666">Jika tombol tidak berfungsi, salin link ini:<br>${escapeHtml(link)}</p>`,
    `Klik link berikut untuk memverifikasi email kamu (berlaku ${parsed.data.expiresHours} jam):\n${link}`,
  );
}

export function renderMail(template: MailTemplate, payload: unknown, appUrl: string): RenderedMail {
  const base = appUrl.replace(/\/+$/, '');
  if (!base) throw new MailTemplateError('APP_PUBLIC_URL is not configured — link email akan rusak');
  switch (template) {
    case 'reset':
      return resetTemplate(base, payload);
    case 'invite':
      return inviteTemplate(base, payload);
    case 'verify':
      return verifyTemplate(base, payload);
  }
}
