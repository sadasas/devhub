import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../src/db/pool.js';
import { config } from '../src/config.js';
import { resetDb } from './setup.js';
import { renderMail, escapeHtml, MailTemplateError } from '../src/modules/mail/templates.js';
import { resendSender, MailNotConfiguredError, MailSendError } from '../src/modules/mail/resend.adapter.js';
import { enqueueMail, processMailOutbox } from '../src/modules/mail/outbox.js';

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
    constructor(_apiKey?: string) {}
  },
}));

const APP_URL = 'https://app.test';

async function cleanupMail(): Promise<void> {
  await pool.query("DELETE FROM mail_outbox WHERE to_email LIKE 'mailtest-%'");
}

describe('mail templates (6 kasus)', () => {
  it('1) reset: link token + expiry di html dan text', () => {
    const rendered = renderMail('reset', { token: 'test-token-reset-0001' }, APP_URL);
    expect(rendered.subject).toContain('Reset password');
    expect(rendered.html).toContain(`${APP_URL}/reset-password?token=test-token-reset-0001`);
    expect(rendered.text).toContain('60 menit');
  });

  it('2) invite: nama team + role + link /invites', () => {
    const rendered = renderMail('invite', { teamName: 'Tim Alfa', role: 'editor' }, APP_URL);
    expect(rendered.html).toContain('Tim Alfa');
    expect(rendered.html).toContain('editor');
    expect(rendered.html).toContain(`${APP_URL}/invites`);
  });

  it('3) verify: link token 24 jam', () => {
    const rendered = renderMail('verify', { token: 'test-token-verify-0001' }, APP_URL);
    expect(rendered.html).toContain(`${APP_URL}/verify-email?token=test-token-verify-0001`);
    expect(rendered.text).toContain('24 jam');
  });

  it('4) XSS: nama team di-escape', () => {
    const rendered = renderMail('invite', { teamName: '<script>alert(1)</script>', role: 'viewer' }, APP_URL);
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(escapeHtml('"a"&\'b\'')).toBe('&quot;a&quot;&amp;&#39;b&#39;');
  });

  it('5) payload invalid → MailTemplateError (permanen, tidak di-retry)', () => {
    expect(() => renderMail('reset', { token: 'x' }, APP_URL)).toThrow(MailTemplateError);
    expect(() => renderMail('invite', { teamName: 'T', role: 'owner' }, APP_URL)).toThrow(MailTemplateError);
  });

  it('6) APP_PUBLIC_URL kosong → MailTemplateError (link akan rusak)', () => {
    expect(() => renderMail('reset', { token: 'test-token-reset-0001' }, '')).toThrow(MailTemplateError);
  });
});

describe('resend adapter (4 kasus, mocked)', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('1) disabled (MAIL_ENABLED=false) → MailNotConfiguredError tanpa network', async () => {
    const prev = config.MAIL_ENABLED;
    config.MAIL_ENABLED = false;
    try {
      await expect(resendSender.send({ to: 'a@b.c', subject: 's', html: 'h', text: 't' })).rejects.toThrow(
        MailNotConfiguredError,
      );
      expect(mockSend).not.toHaveBeenCalled();
    } finally {
      config.MAIL_ENABLED = prev;
    }
  });

  it('2) sukses → return provider id', async () => {
    mockSend.mockResolvedValue({ data: { id: 'mail_123' }, error: null });
    const prevEnabled = config.MAIL_ENABLED;
    const prevKey = config.RESEND_API_KEY;
    const prevFrom = config.MAIL_FROM;
    config.MAIL_ENABLED = true;
    config.RESEND_API_KEY = 're_test';
    config.MAIL_FROM = 'DevHub <test@app.test>';
    try {
      const result = await resendSender.send({ to: 'a@b.c', subject: 's', html: 'h', text: 't' });
      expect(result).toEqual({ id: 'mail_123' });
      expect(mockSend).toHaveBeenCalledOnce();
    } finally {
      config.MAIL_ENABLED = prevEnabled;
      config.RESEND_API_KEY = prevKey;
      config.MAIL_FROM = prevFrom;
    }
  });

  it('3) rate_limit_exceeded → MailSendError retryable', async () => {
    mockSend.mockResolvedValue({ data: null, error: { name: 'rate_limit_exceeded', message: 'slow down' } });
    const prevEnabled = config.MAIL_ENABLED;
    const prevKey = config.RESEND_API_KEY;
    const prevFrom = config.MAIL_FROM;
    config.MAIL_ENABLED = true;
    config.RESEND_API_KEY = 're_test';
    config.MAIL_FROM = 'DevHub <test@app.test>';
    try {
      const err = await resendSender.send({ to: 'a@b.c', subject: 's', html: 'h', text: 't' }).catch((e) => e);
      expect(err).toBeInstanceOf(MailSendError);
      expect((err as MailSendError).retryable).toBe(true);
    } finally {
      config.MAIL_ENABLED = prevEnabled;
      config.RESEND_API_KEY = prevKey;
      config.MAIL_FROM = prevFrom;
    }
  });

  it('4) validation_error → MailSendError permanen', async () => {
    mockSend.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'bad to' } });
    const prevEnabled = config.MAIL_ENABLED;
    const prevKey = config.RESEND_API_KEY;
    const prevFrom = config.MAIL_FROM;
    config.MAIL_ENABLED = true;
    config.RESEND_API_KEY = 're_test';
    config.MAIL_FROM = 'DevHub <test@app.test>';
    try {
      const err = await resendSender.send({ to: 'a@b.c', subject: 's', html: 'h', text: 't' }).catch((e) => e);
      expect(err).toBeInstanceOf(MailSendError);
      expect((err as MailSendError).retryable).toBe(false);
    } finally {
      config.MAIL_ENABLED = prevEnabled;
      config.RESEND_API_KEY = prevKey;
      config.MAIL_FROM = prevFrom;
    }
  });
});

