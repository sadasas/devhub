-- 037_project_contact_links: opt-in owner CTA untuk halaman publik (/p/*)
-- Fail-closed: NULL/'' = tidak tampil. Validasi http(s) di application layer
-- (projectService zod); kolom TEXT agar forward-compatible tanpa CHECK kaku.
-- Hanya diekspos via public route saat visibility='public' dan nilai non-kosong.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contact_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS live_demo_url TEXT;
