import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

const envDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(envDir, '.env'), quiet: true });

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? '';
process.env.NODE_ENV = 'test';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    fileParallelism: false,
  },
});
