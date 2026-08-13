-- 009_project_public_tabs: per-tab public sharing control
-- Admin memilih tab mana saja (board/issues/stack/milestones/about) yang
-- ditampilkan di halaman publik /p/:projectId. Array dikosongkan saat
-- visibility private; hanya berlaku saat visibility = 'public'.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS public_tabs jsonb NOT NULL DEFAULT '["board","issues","stack","milestones","about"]';
