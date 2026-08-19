-- 016_mcp_key_enc: penyimpanan key terenkripsi untuk re-reveal (fitur copy full key)
-- AES-256-GCM via server/src/mcp/key-crypto.ts; NULL = key lama (sebelum
-- fitur ini) yang tidak bisa di-reveal.
ALTER TABLE mcp_keys ADD COLUMN IF NOT EXISTS key_enc text;