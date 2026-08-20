import { cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// tsc tidak menyalin file .sql — salin migrasi ke dist agar migrate() di
// server/dist/db/migrations.ts tetap menemukannya di production (Suga/Docker).
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
cpSync(join(root, 'src/db/migrations'), join(root, 'dist/db/migrations'), { recursive: true });