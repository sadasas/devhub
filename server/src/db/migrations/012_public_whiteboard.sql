-- 012_public_whiteboard: tambahkan tab whiteboard ke default tab publik
-- Default kolom diperbarui dan proyek lama yang masih memakai daftar default
-- 5-tab ikut diperbarui agar whiteboard tampil default-on.
ALTER TABLE projects ALTER COLUMN public_tabs SET DEFAULT '["board","issues","stack","milestones","about","whiteboard"]';

UPDATE projects
SET public_tabs = '["board","issues","stack","milestones","about","whiteboard"]'
WHERE public_tabs = '["board","issues","stack","milestones","about"]';