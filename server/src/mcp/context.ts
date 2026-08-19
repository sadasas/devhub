import { AsyncLocalStorage } from 'node:async_hooks';

export interface McpUserContext {
  userId: string;
  stateVersion?: number;
}

export const mcpUserStorage = new AsyncLocalStorage<McpUserContext>();

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

export function setLoadedStateVersion(version: number): void {
  const store = mcpUserStorage.getStore();
  if (store) store.stateVersion = version;
}

export function getLoadedStateVersion(): number | undefined {
  return mcpUserStorage.getStore()?.stateVersion;
}
