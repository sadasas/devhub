-- 026_backfill_display_name: isi display_name kosong dengan email agar username tidak kosong saat registrasi
-- Existing users yang display_name = '' di-backfill, dan trigger untuk registrasi baru akan set display_name = email (lihat auth.routes.ts)
UPDATE users SET display_name = email WHERE display_name IS NULL OR btrim(display_name) = '';
