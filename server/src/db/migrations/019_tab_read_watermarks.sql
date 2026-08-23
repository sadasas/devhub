-- 019_tab_read_watermarks: watermark baca per user/project/tab (ADR M32).
-- Mengikuti pola team_message_reads (chat): server sumber kebenaran "sudah dibaca",
-- badge unread dihitung via agregat SQL terhadap activity_log.
CREATE TABLE IF NOT EXISTS tab_read_watermarks (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tab text NOT NULL,
  last_read timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id, tab)
);
