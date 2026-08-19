-- 017_user_stats_index: index untuk GET /me/stats (ADR-039)
-- query stats memfilter activity_log by author_id lalu mengelompokkan per hari;
-- tanpa index ini agregasi per-user memindai seluruh tabel.
CREATE INDEX IF NOT EXISTS idx_activity_log_author_created
  ON activity_log (author_id, created_at DESC);