import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { ApiError, type GranularEntity } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import {
  apiProvider,
  isQueuedStorageProvider,
  type PendingMutation,
  type StorageProvider,
} from '../lib/storage-provider';
import { reconcileQueue } from '../lib/sync-service';
import { RealtimeSocket, applyStateDiff, realtimeWsUrl } from '../lib/realtime-client';
import type { ActivityNew, PresenceUpdate, PresenceUser, RealtimeHandlers, StateDiff } from '../lib/realtime-client';
import { deriveActualHours, nowIso } from '../lib/utils';
import type {
  ApiCollection,
  ApiEndpoint,
  Decision,
  Issue,
  Milestone,
  Relation,
  SchemaVersion,
  State,
  Table,
  Task,
  TechEntry,
  TestCase,
  TeamRole,
  Whiteboard,
} from '../lib/types';

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export type UpdatePatch<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'authorId'>>;

export type ProjectAction =
  | { type: 'replace'; state: State }
  | { type: 'task/add'; task: Task }
  | { type: 'task/update'; id: string; patch: UpdatePatch<Task> }
  | { type: 'task/remove'; id: string }
  | { type: 'issue/add'; issue: Issue }
  | { type: 'issue/update'; id: string; patch: UpdatePatch<Issue> }
  | { type: 'issue/remove'; id: string }
  | { type: 'testCase/add'; testCase: TestCase }
  | { type: 'testCase/update'; id: string; patch: UpdatePatch<TestCase> }
  | { type: 'testCase/remove'; id: string }
  | { type: 'tech/add'; entry: TechEntry }
  | { type: 'tech/update'; id: string; patch: UpdatePatch<TechEntry> }
  | { type: 'tech/remove'; id: string }
  | { type: 'table/add'; table: Table }
  | { type: 'table/update'; id: string; patch: UpdatePatch<Table> }
  | { type: 'table/remove'; id: string }
  | { type: 'relation/add'; relation: Relation }
  | { type: 'relation/remove'; id: string }
  | { type: 'schemaVersion/add'; version: SchemaVersion }
  | { type: 'decision/add'; decision: Decision }
  | { type: 'decision/update'; id: string; patch: UpdatePatch<Decision> }
  | { type: 'decision/remove'; id: string }
  | { type: 'milestone/add'; milestone: Milestone }
  | { type: 'milestone/update'; id: string; patch: UpdatePatch<Milestone> }
  | { type: 'milestone/remove'; id: string }
  | { type: 'apiCollection/add'; collection: ApiCollection }
  | { type: 'apiCollection/update'; id: string; patch: UpdatePatch<ApiCollection> }
  | { type: 'apiCollection/remove'; id: string }
  | { type: 'apiEndpoint/add'; endpoint: ApiEndpoint }
  | { type: 'apiEndpoint/update'; id: string; patch: UpdatePatch<ApiEndpoint> }
  | { type: 'apiEndpoint/remove'; id: string }
  | { type: 'whiteboard/add'; whiteboard: Whiteboard }
  | { type: 'whiteboard/update'; id: string; patch: UpdatePatch<Whiteboard> }
  | { type: 'whiteboard/remove'; id: string }
  | { type: 'timeline/reorder'; laneKey: string; ids: string[] };

/* ------------------------------------------------------------------ */
/* Reducer — sole mutator of project state                             */
/* ------------------------------------------------------------------ */

function updateIn<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  const touched = nowIso();
  return list.map((item) =>
    item.id === id ? { ...item, ...patch, updatedAt: touched } : item,
  );
}

