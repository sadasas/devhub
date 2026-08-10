import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SquaresFour, FolderSimple, Key, Robot, ArrowUp, ArrowDown, ArrowRight } from '@phosphor-icons/react';
import { useNavigation } from '../state/navigation-context';
import { useProjects } from '../state/projects-context';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface PaletteCommand {
  id: string;
  group: string;
  label: string;
  icon: ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const { openDashboard, openProject, openKeys, openMcpGuide } = useNavigation();
  const { projects } = useProjects();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useFocusTrap<HTMLDivElement>(open);

  const commands = useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [
      {
        id: 'dashboard',
        group: 'Navigate',
        label: 'Go to dashboard',
        icon: <SquaresFour size={16} />,
        run: () => {
          setOpen(false);
          openDashboard();
        },
      },
      {
        id: 'keys',
        group: 'Navigate',
        label: 'Go to API keys',
        icon: <Key size={16} />,
        run: () => {
          setOpen(false);
          openKeys();
        },
      },
      {
        id: 'mcp',
        group: 'Navigate',
        label: 'Open MCP guide',
        icon: <Robot size={16} />,
        run: () => {
          setOpen(false);
          openMcpGuide();
        },
      },
    ];
    for (const p of projects ?? []) {
      list.push({
        id: p.id,
        group: 'Projects',
        label: p.name,
        icon: <FolderSimple size={16} />,
        run: () => {
          setOpen(false);
          openProject(p.id);
        },
      });
    }
    return list;
  }, [projects, openDashboard, openProject, openKeys, openMcpGuide]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands;
  }, [commands, query]);

  useEffect(() => {
    setIndex(0);
  }, [filtered.length, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filtered[index]?.run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, index]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const groups: string[] = [];
  for (const c of filtered) {
    if (!groups.includes(c.group)) groups.push(c.group);
  }

  let flat = 0;
  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="palette-backdrop" onMouseDown={() => setOpen(false)} />
      <div className="palette-panel" ref={panelRef}>
        <input
          ref={inputRef}
          className="palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command or project name…"
          aria-label="Search commands"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={filtered[index] ? `palette-option-${filtered[index].id}` : undefined}
        />
        <div className="palette-list" id="palette-list" role="listbox" aria-label="Commands">
          {filtered.length === 0 && <div className="palette-empty">No matches for “{query}”</div>}
          {groups.map((g) => (
            <div key={g}>
              <div className="palette-group">{g}</div>
              {filtered
                .filter((c) => c.group === g)
                .map((c) => {
                  const isActive = flat === index;
                  flat += 1;
                  return (
                    <button
                      key={c.id}
                      id={`palette-option-${c.id}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={isActive ? 'palette-item palette-item-active' : 'palette-item'}
                      onMouseEnter={() => setIndex(flat - 1)}
                      onClick={() => c.run()}
                    >
                      {c.icon}
                      <span className="palette-item-label">{c.label}</span>
                      <span className="palette-item-hint">{isActive ? '↵' : ''}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
        <div className="palette-footer">
          <span>
            <ArrowUp size={11} /> <ArrowDown size={11} /> navigate
          </span>
          <span>
            <ArrowRight size={11} /> open
          </span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
