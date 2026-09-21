-- 041_mail_outbox: antrean transactional email (Resend) + token verifikasi email
-- - mail_outbox: antrean kirim (reset/invite/verify) dengan retry/backoff via worker
-- - email_verify_tokens: token verifikasi 24 jam sekali pakai (pola 029_password_reset)
-- Idempoten (IF NOT EXISTS); rollback: DROP TABLE (data antrean hilang).

CREATE TABLE IF NOT EXISTS mail_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  template text NOT NULL CHECK (template IN ('reset', 'invite', 'verify')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_mail_outbox_status_retry ON mail_outbox (status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_mail_outbox_template ON mail_outbox (template);

CREATE TABLE IF NOT EXISTS email_verify_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_verify_user ON email_verify_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_email_verify_expires ON email_verify_tokens (expires_at);
