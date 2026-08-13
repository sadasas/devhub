import { expect, type Page } from '@playwright/test';
import { ownerContext, getProjectVersion } from './api';

async function currentVersion(projectId: string): Promise<number | null> {
  try {
    return await getProjectVersion(await ownerContext(), projectId);
  } catch {
    return null;
  }
}

export async function waitForSaved(_page: Page, projectId: string): Promise<void> {
  const baseline = await currentVersion(projectId);
  await expect
    .poll(async () => currentVersion(projectId), {
      intervals: [100, 250, 500],
      timeout: 15_000,
    })
    .toBeGreaterThan(baseline ?? 0);
}

export async function expectVersion(
  _page: Page,
  projectId: string,
  minVersion: number,
): Promise<void> {
  await expect
    .poll(async () => currentVersion(projectId), {
      intervals: [100, 250, 500],
      timeout: 15_000,
    })
    .toBeGreaterThanOrEqual(minVersion);
}
