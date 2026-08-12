-- 006_project_visibility: public read-only sharing
ALTER TABLE projects ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';