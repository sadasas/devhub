-- 002_mcp_keys: per-user MCP API keys (raw keys never stored, only SHA-256 hashes)
CREATE TABLE IF NOT EXISTS mcp_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  key_hash text NOT NULL,
  prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mcp_keys_user_id ON mcp_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_keys_key_hash ON mcp_keys (key_hash);
