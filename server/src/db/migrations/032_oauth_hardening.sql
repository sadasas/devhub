-- 032_oauth_hardening: consent + token hash (C1, C4, H5)
-- Consent per user+client for OAuth auto-approve mitigation
CREATE TABLE IF NOT EXISTS oauth_consents (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_consents_user ON oauth_consents(user_id);

-- Token hashing: store sha256 hex, keep plaintext column for existing rows during transition
ALTER TABLE oauth_access_tokens ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE oauth_access_tokens ADD COLUMN IF NOT EXISTS refresh_token_hash text;

-- Backfill hash from plaintext where missing (pgcrypto extension may not be installed; use encode+sha256 if available, else leave NULL and app will backfill on next use)
-- Try pgcrypto, ignore if not available
DO $$
BEGIN
  PERFORM 1 FROM pg_extension WHERE extname = 'pgcrypto';
  IF FOUND THEN
    EXECUTE 'UPDATE oauth_access_tokens SET token_hash = encode(digest(token, ''sha256''), ''hex'') WHERE token_hash IS NULL AND token IS NOT NULL';
    EXECUTE 'UPDATE oauth_access_tokens SET refresh_token_hash = encode(digest(refresh_token, ''sha256''), ''hex'') WHERE refresh_token_hash IS NULL AND refresh_token IS NOT NULL';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_oauth_tokens_token_hash ON oauth_access_tokens(token_hash) WHERE token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_oauth_tokens_refresh_hash ON oauth_access_tokens(refresh_token_hash) WHERE refresh_token_hash IS NOT NULL;