export function projectReducer(state: State, action: ProjectAction): State {
  // ensure timelineOrder exists for old projects
  if (!(state as any).timelineOrder) (state as any).timelineOrder = {};
  switch (action.type) {
    case 'replace':
      return action.state;

    case 'task/add': {
      const completedAt =
        action.task.completedAt ?? (action.task.status === 'done' ? nowIso() : null);
      const actualHours =
        action.task.actualHours ??
        (completedAt
          ? deriveActualHours({
              completedAt,
              createdAt: action.task.createdAt,
              startDate: action.task.startDate,
            })
          : undefined);
      return {
        ...state,
        tasks: [
          {
            ...action.task,
            completedAt,
            actualHours,
          },
          ...state.tasks,
        ],
      };
    }
    case 'task/update': {
      const prev = state.tasks.find((t) => t.id === action.id);
      let patch = action.patch;
      if (prev && patch.status !== undefined && patch.completedAt === undefined) {
        if (patch.status === 'done' && prev.status !== 'done') {
          patch = { ...patch, completedAt: nowIso() };
        } else if (patch.status !== 'done') {
          patch = { ...patch, completedAt: null };
        }
      }
      if (
        prev &&
        patch.status === 'done' &&
        prev.status !== 'done' &&
        patch.actualHours === undefined
      ) {
        patch = {
          ...patch,
          actualHours: deriveActualHours({
            completedAt: patch.completedAt ?? nowIso(),
            createdAt: prev.createdAt,
            startDate: patch.startDate ?? prev.startDate,
          }),
        };
      }
      return { ...state, tasks: updateIn<Task>(state.tasks, action.id, patch) };
    }
    case 'task/remove':
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        issues: state.issues.map((i) =>
          i.linkedTaskId === action.id ? { ...i, linkedTaskId: null, updatedAt: nowIso() } : i,
        ),
        whiteboards: state.whiteboards.map((w) => ({
          ...w,
          elements: w.elements.filter((el) => !(el.kind === 'ref' && el.entity === 'tasks' && el.entityId === action.id)),
        })),
      };

    case 'issue/add':
      return { ...state, issues: [action.issue, ...state.issues] };
    case 'issue/update':
      return { ...state, issues: updateIn<Issue>(state.issues, action.id, action.patch) };
    case 'issue/remove':
      return {
        ...state,
        issues: state.issues.filter((i) => i.id !== action.id),
        whiteboards: state.whiteboards.map((w) => ({
          ...w,
          elements: w.elements.filter((el) => !(el.kind === 'ref' && el.entity === 'issues' && el.entityId === action.id)),
        })),
      };

    case 'testCase/add':
      return { ...state, testCases: [action.testCase, ...state.testCases] };
    case 'testCase/update':
      return { ...state, testCases: updateIn<TestCase>(state.testCases, action.id, action.patch) };
    case 'testCase/remove':
      return { ...state, testCases: state.testCases.filter((t) => t.id !== action.id) };

    case 'tech/add':
      return { ...state, techEntries: [action.entry, ...state.techEntries] };
    case 'tech/update':
      return { ...state, techEntries: updateIn<TechEntry>(state.techEntries, action.id, action.patch) };
    case 'tech/remove':
      return { ...state, techEntries: state.techEntries.filter((t) => t.id !== action.id) };

    case 'table/add':
      return { ...state, tables: [action.table, ...state.tables] };
    case 'table/update':
      return { ...state, tables: updateIn<Table>(state.tables, action.id, action.patch) };
    case 'table/remove':
      return {
        ...state,
        tables: state.tables.filter((t) => t.id !== action.id),
        relations: state.relations.filter((r) => r.fromTableId !== action.id && r.toTableId !== action.id),
      };

    case 'relation/add':
      return { ...state, relations: [action.relation, ...state.relations] };
    case 'relation/remove':
      return { ...state, relations: state.relations.filter((r) => r.id !== action.id) };

    case 'schemaVersion/add':
      return { ...state, schemaVersions: [action.version, ...state.schemaVersions] };

    case 'decision/add':
      return { ...state, decisions: [action.decision, ...state.decisions] };
    case 'decision/update':
      return { ...state, decisions: updateIn<Decision>(state.decisions, action.id, action.patch) };
    case 'decision/remove':
      return { ...state, decisions: state.decisions.filter((d) => d.id !== action.id) };

    case 'milestone/add':
      return { ...state, milestones: [action.milestone, ...state.milestones] };
    case 'milestone/update':
      return { ...state, milestones: updateIn<Milestone>(state.milestones, action.id, action.patch) };
    case 'milestone/remove':
      return {
        ...state,
        milestones: state.milestones.filter((m) => m.id !== action.id),
        tasks: state.tasks.map((t) =>
          t.milestoneId === action.id ? { ...t, milestoneId: null, updatedAt: nowIso() } : t,
        ),
        decisions: state.decisions.map((d) =>
          d.milestoneId === action.id ? { ...d, milestoneId: null, updatedAt: nowIso() } : d,
        ),
        schemaVersions: state.schemaVersions.map((v) =>
          v.milestoneId === action.id ? { ...v, milestoneId: null, updatedAt: nowIso() } : v,
        ),
      };

    case 'apiCollection/add':
      return { ...state, apiCollections: [action.collection, ...state.apiCollections] };
    case 'apiCollection/update':
      return {
        ...state,
        apiCollections: updateIn<ApiCollection>(state.apiCollections, action.id, action.patch),
      };
    case 'apiCollection/remove':
      return {
        ...state,
        apiCollections: state.apiCollections.filter((c) => c.id !== action.id),
        apiEndpoints: state.apiEndpoints.map((e) =>
          e.collectionId === action.id
            ? { ...e, collectionId: null, updatedAt: nowIso() }
            : e,
        ),
      };

    case 'apiEndpoint/add':
      return { ...state, apiEndpoints: [action.endpoint, ...state.apiEndpoints] };
    case 'apiEndpoint/update':
      return {
        ...state,
        apiEndpoints: updateIn<ApiEndpoint>(state.apiEndpoints, action.id, action.patch),
      };
    case 'apiEndpoint/remove':
      return {
        ...state,
        apiEndpoints: state.apiEndpoints.filter((e) => e.id !== action.id),
      };

    case 'whiteboard/add':
      return { ...state, whiteboards: [action.whiteboard, ...state.whiteboards] };
    case 'whiteboard/update':
      return {
        ...state,
        whiteboards: updateIn<Whiteboard>(state.whiteboards, action.id, action.patch),
      };
    case 'whiteboard/remove':
      return {
        ...state,
        whiteboards: state.whiteboards.filter((w) => w.id !== action.id),
      };

    case 'timeline/reorder':
      return {
        ...state,
        timelineOrder: { ...(state as any).timelineOrder, [action.laneKey]: action.ids },
      };

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Action → granular mutation mapping                                  */
/* ------------------------------------------------------------------ */

const ENTITY_FOR_ACTION: Record<string, GranularEntity> = {
  task: 'tasks',
  issue: 'issues',
  testCase: 'testCases',
  tech: 'techEntries',
  table: 'tables',
  relation: 'relations',
  schemaVersion: 'schemaVersions',
  decision: 'decisions',
  milestone: 'milestones',
  apiCollection: 'apiCollections',
  apiEndpoint: 'apiEndpoints',
  whiteboard: 'whiteboards',
};

const PAYLOAD_KEY: Record<string, string> = {
  task: 'task',
  issue: 'issue',
  testCase: 'testCase',
  tech: 'entry',
  table: 'table',
  relation: 'relation',
  schemaVersion: 'version',
  decision: 'decision',
  milestone: 'milestone',
  apiCollection: 'collection',
  apiEndpoint: 'endpoint',
  whiteboard: 'whiteboard',
};

function actionToMutation(action: ProjectAction): PendingMutation | null {
  const [head, verb] = action.type.split('/') as [string, string];
  const entity = ENTITY_FOR_ACTION[head];
  if (!entity || !verb || verb === 'replace') return null;
  const a = action as { id?: string; patch?: Record<string, unknown> } & Record<string, unknown>;
  if (verb === 'add') {
    const payload = a[PAYLOAD_KEY[head] ?? ''] as Record<string, unknown> | undefined;
    const id = payload?.id as string | undefined;
    if (!id) return null;
    return { key: `${entity}:${id}`, entity, op: 'create', id, payload };
  }
  if (verb === 'update') {
    if (!a.id) return null;
    return { key: `${entity}:${a.id}`, entity, op: 'update', id: a.id, payload: a.patch ?? {} };
  }
  if (verb === 'remove') {
    if (!a.id) return null;
    return { key: `${entity}:${a.id}`, entity, op: 'delete', id: a.id };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Provider — load, optimistic edits, granular mutation flush, polling */
/* ------------------------------------------------------------------ */

const SAVE_DEBOUNCE_MS = 800;
const POLL_INTERVAL_MS = 5000;

export interface ProjectConflict {
  message: string;
  current: { version: number };
  /** State lokal pengguna saat konflik (bukan state server) — audit 2026-08b, CLIENT-2 */
  localState: State;
}

interface ProviderError {
  message: string;
  status?: number;
  details?: unknown;
}

function asProviderError(err: unknown): ProviderError {
  if (err instanceof ApiError) return err;
  if (err && typeof err === 'object') {
    const candidate = err as { message?: unknown; status?: unknown; details?: unknown };
    return {
      message: typeof candidate.message === 'string' ? candidate.message : 'Failed to save changes',
      status: typeof candidate.status === 'number' ? candidate.status : undefined,
      details: candidate.details,
    };
  }
  return { message: 'Failed to save changes' };
}

interface ProjectContextValue {
  projectId: string;
  teamId: string;
  state: State | null;
  loading: boolean;
  error: string | null;
  saveError: string | null;
  saving: boolean;
  lastSavedAt: number | null;
  role: TeamRole;
  canEdit: boolean;
  conflict: ProjectConflict | null;
  isOffline: boolean;
  pendingCount: number;
  presence: PresenceUser[];
  subscribeActivity: (cb: (msg: ActivityNew) => void) => () => void;
  setStatus: (text: string | null) => void;
  dispatch: (action: ProjectAction) => void;
  retrySave: () => void;
  resolveConflict: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  projectId,
  role,
  teamId = '',
  isArchived = false,
  provider = apiProvider,
  createRealtime,
  children,
}: {
  projectId: string;
  role: TeamRole;
  teamId?: string;
  isArchived?: boolean;
  provider?: StorageProvider;
  createRealtime?: (handlers: RealtimeHandlers) => RealtimeSocket;
  children: ReactNode;
}) {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [conflict, setConflict] = useState<ProjectConflict | null>(null);
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const activitySubscribersRef = useRef(new Set<(msg: ActivityNew) => void>());
  const stateRef = useRef<State | null>(null);
  const lastSavedRef = useRef<State | null>(null);
  const socketRef = useRef<RealtimeSocket | null>(null);
  const versionRef = useRef(0);
  const dirtyRef = useRef(false);
  const mutationsRef = useRef<Map<string, PendingMutation>>(new Map());
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFlushRef = useRef<Promise<void> | null>(null);
  const canEditRef = useRef(role !== 'viewer' && !isArchived);
  canEditRef.current = role !== 'viewer' && !isArchived;
  const wsConnectedRef = useRef(false);

  const emitPendingCount = useCallback(() => {
    setPendingCount(mutationsRef.current.size);
  }, []);

  const flushMutations = useCallback(
    async (opts?: { keepalive?: boolean }): Promise<void> => {
      if (!canEditRef.current) return;
      if (pendingFlushRef.current) return pendingFlushRef.current;
      const p = (async () => {
        savingRef.current = true;
        setSaving(true);
        const queue = mutationsRef.current;
        let current: PendingMutation | undefined;
        let drainFailed = false;
        let reconcileAttempts = 0;
        try {
          while (queue.size > 0) {
            const entry = [...queue.entries()][0]!;
            queue.delete(entry[0]);
            current = entry[1];
                        let opError: unknown = null;
            try {
              if (current.op === 'create') {
                const res = await provider.createEntity(projectId, current.entity, current.payload!);
                versionRef.current = res.version;
              } else if (current.op === 'update') {
                const res = await provider.updateEntity(
                  projectId,
                  current.entity,
                  current.id,
                  current.payload!,
                  versionRef.current,
                  opts?.keepalive,
                );
                versionRef.current = res.version;
              } else {
                const res = await provider.deleteEntity(
                  projectId,
                  current.entity,
                  current.id,
                  versionRef.current,
                  opts?.keepalive,
                );
                versionRef.current = res.version;
              }
              if (isQueuedStorageProvider(provider)) {
                void provider.removePendingMutation(projectId, current.key).catch(() => {});
              }
              current = undefined;
              setIsOffline(false);
            } catch (err) {
              opError = err;
            }
            if (opError) {
              drainFailed = true;
              const e = asProviderError(opError);
              setSaveError(e.message);
              if (e.status === 0) setIsOffline(true);
              if (e.status === 409) {
                const pending = current ? [...queue.values(), current] : [...queue.values()];
                let fresh: { state: State; version: number } | null = null;
                try {
                  fresh = await provider.loadState(projectId);
                } catch {
                  fresh = null;
                }
                if (fresh) {
                  const { keep, dropped } = reconcileQueue(pending, fresh.state, stateRef.current);
                  queue.clear();
                  for (const key of dropped) {
                    if (isQueuedStorageProvider(provider)) {
                      void provider.removePendingMutation(projectId, key).catch(() => {});
                    }
                  }
                  if (keep.length > 0 && reconcileAttempts < 3) {
                    for (const m of keep) queue.set(m.key, m);
                    versionRef.current = fresh.version;
                    reconcileAttempts += 1;
                    drainFailed = false;
                    continue;
                  }
                } else {
                  queue.clear();
                }
                if (isQueuedStorageProvider(provider)) {
                  void provider.clearPendingMutations(projectId).catch(() => {});
                }
                const details = (e.details as { current?: { version?: number } } | undefined)?.current;
                if (details?.version && stateRef.current) {
                  setConflict({
                    message: e.message,
                    current: { version: details.version },
                    localState: stateRef.current,
                  });
                }
              } else if (current) {
                queue.set(current.key, current);
              }
              dirtyRef.current = true;
              break;
            }
          }
        } finally {
          if (!drainFailed) {
            lastSavedRef.current = stateRef.current;
            setSaveError(null);
            setLastSavedAt(Date.now());
          }
          savingRef.current = false;
          setSaving(false);
          emitPendingCount();
        }
      })();
      pendingFlushRef.current = p;
      void p.finally(() => {
        if (pendingFlushRef.current === p) pendingFlushRef.current = null;
      });
      return p;
    },
    [projectId, provider, emitPendingCount],
  );

  const scheduleSave = useCallback(() => {
    if (!stateRef.current) return;
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flushMutations();
    }, SAVE_DEBOUNCE_MS);
  }, [flushMutations]);

  const retrySave = useCallback(() => {
    if (savingRef.current) return;
    void flushMutations();
  }, [flushMutations]);

  const resolveConflict = useCallback(async () => {
    setConflict(null);
    mutationsRef.current.clear();
    emitPendingCount();
    if (isQueuedStorageProvider(provider)) {
      void provider.clearPendingMutations(projectId).catch(() => {});
    }
    dirtyRef.current = false;
    setSaveError(null);
    try {
      const fresh = await provider.loadState(projectId);
      stateRef.current = fresh.state;
      lastSavedRef.current = fresh.state;
      versionRef.current = fresh.version;
      setState(fresh.state);
      setIsOffline(false);
    } catch {
      /* keep the local state; polling will retry */
    }
  }, [projectId, provider, emitPendingCount]);

  const dispatch = useCallback(
    (action: ProjectAction) => {
      if (!canEditRef.current) return;
      setState((prev) => {
        if (!prev) return prev;
        const next = projectReducer(prev, action);
        stateRef.current = next;
        return next;
      });
      const mutation = actionToMutation(action);
      if (mutation) {
        const pending = mutationsRef.current.get(mutation.key);
        const merged =
          pending?.op === 'create' && mutation.op === 'update'
            ? { ...pending, payload: { ...pending.payload, ...mutation.payload } }
            : mutation;
        mutationsRef.current.set(mutation.key, merged);
        emitPendingCount();
        if (isQueuedStorageProvider(provider)) {
          void provider.enqueuePendingMutation(projectId, merged).catch(() => {});
        }
      }
      scheduleSave();
    },
    [projectId, provider, scheduleSave, emitPendingCount],
  );

  useEffect(() => {
    let cancelled = false;
    wsConnectedRef.current = false;
    setState(null);
    setPresence([]);
    lastSavedRef.current = null;
    versionRef.current = 0;
    dirtyRef.current = false;
    mutationsRef.current.clear();
    emitPendingCount();
    setConflict(null);
    setLoading(true);
    setError(null);
    setSaveError(null);

    void (async () => {
      await flushMutations();
      if (cancelled) return;
      try {
        const loaded = await provider.loadState(projectId);
        if (cancelled) return;
        stateRef.current = loaded.state;
        lastSavedRef.current = loaded.state;
        versionRef.current = loaded.version;
        setState(loaded.state);
        setIsOffline(false);
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Failed to load project state'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (cancelled || !isQueuedStorageProvider(provider)) return;
      const pending = await provider.listPendingMutations(projectId).catch(() => []);
      if (cancelled) return;
      for (const m of pending) mutationsRef.current.set(m.key, m);
      emitPendingCount();
      if (pending.length === 0) return;
      await flushMutations();
      if (cancelled) return;
      try {
        const synced = await provider.loadState(projectId);
        if (cancelled) return;
        stateRef.current = synced.state;
        lastSavedRef.current = synced.state;
        versionRef.current = synced.version;
        setState(synced.state);
      } catch {
        /* the replay failed loudly or the conflict banner took over; polling will retry */
      }
    })();

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (wsConnectedRef.current) return;
      if (dirtyRef.current || savingRef.current || mutationsRef.current.size > 0) return;
      provider
        .loadState(projectId)
        .then((fresh) => {
          if (cancelled) return;
          if (dirtyRef.current || savingRef.current || mutationsRef.current.size > 0) return;
          const cur = stateRef.current;
          if (cur && JSON.stringify(fresh.state) !== JSON.stringify(cur)) {
            stateRef.current = fresh.state;
            lastSavedRef.current = fresh.state;
            versionRef.current = fresh.version;
            setState(fresh.state);
          }
        })
        .catch(() => {
          /* polling is best-effort */
        });
    }, POLL_INTERVAL_MS);

    const onPageHide = () => {
      void flushMutations({ keepalive: true });
    };
    window.addEventListener('pagehide', onPageHide);

    const onOnline = () => {
      setIsOffline(false);
      if (dirtyRef.current || mutationsRef.current.size > 0) void flushMutations();
    };
    window.addEventListener('online', onOnline);

    const onOffline = () => {
      setIsOffline(true);
    };
    window.addEventListener('offline', onOffline);

    const resyncFromServer = async () => {
      try {
        const fresh = await provider.loadState(projectId);
        if (cancelled) return;
        stateRef.current = fresh.state;
        lastSavedRef.current = fresh.state;
        versionRef.current = fresh.version;
        setState(fresh.state);
      } catch {
        /* keep the local state; polling will retry */
      }
    };

        const handleDiff = (diff: StateDiff) => {
      if (cancelled || diff.version <= versionRef.current || !stateRef.current) return;
      const ownKeys = new Set(mutationsRef.current.keys());
      const next = applyStateDiff(stateRef.current, diff, ownKeys);
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      if (mutationsRef.current.size === 0) versionRef.current = diff.version;
    };

    const onPresence = (presenceUpdate: PresenceUpdate) => {
      if (cancelled || presenceUpdate.projectId !== projectId) return;
      setPresence(presenceUpdate.users);
    };

    const onActivity = (msg: ActivityNew) => {
      if (cancelled || msg.projectId !== projectId) return;
      for (const cb of activitySubscribersRef.current) cb(msg);
    };

    const socket = createRealtime
      ? createRealtime({
          onOpen: () => {
            wsConnectedRef.current = true;
          },
          onClose: () => {
            wsConnectedRef.current = false;
          },
          onJoined: () => {
            void resyncFromServer();
          },
          onSync: () => {
            void resyncFromServer();
          },
          onDiff: handleDiff,
          onPresence,
          onActivity,
        })
      : new RealtimeSocket({
          wsUrl: realtimeWsUrl(),
          projectId,
          onOpen: () => {
            wsConnectedRef.current = true;
          },
          onClose: () => {
            wsConnectedRef.current = false;
          },
          onJoined: () => {
            void resyncFromServer();
          },
          onSync: () => {
            void resyncFromServer();
          },
          onDiff: handleDiff,
          onPresence,
          onActivity,
        });
    socketRef.current = socket;

    return () => {
      cancelled = true;
      socketRef.current = null;
      socket.close();
      clearInterval(interval);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (timerRef.current) clearTimeout(timerRef.current);
      void flushMutations();
    };
  }, [projectId, flushMutations, provider, emitPendingCount, createRealtime]);

  const subscribeActivity = useCallback(
    (cb: (msg: ActivityNew) => void) => {
      activitySubscribersRef.current.add(cb);
      return () => {
        activitySubscribersRef.current.delete(cb);
      };
    },
    [],
  );

  const setStatus = useCallback((text: string | null) => {
    socketRef.current?.sendStatus(text);
  }, []);

  const value = useMemo(
    () => ({
      projectId,
      teamId,
      state,
      loading,
      error,
      saveError,
      saving,
      lastSavedAt,
      role,
      canEdit: role !== 'viewer' && !isArchived,
      conflict,
      isOffline,
      pendingCount,
      presence,
      subscribeActivity,
      setStatus,
      dispatch,
      retrySave,
      resolveConflict,
    }),
    [projectId, teamId, state, loading, error, saveError, saving, lastSavedAt, role, isArchived, conflict, isOffline, pendingCount, presence, subscribeActivity, setStatus, dispatch, retrySave, resolveConflict],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}

export function useProjectOptional(fallback: ProjectContextValue | null): ProjectContextValue | null {
  return useContext(ProjectContext) ?? fallback;
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export function wouldCreateCycle(tasks: Task[], taskId: string, blockedBy: string[]): boolean {
  const queue = [...blockedBy];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === taskId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const t = tasks.find((x) => x.id === cur);
    if (t) queue.push(...t.blockedBy);
  }
  return false;
}
