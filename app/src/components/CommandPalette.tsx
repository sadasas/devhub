import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SquaresFour, FolderSimple, Key, BookOpen, UserCircle, Plus, ArrowUp, ArrowDown, ArrowRight, MagnifyingGlass, Columns, Bug, CheckSquare, Scales, Rocket, Stack, Plugs, ChalkboardSimple, Globe, Archive, ArrowCounterClockwise, Monitor, Sun, Moon, ChatsCircle } from '@phosphor-icons/react';
import { matchPath, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../state/projects-context';
import { useTeams } from '../state/teams-context';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useSearchResults } from '../hooks/useSearchResults';
import { entityDeepLink } from '../lib/deep-link';
import { onOpenPalette } from '../lib/palette-events';
import { toggleChat } from '../lib/chat-events';
import { LANGUAGES, useAppLocale } from '../i18n/useAppLocale';
import { useTheme } from '../state/theme-context';

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
  const { projects, update } = useProjects() as unknown as { projects: import('../lib/types').Project[] | null; update: (id: string, patch: Record<string, unknown>) => Promise<unknown> };
  let teams: import('../lib/types').Team[] | null = null;
  try {
    teams = useTeams().teams as import('../lib/types').Team[] | null;
  } catch {
    teams = null;
  }
  const { t } = useTranslation('shell');
  const { lang, setLang } = useAppLocale();
  const { setTheme } = useTheme();
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
        group: t('palette.groupNavigate'),
        label: t('palette.goDashboard'),
        icon: <SquaresFour size={16} />,
        run: () => {
          setOpen(false);
          navigate('/');
        },
      },
      {
        id: 'keys',
        group: t('palette.groupNavigate'),
        label: t('palette.goKeys'),
        icon: <Key size={16} />,
        run: () => {
          setOpen(false);
          navigate('/connected');
        },
      },
      {
        id: 'docs',
        group: t('palette.groupNavigate'),
        label: t('palette.openDocs'),
        icon: <BookOpen size={16} />,
        run: () => {
          setOpen(false);
          navigate('/docs');
        },
      },
      {
        id: 'profile',
        group: t('palette.groupNavigate'),
        label: t('palette.goProfile'),
        icon: <UserCircle size={16} />,
        run: () => {
          setOpen(false);
          navigate('/profile');
        },
      },
      {
        id: 'new-project',
        group: t('palette.groupCreate'),
        label: t('palette.newProject'),
        icon: <Plus size={16} />,
        run: () => {
          setOpen(false);
          navigate('/?new=1');
        },
      },
      {
        id: 'switch-language',
        group: t('palette.groupPreferences'),
        label: t('language.switchTo', {
          name: LANGUAGES.find((l) => l.code !== lang)?.nativeName ?? '',
        }),
        icon: <Globe size={16} />,
        run: () => {
          setOpen(false);
          const other = LANGUAGES.find((l) => l.code !== lang);
          if (other) setLang(other.code);
        },
      },
      {
        id: 'theme-system',
        group: t('palette.groupPreferences'),
        label: t('theme.paletteSystem'),
        icon: <Monitor size={16} />,
        run: () => {
          setOpen(false);
          setTheme('system');
        },
      },
      {
        id: 'theme-light',
        group: t('palette.groupPreferences'),
        label: t('theme.paletteLight'),
        icon: <Sun size={16} />,
        run: () => {
          setOpen(false);
          setTheme('light');
        },
      },
      {
        id: 'theme-dark',
        group: t('palette.groupPreferences'),
        label: t('theme.paletteDark'),
        icon: <Moon size={16} />,
        run: () => {
          setOpen(false);
          setTheme('dark');
        },
      },
    ];
    const activeMatch = matchPath('/project/:projectId', location.pathname);
    const projectId = activeMatch?.params.projectId;
    const project = projectId ? projects?.find((p) => p.id === projectId) : undefined;
    const teamId = (() => {
      const tm = matchPath('/team/:teamId', location.pathname)?.params.teamId;
      if (tm) return tm;
      if (project?.teamId) return project.teamId;
      return teams?.[0]?.id ?? null;
    })();
    if (project && project.role !== 'viewer' && project.status !== 'archived') {
      const createIn = (tab: string, value = '1') => {
        const params = new URLSearchParams(location.search);
        params.set('tab', tab);
        params.set('new', value);
        setOpen(false);
        navigate(`/project/${project.id}?${params.toString()}`);
      };
      const createCommands: { id: string; label: string; icon: ReactNode; tab: string; value?: string }[] = [
        { id: 'new-task', label: t('palette.newTask'), icon: <Columns size={16} />, tab: 'board' },
        { id: 'new-issue', label: t('palette.newIssue'), icon: <Bug size={16} />, tab: 'issues' },
        { id: 'new-test-case', label: t('palette.newTestCase'), icon: <CheckSquare size={16} />, tab: 'tests' },
        { id: 'new-decision', label: t('palette.newDecision'), icon: <Scales size={16} />, tab: 'decisions' },
        { id: 'new-milestone', label: t('palette.newMilestone'), icon: <Rocket size={16} />, tab: 'releases' },
        { id: 'new-tech-entry', label: t('palette.newTechEntry'), icon: <Stack size={16} />, tab: 'stack' },
        { id: 'new-api-collection', label: t('palette.newApiCollection'), icon: <Plugs size={16} />, tab: 'api' },
        { id: 'new-api-endpoint', label: t('palette.newApiEndpoint'), icon: <Plugs size={16} />, tab: 'api', value: 'endpoint' },
        { id: 'new-whiteboard', label: t('palette.newWhiteboard'), icon: <ChalkboardSimple size={16} />, tab: 'whiteboard' },
      ];
      for (const c of createCommands) {
        list.push({
          id: c.id,
          group: t('palette.groupCreate'),
          label: c.label,
          icon: c.icon,
          run: () => createIn(c.tab, c.value),
        });
      }
    }
    if (project && project.role !== 'viewer') {
      if (project.status === 'archived') {
        list.push({
          id: 'unarchive-project',
          group: t('palette.groupCreate'),
          label: 'Unarchive project',
          icon: <ArrowCounterClockwise size={16} />,
          run: () => {
            setOpen(false);
            void update(project.id, { status: 'active' });
          },
        });
      } else {
        list.push({
          id: 'archive-project',
          group: t('palette.groupCreate'),
          label: 'Archive project',
          icon: <Archive size={16} />,
          run: () => {
            setOpen(false);
            void update(project.id, { status: 'archived' });
          },
        });
      }
    }
    if (teamId) {
      list.push({
        id: 'toggle-team-chat',
        group: t('palette.groupNavigate'),
        label: t('palette.toggleTeamChat', { defaultValue: 'Toggle team chat' }),
        icon: <ChatsCircle size={16} />,
        run: () => {
          setOpen(false);
          toggleChat();
        },
      });
    }
    for (const p of projects ?? []) {
      const isArchived = p.status === 'archived';
      list.push({
        id: p.id,
        group: t('palette.groupProjects'),
        label: isArchived ? `${p.name} (archived)` : p.name,
        icon: isArchived ? <Archive size={16} /> : <FolderSimple size={16} />,
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
          group: t('palette.groupSearch'),
          label: t('palette.searching'),
          icon: <MagnifyingGlass size={16} />,
          disabled: true,
          run: () => {},
        });
      } else if (search.error) {
        list.push({
          id: 'search-error',
          group: t('palette.groupSearch'),
          label: search.error,
          icon: <MagnifyingGlass size={16} />,
          disabled: true,
          run: () => {},
        });
      } else {
        for (const projectResult of search.results) {
          const group = t('palette.resultsGroup', { name: projectResult.projectName });
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
  }, [projects, teams, navigate, location, q, search.loading, search.error, search.results, t, lang, setLang, setTheme, update]);

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

  useEffect(
    () =>
      onOpenPalette(() => {
        setQuery('');
        setIndex(0);
        setOpen(true);
      }),
    [],
  );

  if (!open) return null;

  const groups: string[] = [];
  for (const c of filtered) {
    if (!groups.includes(c.group)) groups.push(c.group);
  }

  let flat = 0;
  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label={t('palette.dialog')}>
      <div className="palette-backdrop" onMouseDown={() => setOpen(false)} />
      <div className="palette-panel" ref={panelRef}>
        <input
          ref={inputRef}
          className="palette-input"
          value={query}
          maxLength={200}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('palette.searchPlaceholder')}
          aria-label={t('palette.searchCommands')}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={filtered[index] ? `palette-option-${filtered[index].id}` : undefined}
        />
        <div className="palette-list" id="palette-list" role="listbox" aria-label={t('palette.commandsList')}>
          {filtered.length === 0 && <div className="palette-empty">{t('palette.noMatches', { query })}</div>}
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
            <ArrowUp size={11} /> <ArrowDown size={11} /> {t('palette.hintNavigate')}
          </span>
          <span>
            <ArrowRight size={11} /> {t('palette.hintOpen')}
          </span>
          <span>{t('palette.hintClose')}</span>
        </div>
      </div>
    </div>
  );
}

