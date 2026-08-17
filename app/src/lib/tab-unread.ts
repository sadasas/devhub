import type { GranularEntity } from './api';
import { entityTab } from './deep-link';

export type UnreadMap = Record<string, string>;

export function tabOfEntity(entity: GranularEntity): string {
  return entityTab(entity);
}

export function unreadStorageKey(projectId: string, userId: string): string {
  return `devhub:unread:${projectId}:${userId}`;
}

export function deletedDismissKey(projectId: string): string {
  return `devhub:deleted-dismiss:${projectId}`;
}

export function readUnreadMap(key: string): UnreadMap {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as UnreadMap;
    return {};
  } catch {
    return {};
  }
}

export function writeUnreadMap(key: string, map: UnreadMap): void {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* storage is best-effort */
  }
}

export function readDismissedUntil(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeDismissedUntil(key: string, iso: string): void {
  try {
    localStorage.setItem(key, iso);
  } catch {
    /* storage is best-effort */
  }
}
