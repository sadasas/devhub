-- Normalize existing user emails to lowercase so invitations (always lowercase)
-- match accounts registered with mixed case. Safe: email uniqueness is
-- case-sensitive, so this only rewrites rows that differ from their lowercase form.
UPDATE users SET email = LOWER(email) WHERE email <> LOWER(email);
