import { AsyncLocalStorage } from 'node:async_hooks';

export const mcpUserStorage = new AsyncLocalStorage<{ userId: string }>();

export function runMcpUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return mcpUserStorage.run({ userId }, fn);
}

export function getMcpUserId(): string {
  const store = mcpUserStorage.getStore();
  if (!store) {
    throw new Error('MCP user context not set');
  }
  return store.userId;
}
