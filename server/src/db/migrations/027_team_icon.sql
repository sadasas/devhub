-- 027_team_icon: emoji icon for teams (nullable, max 10 chars grapheme-wise loose)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS icon text;
