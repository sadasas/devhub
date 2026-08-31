-- 030_social_auth: Google & GitHub OAuth (keep email+password, Opsi A auto-link verified)
-- - users.password_hash nullable -> OAuth-only user
-- - users.avatar_url + email_verified
-- - oauth_accounts normalized (google/github)

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google','github')),
  provider_account_id text NOT NULL,
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_account_id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts (provider, provider_account_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_email ON oauth_accounts (email);
