import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return randomUUID();
}

export function findEntity<T extends { id: string }>(
  items: readonly T[],
  id: string,
  label: string,
): T {
  const item = items.find((i) => i.id === id);
  if (!item) {
    throw new McpError(ErrorCode.InvalidParams, `${label} not found: ${id}`);
  }
  return item;
}

export function findIndexIn<T extends { id: string }>(
  items: readonly T[],
  id: string,
  label: string,
): number {
  const index = items.findIndex((i) => i.id === id);
  if (index === -1) {
    throw new McpError(ErrorCode.InvalidParams, `${label} not found: ${id}`);
  }
  return index;
}

export function applyDefined<T extends object>(target: T, patch: Partial<T>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      (target as Record<string, unknown>)[key] = value;
    }
  }
}

export function textContent(value: unknown): { type: 'text'; text: string } {
  return { type: 'text', text: JSON.stringify(value, null, 2) };
}

export function toolError(
  message: string,
): { isError: true; content: { type: 'text'; text: string }[] } {
  return { isError: true, content: [textContent(message)] };
}