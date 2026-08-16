import type { PendingMutation } from './storage-provider';
import type { State } from './types';

/**
 * Minimal zero-dependency IndexedDB wrapper backing the offline cache and the
 * persisted pending-mutation queue (M11 sync & offline).
 *
 * Object stores:
 * - `projects` — one snapshot per project: `{ projectId, state, version, savedAt }`
 * - `queue`    — pending mutations keyed `{projectId}:{entity}:{id}` (coalesced
 *   last-write-wins per entity+id, matching the in-memory queue semantics)
 * - `meta`     — small key/value rows for the offline shell bootstrap (cached
 *   user, projects list, teams list)
 */
export const STORE_PROJECTS = 'projects';
export const STORE_QUEUE = 'queue';
export const STORE_META = 'meta';

const DB_NAME = 'devhub';
const DB_VERSION = 2;

export interface CachedProject {
  projectId: string;
  state: State;
  version: number;
  savedAt: number;
}

export interface QueuedMutationRecord {
  id: string;
  projectId: string;
  mutation: PendingMutation;
  queuedAt: number;
}

interface MetaRecord {
  key: string;
  value: unknown;
  savedAt: number;
}

function queueId(projectId: string, mutationKey: string): string {
  return `${projectId}:${mutationKey}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDevHubDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'projectId' });
        }
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          const store = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
          store.createIndex('projectId', 'projectId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
    });
  }
  return dbPromise;
}

/** Close, delete and forget the database (tests and app teardown). */
export async function resetDevHubDb(): Promise<void> {
  const db = await dbPromise?.catch(() => null);
  if (db) db.close();
  dbPromise = null;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function waitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function waitReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export async function getCachedProject(projectId: string): Promise<CachedProject | undefined> {
  const db = await openDevHubDb();
  const req = db
    .transaction(STORE_PROJECTS, 'readonly')
    .objectStore(STORE_PROJECTS)
    .get(projectId);
  return waitReq(req);
}

export async function putCachedProject(projectId: string, state: State, version: number): Promise<void> {
  const db = await openDevHubDb();
  const tx = db.transaction(STORE_PROJECTS, 'readwrite');
  tx.objectStore(STORE_PROJECTS).put({ projectId, state, version, savedAt: Date.now() } satisfies CachedProject);
  await waitTx(tx);
}

export async function getQueuedMutations(projectId: string): Promise<QueuedMutationRecord[]> {
  const db = await openDevHubDb();
  const req = db
    .transaction(STORE_QUEUE, 'readonly')
    .objectStore(STORE_QUEUE)
    .index('projectId')
    .getAll(projectId);
  return waitReq(req);
}

export async function putQueuedMutation(projectId: string, mutation: PendingMutation): Promise<void> {
  const db = await openDevHubDb();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  tx.objectStore(STORE_QUEUE).put({
    id: queueId(projectId, mutation.key),
    projectId,
    mutation,
    queuedAt: Date.now(),
  } satisfies QueuedMutationRecord);
  await waitTx(tx);
}

export async function deleteQueuedMutation(projectId: string, mutationKey: string): Promise<void> {
  const db = await openDevHubDb();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  tx.objectStore(STORE_QUEUE).delete(queueId(projectId, mutationKey));
  await waitTx(tx);
}

export async function clearQueuedMutations(projectId: string): Promise<void> {
  const db = await openDevHubDb();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  const store = tx.objectStore(STORE_QUEUE);
  const keys = await waitReq(store.index('projectId').getAllKeys(projectId));
  for (const key of keys) store.delete(key);
  await waitTx(tx);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await openDevHubDb();
  const req = db
    .transaction(STORE_META, 'readonly')
    .objectStore(STORE_META)
    .get(key);
  const record = await waitReq<MetaRecord | undefined>(req);
  return record?.value as T | undefined;
}

export async function putMeta(key: string, value: unknown): Promise<void> {
  const db = await openDevHubDb();
  const tx = db.transaction(STORE_META, 'readwrite');
  tx.objectStore(STORE_META).put({ key, value, savedAt: Date.now() } satisfies MetaRecord);
  await waitTx(tx);
}