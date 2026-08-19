import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { State, WhiteboardRefEntity } from '../../lib/types';
import {
  DECISION_STATUS,
  ISSUE_SEVERITY,
  ISSUE_STATUS,
  MILESTONE_STATUS,
  TASK_STATUS,
  TECH_STATUS,
  TEST_CASE_STATUS,
} from '../../lib/labels';
import { Modal } from '../../components/Modal';

interface RefPickerProps {
  open: boolean;
  state: State | null;
  onPick: (entity: WhiteboardRefEntity, entityId: string) => void;
  onClose: () => void;
}

interface RefOption {
  entity: WhiteboardRefEntity;
  id: string;
  title: string;
  status: string;
  badge: string;
}

const MAX_OPTIONS = 50;

function labelOf<K extends string>(map: Record<K, { label: string }>, key: K | undefined | null): string {
  return (key ? map[key]?.label : undefined) ?? String(key ?? '');
}

export function RefPicker({ open, state, onPick, onClose }: RefPickerProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const options = useMemo<RefOption[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (...fields: string[]) => !q || fields.some((f) => f.toLowerCase().includes(q));
    const tasks = state?.tasks ?? [];
    const issues = state?.issues ?? [];
    const testCases = state?.testCases ?? [];
    const milestones = state?.milestones ?? [];
    const techEntries = state?.techEntries ?? [];
    const decisions = state?.decisions ?? [];
    const tables = state?.tables ?? [];
    const apiCollections = state?.apiCollections ?? [];
    const apiEndpoints = state?.apiEndpoints ?? [];
    const out: RefOption[] = [];
    const push = (opt: RefOption | null) => {
      if (opt && out.length < MAX_OPTIONS) out.push(opt);
    };
    for (const t of tasks) {
      if (!match(t.title)) continue;
      push({ entity: 'tasks', id: t.id, title: t.title, status: labelOf(TASK_STATUS, t.status), badge: 'Task' });
    }
    for (const i of issues) {
      if (!match(i.title)) continue;
      push({ entity: 'issues', id: i.id, title: i.title, status: `${labelOf(ISSUE_SEVERITY, i.severity)} · ${labelOf(ISSUE_STATUS, i.status)}`, badge: 'Issue' });
    }
    for (const tc of testCases) {
      if (!match(tc.name)) continue;
      push({ entity: 'testCases', id: tc.id, title: tc.name, status: labelOf(TEST_CASE_STATUS, tc.status), badge: 'Test Case' });
    }
    for (const m of milestones) {
      if (!match(m.name)) continue;
      push({ entity: 'milestones', id: m.id, title: m.name, status: labelOf(MILESTONE_STATUS, m.status), badge: 'Milestone' });
    }
    for (const t of techEntries) {
      if (!match(t.name)) continue;
      push({ entity: 'techEntries', id: t.id, title: t.name, status: `${labelOf(TECH_STATUS, t.status)} · ${t.version || '—'}`, badge: 'Tech' });
    }
    for (const d of decisions) {
      if (!match(d.title)) continue;
      push({ entity: 'decisions', id: d.id, title: d.title, status: labelOf(DECISION_STATUS, d.status), badge: 'Decision' });
    }
    for (const tb of tables) {
      if (!match(tb.name)) continue;
      push({ entity: 'tables', id: tb.id, title: tb.name, status: `${tb.columns.length} columns`, badge: 'Table' });
    }
    for (const c of apiCollections) {
      if (!match(c.name)) continue;
      push({ entity: 'apiCollections', id: c.id, title: c.name, status: `${apiEndpoints.filter((e) => e.collectionId === c.id).length} endpoints`, badge: 'API Coll.' });
    }
    for (const e of apiEndpoints) {
      if (!match(e.name, e.path)) continue;
      push({ entity: 'apiEndpoints', id: e.id, title: e.name, status: `${e.method} ${e.path}`, badge: 'Endpoint' });
    }
    return out;
  }, [state, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (active >= options.length) setActive(options.length > 0 ? 0 : -1);
  }, [options.length, active]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (options.length === 0 ? -1 : (a + 1) % options.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (options.length === 0 ? -1 : (a - 1 + options.length) % options.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[active];
      if (opt) onPick(opt.entity, opt.id);
    }
  };

  return (
    <Modal open={open} title="Link an entity" onClose={onClose} width="md">
      <div className="ref-picker">
        <input
          ref={inputRef}
          className="input"
          placeholder="Search tasks, issues, milestones…"
          aria-label="Search tasks and issues"
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={handleKeyDown}
        />
        {options.length === 0 ? (
          <p className="ref-picker-empty">No tasks, issues, or other entities to link.</p>
        ) : (
          <ul className="ref-picker-list" role="listbox" aria-label="Tasks and issues">
            {options.map((opt, i) => (
              <li key={`${opt.entity}-${opt.id}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={`ref-picker-row${i === active ? ' ref-picker-row-active' : ''}`}
                  onClick={() => onPick(opt.entity, opt.id)}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="ref-picker-title">{opt.title}</span>
                  <span className="ref-picker-status">
                    {opt.badge} · {opt.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
