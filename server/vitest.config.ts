import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Vitest me-bundle config ke node_modules/.vite-temp, sehingga
// import.meta.url TIDAK menunjuk ke server/. Cari direktori sumber
// (yang berisi vitest.config.ts) dengan berjalan ke atas.
function findConfigDir(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, 'vitest.config.ts'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir; // fallback: perilaku lama
}

const envDir = findConfigDir(path.dirname(fileURLToPath(import.meta.url)));
loadEnv({ path: path.join(envDir, '.env'), quiet: true });

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is required for tests — refusing to run against dev DB');
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.NODE_ENV = 'test';
if (process.env.JWT_SECRET === 'change-me-to-a-random-string-of-at-least-32-chars') {
  process.env.JWT_SECRET = 'devhub-test-secret-0123456789-abcdefghijklmnop';
}
// Billing Pakasir (M33) — sandbox defaults untuk test; bisa dioverride via env CI.
process.env.PAKASIR_ENABLED = process.env.PAKASIR_ENABLED ?? 'true';
process.env.PAKASIR_SANDBOX = process.env.PAKASIR_SANDBOX ?? 'true';
process.env.PAKASIR_SLUG = process.env.PAKASIR_SLUG ?? 'devhub-test';
process.env.PAKASIR_API_KEY = process.env.PAKASIR_API_KEY ?? 'test-key';
process.env.APP_PUBLIC_URL = process.env.APP_PUBLIC_URL ?? 'https://app.test';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    fileParallelism: false,
  },
});
