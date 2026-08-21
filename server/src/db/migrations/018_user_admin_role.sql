-- 018_user_admin_role: role global untuk dashboard admin platform (ADR M31)
-- 'user' default; 'admin' diberikan manual via SQL oleh operator:
--   UPDATE users SET role = 'admin' WHERE email = '<operator-email>';
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_role CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role_admin ON users (role) WHERE role = 'admin';
