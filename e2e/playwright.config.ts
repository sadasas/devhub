import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);
const APP_PORT = 5174;
const API_PORT = 3100;
const TEST_DB = 'postgres://devhub:devhub@localhost:5433/devhub_test';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  workers: CI ? 2 : 4,
  retries: CI ? 2 : 0,
  forbidOnly: CI,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  globalSetup: './global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    storageState: '.auth/owner.json',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  webServer: [
    {
      command: `npm run dev -w server`,
      cwd: '..',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      reuseExistingServer: !CI,
      timeout: 60_000,
      env: {
        ...process.env,
        PORT: String(API_PORT),
        NODE_ENV: 'test',
        DATABASE_URL: TEST_DB,
      },
    },
    {
      command: `npm run dev -w app -- --port ${APP_PORT} --strictPort`,
      cwd: '..',
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: !CI,
      timeout: 60_000,
      env: {
        ...process.env,
        VITE_API_PROXY_TARGET: `http://localhost:${API_PORT}`,
      },
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
