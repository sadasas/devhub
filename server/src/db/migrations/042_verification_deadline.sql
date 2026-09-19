-- 042_verification_deadline: grandfather 14 hari untuk user lama belum verified (T6).
-- - users.verification_deadline NULL = hard gate murni (user baru, wajib verified).
-- - User lama (email_verified=false + password_hash NOT NULL) dapat deadline
--   now()+14 hari: tetap bisa login selama grace, banner di UI, lewat itu kena gate.
-- - User OAuth (password_hash NULL) tidak butuh deadline — verified dari provider.
-- Idempoten (IF NOT EXISTS + backfill guarded IS NULL).

ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_deadline timestamptz;

UPDATE users
   SET verification_deadline = now() + interval '14 days'
 WHERE email_verified = false
   AND password_hash IS NOT NULL
   AND verification_deadline IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_verification_deadline
  ON users (verification_deadline) WHERE verification_deadline IS NOT NULL;
