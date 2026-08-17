import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SquaresFour, FolderSimple, Key, BookOpen, UserCircle, Plus, ArrowUp, ArrowDown, ArrowRight, MagnifyingGlass, Columns, Bug, CheckSquare, Scales, Rocket, Stack, Plugs, ChalkboardSimple } from '@phosphor-icons/react';
import { matchPath, useLocation, useNavigate } from 'react-router';
import { useProjects } from '../state/projects-context';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useSearchResults } from '../hooks/useSearchResults';
import { entityDeepLink } from '../lib/deep-link';

interface PaletteCommand {
  id: string;
  group: string;
  label: string;
  icon: ReactNode;
  labelNode?: ReactNode;
  disabled?: boolean;
  skipFilter?: boolean;
  run: () => void;
}

function highlight(text: string, query: string): ReactNode {
  const q = query.trim().toLowerCase();
  if (!q) return text;
  const lower = text.toLowerCase();
  const index = lower.indexOf(q);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
}

export function CommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects } = useProjects();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useFocusTrap<HTMLDivElement>(open);
  const openRef = useRef(open);
  openRef.current = open;
  const stateRef = useRef({ filtered: [] as PaletteCommand[], index: 0 });

  const search = useSearchResults(query);
  const q = query.trim();

  const commands = useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [
      {
        id: 'dashboard',
        group: 'Navigate',
        label: 'Go to dashboard',
        icon: <SquaresFour size={16} />,
        run: () => {
          setOpen(false);
          navigate('/');
        },
      },
      {
        id: 'keys',
        group: 'Navigate',
        label: 'Go to API keys',
        icon: <Key size={16} />,
        run: () => {
          setOpen(false);
          navigate('/keys');
        },
      },
      {
        id: 'docs',
        group: 'Navigate',
        label: 'Open docs',
        icon: <BookOpen size={16} />,
        run: () => {
          setOpen(false);
          navigate('/docs');
        },
      },
      {
        id: 'profile',
        group: 'Navigate',
        label: 'Go to profile',
        icon: <UserCircle size={16} />,
        run: () => {
          setOpen(false);
          navigate('/profile');
        },
      },
      {
        id: 'new-project',
        group: 'Create',
        label: 'New project',
        icon: <Plus size={16} />,
        run: () => {
          setOpen(false);
          navigate('/?new=1');
        },
      },
    ];
    const activeMatch = matchPath('/project/:projectId', location.pathname);
    const projectId = activeMatch?.params.projectId;
    const project = projectId ? projects?.find((p) => p.id === projectId) : undefined;
    if (project && project.role !== 'viewer') {
      const createIn = (tab: string, value = '1') => {
        const params = new URLSearchParams(location.search);
        params.set('tab', tab);
        params.set('new', value);
        setOpen(false);
        navigate(`/project/${project.id}?${params.toString()}`);
      };
      const createCommands: { id: string; label: string; icon: ReactNode; tab: string; value?: string }[] = [
        { id: 'new-task', label: 'New task', icon: <Columns size={16} />, tab: 'board' },
        { id: 'new-issue', label: 'New issue', icon: <Bug size={16} />, tab: 'issues' },
        { id: 'new-test-case', label: 'New test case', icon: <CheckSquare size={16} />, tab: 'tests' },
        { id: 'new-decision', label: 'New decision', icon: <Scales size={16} />, tab: 'decisions' },
        { id: 'new-milestone', label: 'New milestone', icon: <Rocket size={16} />, tab: 'releases' },
        { id: 'new-tech-entry', label: 'New tech entry', icon: <Stack size={16} />, tab: 'stack' },
        { id: 'new-api-collection', label: 'New API collection', icon: <Plugs size={16} />, tab: 'api' },
        { id: 'new-api-endpoint', label: 'New API endpoint', icon: <Plugs size={16} />, tab: 'api', value: 'endpoint' },
        { id: 'new-whiteboard', label: 'New whiteboard', icon: <ChalkboardSimple size={16} />, tab: 'whiteboard' },
      ];
      for (const c of createCommands) {
        list.push({
          id: c.id,
          group: 'Create',
          label: c.label,
          icon: c.icon,
          run: () => createIn(c.tab, c.value),
        });
      }
    }
    for (const p of projects ?? []) {
      list.push({
        id: p.id,
        group: 'Projects',
        label: p.name,
        icon: <FolderSimple size={16} />,
        run: () => {
          setOpen(false);
          navigate(`/project/${p.id}`);
        },
      });
    }
    if (q.length >= 2) {
      const labelNode = (title: string, snippet: string) => (
        <span className="palette-item-label">
          <span className="palette-item-title">{highlight(title, q)}</span>
          <span className="palette-item-snippet"> {snippet}</span>
        </span>
      );
      if (search.loading) {
        list.push({
          id: 'search-loading',
          group: 'Search',
          label: 'Searching…',
          icon: <MagnifyingGlass size={16} />,
          disabled: true,
          run: () => {},
        });
      } else if (search.error) {
        list.push({
          id: 'search-error',
          group: 'Search',
          label: search.error,
          icon: <MagnifyingGlass size={16} />,
          disabled: true,
          run: () => {},
        });
      } else {
        for (const projectResult of search.results) {
          const group = `Results · ${projectResult.projectName}`;
          for (const hit of projectResult.hits) {
            list.push({
              id: `search-${projectResult.projectId}-${hit.entity}-${hit.entityId}`,
              group,
              label: hit.title || hit.snippet,
              labelNode: labelNode(hit.title || hit.snippet, hit.snippet),
              skipFilter: true,
              icon: <MagnifyingGlass size={16} />,
              run: () => {
                setOpen(false);
                navigate(entityDeepLink(projectResult.projectId, hit.entity, hit.entityId));
              },
            });
          }
        }
      }
    }
    return list;
  }, [projects, navigate, location, q, search.loading, search.error, search.results]);

  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return q
      ? commands.filter((c) => c.disabled || c.skipFilter || c.label.toLowerCase().includes(lower))
      : commands;
  }, [commands, q]);
  stateRef.current = { filtered, index };

  useEffect(() => {
    setIndex(0);
  }, [filtered.length, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!openRef.current) {
          setQuery('');
          setIndex(0);
        }
        setOpen((o) => !o);
        return;
      }
      if (e.key === '?' && !openRef.current) {
        e.preventDefault();
        setQuery('');
        setIndex(0);
        setOpen(true);
        return;
      }
      if (e.key === '/' && !openRef.current) {
        const target = e.target as HTMLElement | null;
        const typing =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable;
        if (!typing) {
          e.preventDefault();
          setQuery('');
          setIndex(0);
          setOpen(true);
        }
        return;
      }
      if (!openRef.current) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, Math.max(stateRef.current.filtered.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        stateRef.current.filtered[stateRef.current.index]?.run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
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
          placeholder="Type a command or search tasks, issues, decisions…"
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
                      disabled={c.disabled}
                      aria-selected={isActive}
                      aria-disabled={c.disabled || undefined}
                      className={isActive ? 'palette-item palette-item-active' : 'palette-item'}
                      onMouseEnter={() => setIndex(flat - 1)}
                      onClick={() => c.run()}
                    >
                      {c.icon}
                      {c.labelNode ?? <span className="palette-item-label">{c.label}</span>}
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
