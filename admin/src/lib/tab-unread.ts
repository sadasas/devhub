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

export const DISMISS_PREFIX = '__deleted_dismiss__:';
export function dismissKeyForTab(tab: string): string {
  return `${DISMISS_PREFIX}${tab}`;
}
export function isDismissKey(tab: string): boolean {
  return tab === '__deleted_dismiss__' || tab.startsWith(DISMISS_PREFIX);
}

/** Sisa helper lama (localStorage) — hanya dipakai untuk seeding sekali ke server. */
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

export function readDismissedUntil(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function clearLegacyUnread(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* best-effort */
  }
}
