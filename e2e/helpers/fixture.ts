import { test as base, type BrowserContext } from '@playwright/test';
import { uniqueIp } from './api';

export async function withApiRoutes(context: BrowserContext): Promise<BrowserContext> {
  await context.route('**/api/v1/**', async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), 'X-Forwarded-For': uniqueIp() },
    });
  });
  return context;
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await withApiRoutes(context);
    await use(context);
  },
});

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';
