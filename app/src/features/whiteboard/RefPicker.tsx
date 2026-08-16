import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Issue, Task } from '../../lib/types';
import { Modal } from '../../components/Modal';

interface RefPickerProps {
  open: boolean;
  tasks: Task[];
  issues: Issue[];
  onPick: (entity: 'tasks' | 'issues', entityId: string) => void;
  onClose: () => void;
}

interface RefOption {
  entity: 'tasks' | 'issues';
  id: string;
  title: string;
  status: string;
  badge: string;
}

export function RefPicker({ open, tasks, issues, onPick, onClose }: RefPickerProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const options = useMemo<RefOption[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);
    return [
      ...tasks
        .filter((t) => match(t.title))
        .map((t) => ({ entity: 'tasks' as const, id: t.id, title: t.title, status: t.status, badge: 'Task' })),
      ...issues
        .filter((i) => match(i.title))
        .map((i) => ({ entity: 'issues' as const, id: i.id, title: i.title, status: i.status, badge: 'Issue' })),
    ];
  }, [tasks, issues, query]);

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
          placeholder="Search tasks and issues…"
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
          <p className="ref-picker-empty">No tasks or issues to link.</p>
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