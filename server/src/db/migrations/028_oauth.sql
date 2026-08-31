-- 028_oauth: OAuth 2.1 PKCE for MCP public (Authorization Server = DevHub)
-- DCR clients, authorization codes (PKCE S256), access + refresh tokens (rotation)

CREATE TABLE IF NOT EXISTS oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text UNIQUE NOT NULL,
  client_secret text,
  redirect_uris text[] NOT NULL DEFAULT '{}',
  client_name text,
  client_uri text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code text PRIMARY KEY,
  client_id text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  scope text NOT NULL DEFAULT 'mcp',
  code_challenge text NOT NULL,
  code_challenge_method text NOT NULL CHECK (code_challenge_method = 'S256'),
  resource text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_client ON oauth_authorization_codes (client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_user ON oauth_authorization_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON oauth_authorization_codes (expires_at);

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  token text PRIMARY KEY,
  client_id text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'mcp',
  resource text,
  expires_at timestamptz NOT NULL,
  refresh_token text UNIQUE,
  refresh_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_client ON oauth_access_tokens (client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_access_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_refresh ON oauth_access_tokens (refresh_token);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_access_tokens (expires_at);
