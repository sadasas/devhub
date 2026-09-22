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

function shell(title: string, bodyHtml: string, bodyText: string, appUrl: string): RenderedMail {
  const safeTitle = escapeHtml(title);
  const logoUrl = `${appUrl}/logo-email.png`;
  return {
    subject: `DevHub — ${title}`,
    html: `<!doctype html><html><body style="margin:0;padding:0;background-color:#f4f4f4;font-family:sans-serif;line-height:1.6;color:#111111">`
      + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4"><tr><td align="center" style="padding:24px 12px">`
      + `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px">`
      + `<tr><td style="padding:24px 28px 0">`
      + `<img src="${escapeHtml(logoUrl)}" width="32" height="32" alt="DevHub" style="display:inline-block;vertical-align:middle;border:0">`
      + `<span style="display:inline-block;vertical-align:middle;font-size:20px;font-weight:bold;margin-left:10px">DevHub</span>`
      + `</td></tr>`
      + `<tr><td style="padding:0 28px"><hr style="border:none;border-top:1px solid #dddddd;margin:16px 0"></td></tr>`
      + `<tr><td style="padding:0 28px"><h3 style="margin:0 0 12px;font-size:18px">${safeTitle}</h3></td></tr>`
      + `<tr><td style="padding:0 28px">${bodyHtml}</td></tr>`
      + `<tr><td style="padding:0 28px"><hr style="border:none;border-top:1px solid #dddddd;margin:24px 0 12px"></td></tr>`
      + `<tr><td style="padding:0 28px 24px;font-size:12px;color:#666666">`
      + `Email otomatis DevHub — jangan dibalas.<br>${escapeHtml(appUrl)}`
      + `</td></tr>`
      + `</table></td></tr></table>`
      + `</body></html>`,
    text: `DevHub — ${title}\n\n${bodyText}\n\n--\nEmail otomatis DevHub — jangan dibalas.\n${appUrl}`,
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
    appUrl,
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
    appUrl,
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
    appUrl,
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
