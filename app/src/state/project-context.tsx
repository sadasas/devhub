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
import { ApiError, api } from '../lib/api';
import { nowIso } from '../lib/utils';
import type {
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
  | { type: 'milestone/remove'; id: string };

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
  switch (action.type) {
    case 'replace':
      return action.state;

    case 'task/add':
      return { ...state, tasks: [action.task, ...state.tasks] };
    case 'task/update':
      return { ...state, tasks: updateIn<Task>(state.tasks, action.id, action.patch) };
    case 'task/remove':
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        issues: state.issues.map((i) =>
          i.linkedTaskId === action.id ? { ...i, linkedTaskId: null, updatedAt: nowIso() } : i,
        ),
      };

    case 'issue/add':
      return { ...state, issues: [action.issue, ...state.issues] };
    case 'issue/update':
      return { ...state, issues: updateIn<Issue>(state.issues, action.id, action.patch) };
    case 'issue/remove':
      return { ...state, issues: state.issues.filter((i) => i.id !== action.id) };

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
      return { ...state, milestones: state.milestones.filter((m) => m.id !== action.id) };

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Provider — load, optimistic edits, debounced save, polling          */
/* ------------------------------------------------------------------ */

const SAVE_DEBOUNCE_MS = 800;
const POLL_INTERVAL_MS = 5000;

interface ProjectContextValue {
  state: State | null;
  loading: boolean;
  error: string | null;
  saveError: string | null;
  dispatch: (action: ProjectAction) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const stateRef = useRef<State | null>(null);
  const lastSavedRef = useRef<State | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSave();
    }, SAVE_DEBOUNCE_MS);
  }, []);

  async function runSave() {
    const snapshot = stateRef.current;
    if (!snapshot || savingRef.current) return;
    dirtyRef.current = false;
    savingRef.current = true;
    try {
      await api.putState(projectId, snapshot);
      lastSavedRef.current = snapshot;
      setSaveError(null);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save changes');
      if (lastSavedRef.current) setState(lastSavedRef.current);
      dirtyRef.current = false;
    } finally {
      savingRef.current = false;
    }
  }

  const dispatch = useCallback(
    (action: ProjectAction) => {
      setState((prev) => (prev ? projectReducer(prev, action) : prev));
      scheduleSave();
    },
    [scheduleSave],
  );

  useEffect(() => {
    let cancelled = false;
    setState(null);
    lastSavedRef.current = null;
    dirtyRef.current = false;
    setLoading(true);
    setError(null);
    setSaveError(null);

    api
      .getState(projectId)
      .then((s) => {
        if (cancelled) return;
        stateRef.current = s;
        lastSavedRef.current = s;
        setState(s);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load project state');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (dirtyRef.current || savingRef.current) return;
      api
        .getState(projectId)
        .then((fresh) => {
          if (cancelled) return;
          const cur = stateRef.current;
          if (cur && JSON.stringify(fresh) !== JSON.stringify(cur)) {
            stateRef.current = fresh;
            lastSavedRef.current = fresh;
            setState(fresh);
          }
        })
        .catch(() => {
          /* polling is best-effort */
        });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [projectId]);

  const value = useMemo(
    () => ({ state, loading, error, saveError, dispatch }),
    [state, loading, error, saveError, dispatch],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
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