describe('mail outbox (3 kasus, DB test)', () => {
  beforeEach(async () => {
    await resetDb();
    await cleanupMail();
  });
  afterEach(async () => {
    await cleanupMail();
  });

  it('1) enqueue → process sukses dengan fake sender', async () => {
    const id = await enqueueMail('mailtest-a@app.test', 'reset', { token: 'test-token-reset-0001' });
    expect(id).toBeDefined();
    const result = await processMailOutbox(
      { send: async () => ({ id: 'fake-1' }) },
      50,
    );
    expect(result).toMatchObject({ processed: 1, succeeded: 1, failed: 0, pending: 0 });
    const row = await pool.query<{ status: string }>('SELECT status FROM mail_outbox WHERE id = $1', [id]);
    expect(row.rows[0]?.status).toBe('sent');
  });

  it('2) sender gagal → retry lalu dead-letter di attempts ke-5', async () => {
    const id = await enqueueMail('mailtest-b@app.test', 'verify', { token: 'test-token-verify-0001' });
    const failing = {
      send: async (): Promise<{ id: string }> => {
        throw new MailSendError('boom', true);
      },
    };
    const first = await processMailOutbox(failing, 50);
    expect(first).toMatchObject({ processed: 1, succeeded: 0, failed: 1 });
    const mid = await pool.query<{ status: string; attempts: number }>(
      'SELECT status, attempts FROM mail_outbox WHERE id = $1',
      [id],
    );
    expect(mid.rows[0]).toMatchObject({ status: 'pending', attempts: 1 });
    // Paksa ke percobaan terakhir lalu proses lagi → dead-letter.
    await pool.query("UPDATE mail_outbox SET attempts = 4, next_retry_at = now() WHERE id = $1", [id]);
    await processMailOutbox(failing, 50);
    const end = await pool.query<{ status: string; attempts: number; next_retry_at: Date }>(
      'SELECT status, attempts, next_retry_at FROM mail_outbox WHERE id = $1',
      [id],
    );
    expect(end.rows[0]?.status).toBe('failed');
    expect(end.rows[0]?.attempts).toBe(5);
    expect(end.rows[0]?.next_retry_at.getFullYear()).toBe(9999);
  });

  it('3) payload invalid di DB → failed permanen tanpa bakar retry', async () => {
    // CHECK constraint menolak template invalid duluan (defense-in-depth),
    // jadi jalur permanen worker diuji via payload yang gagal validasi zod.
    const inserted = await pool.query<{ id: string }>(
      "INSERT INTO mail_outbox (to_email, template, payload) VALUES ('mailtest-c@app.test', 'reset', '{}') RETURNING id",
    );
    const id = inserted.rows[0]?.id;
    const result = await processMailOutbox({ send: async () => ({ id: 'x' }) }, 50);
    expect(result.failed).toBe(1);
    const row = await pool.query<{ status: string; attempts: number }>(
      'SELECT status, attempts FROM mail_outbox WHERE id = $1',
      [id],
    );
    expect(row.rows[0]).toMatchObject({ status: 'failed', attempts: 1 });
  });
});
