import {
  BookmarkSimple,
  CaretDown,
  CurrencyCircleDollar,
  EnvelopeSimple,
  FolderSimple,
  GearSix,
  House,
  MagnifyingGlass,
  Notebook,
  Plugs,
  PushPin,
  Receipt,
  Plus,
  SignOut,
  User,
  UsersThree,
} from '@phosphor-icons/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, type NavLinkProps } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../../state/projects-context';
import { useTeams } from '../../state/teams-context';
import { useAuth } from '../../state/auth-context';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { Avatar } from '../../components/Avatar';
import { NewProjectModal } from '../dashboard/NewProjectModal';
import { useActivityUnread } from '../../state/ActivityUnreadContext';
import { WorkspaceSwitcher, writeLastActiveTeamId } from './WorkspaceSwitcher';
import { SettingsNav } from './SettingsNav';
import { ProjectSettingsNav } from '../project/ProjectSettingsNav';
import { normalizeProjectTabId } from '../project/projectSettingsSections';

interface SidebarProps {
  activeTeamId?: string | null;
  onCreateTeam?: () => void;
  /** Dipakai drawer mobile: tutup drawer setelah user memilih nav section. */
  onNavigate?: () => void;
}

// Opsi A — single-mode team-first sidebar. No Home/All-Team branch: the
// route (via Layout) always resolves exactly one active team, so this
// component renders one fixed order: switcher → invites → team dashboard →
// L1 project panel (the only scroll region) → docs → hint → user footer.
// Account-owned routes live in the footer menu, never as nav rows.

// Pinned projects: single source of truth shared with the project header
// star button. One localStorage key per team, capped, JSON string array.
export const PINNED_KEY_PREFIX = 'devhub:sidebar:pinned:';
export const PINNED_LIMIT = 5;
export const PINS_CHANGED_EVENT = 'devhub:pins-changed';

export function readIdList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

function writeIdList(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids.slice(0, PINNED_LIMIT)));
  } catch {
    // Persistence is a hint only — the list stays in memory.
  }
}

function broadcastPinsChanged(teamId: string): void {
  try {
    window.dispatchEvent(new CustomEvent(PINS_CHANGED_EVENT, { detail: { teamId } }));
  } catch {
    // Broadcast is best-effort; storage is the source of truth.
  }
}

// Shared toggle used by the sidebar rows and the project header star.
// Prepends on pin, removes on unpin, caps at PINNED_LIMIT.
export function togglePinnedId(teamId: string, projectId: string): string[] {
  const key = PINNED_KEY_PREFIX + teamId;
  const prev = readIdList(key);
  const next = prev.includes(projectId)
    ? prev.filter((id) => id !== projectId)
    : [projectId, ...prev].slice(0, PINNED_LIMIT);
  writeIdList(key, next);
  broadcastPinsChanged(teamId);
  return next;
}

const ProjectRow = memo(function ProjectRow({
  p,
  badge,
  itemClass,
  pinned,
  onTogglePin,
}: {
  p: { id: string; name: string };
  badge: { new: number; deleted: number; total: number };
  itemClass: (extra?: string) => NavLinkProps['className'];
  pinned: boolean;
  onTogglePin: (projectId: string) => void;
}) {
  const { t } = useTranslation('shell');
  const hasBadge = badge.total > 0;
  const pinLabel = pinned
    ? (t('sidebar.unpinProject', { name: p.name }) as string)
    : (t('sidebar.pinProject', { name: p.name }) as string);
  return (
    <div className="sidebar-project-row">
      <NavLink
        key={p.id}
        to={`/project/${p.id}`}
        className={itemClass('sidebar-project-item')}
        title={p.name}
      >
        <FolderSimple size={14} weight="duotone" aria-hidden="true" />
        <span className="sidebar-item-label">{p.name}</span>
        {hasBadge && (
          <span className="sidebar-project-badges" role="img" aria-label={t('sidebar.projectBadgeAria', { new: badge.new, deleted: badge.deleted, name: p.name }) as string} title={t('sidebar.projectBadgeTitle', { new: badge.new, deleted: badge.deleted }) as string}>
            {badge.new > 0 && <span className="tab-badge tab-badge-new" aria-hidden="true">{badge.new > 99 ? '99+' : badge.new}</span>}
            {badge.deleted > 0 && <span className="tab-badge tab-badge-deleted" aria-hidden="true">{badge.deleted > 99 ? '99+' : badge.deleted}</span>}
          </span>
        )}
      </NavLink>
      <button
        type="button"
        className="pin-toggle"
        aria-pressed={pinned}
        aria-label={pinLabel}
        title={pinLabel}
        onClick={() => onTogglePin(p.id)}
      >
        <PushPin size={13} weight={pinned ? 'fill' : 'duotone'} aria-hidden="true" />
      </button>
    </div>
  );
});

function UserFooter() {
  const { t } = useTranslation('shell');
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open ]);

  if (!user) return null;
  const displayName = user.displayName?.trim() || user.email.split('@')[0] || user.email;

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setOpen(false);
    }
  };

  const menuItems = [
    { to: '/profile', icon: <User size={15} weight="duotone" aria-hidden="true" />, label: t('sidebar.profile') as string },
    { to: '/connected', icon: <Plugs size={15} weight="duotone" aria-hidden="true" />, label: t('sidebar.myConnections') as string },
    { to: '/templates', icon: <BookmarkSimple size={15} weight="duotone" aria-hidden="true" />, label: t('sidebar.templates') as string },
    { to: '/payments', icon: <Receipt size={15} weight="duotone" aria-hidden="true" />, label: t('sidebar.myPayments') as string, hint: t('sidebar.myPaymentsHint') as string },
  ];

  return (
    <div className="user-footer" ref={wrapRef}>
      {open && (
        <div ref={menuRef} role="menu" aria-label={t('sidebar.footerMenu')} className="user-footer-menu">
          {menuItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              className="user-footer-item"
              title={item.hint ?? item.label}
              onClick={() => close(false)}
            >
              {item.icon}
              <span className="sidebar-item-label">{item.label}</span>
            </Link>
          ))}
          <div className="user-footer-divider" aria-hidden="true" />
          <button
            type="button"
            role="menuitem"
            className="user-footer-item"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
          >
            <SignOut size={15} weight="duotone" aria-hidden="true" />
            <span className="sidebar-item-label">{t('sidebar.signOut')}</span>
          </button>
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        className="user-footer-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('sidebar.signedIn')}: ${displayName}`}
        title={`${displayName} — ${user.email}`}
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        <Avatar
          src={user.avatarUrl ?? null}
          name={displayName}
          email={user.email}
          id={user.id}
          size={28}
          className="user-footer-avatar"
        />
        <span className="user-footer-meta">
          <span className="user-footer-name">{displayName}</span>
          <span className="user-footer-email">{user.email}</span>
        </span>
        <CaretDown size={14} className="user-footer-chevron" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Sidebar({ activeTeamId, onCreateTeam, onNavigate }: SidebarProps) {
  const { projects } = useProjects();
  const { teams, invitations } = useTeams();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [prefillTeamId, setPrefillTeamId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showProjects, setShowProjects] = useState(true);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const { t } = useTranslation('shell');
  const navigate = useNavigate();
  const location = useLocation();
  // Single-sidebar rule: on the settings route the main sidebar swaps its
  // team nav for the settings nav (no second sidebar in content).
  const settingsMode = location.pathname.endsWith('/settings');
  // Project settings (?tab=settings di /project/:id) ikut aturan yang sama
  // TAPI hanya di mobile (drawer): di desktop nav settings tetap di dalam
  // konten agar tak ganda. Fail-closed: project tak dikenal atau role viewer
  // tetap nav normal (konten pun fallback board).
  // Takeover sidebar HANYA di mobile (drawer, ≤860px — breakpoint yang sama
  // dengan drawer switch): di desktop nav settings tetap di dalam konten.
  const [isMobileSidebar, setIsMobileSidebar] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' ? window.matchMedia('(max-width: 860px)').matches : false;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      const mql = window.matchMedia('(max-width: 860px)');
      const onChange = () => setIsMobileSidebar(mql.matches);
      onChange();
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    } catch {
      return;
    }
  }, []);
  const projectSearch = new URLSearchParams(location.search);
  const projectSettingsMatch = location.pathname.match(/^\/project\/([^/]+)$/);
  const settingsProject = projectSettingsMatch
    ? ((projects ?? []).find((p) => p.id === projectSettingsMatch[1]) ?? null)
    : null;
  const projectSettingsMode =
    isMobileSidebar &&
    projectSearch.get('tab') === 'settings' &&
    settingsProject !== null &&
    settingsProject.role !== 'viewer';
  const projectSettingsFrom = normalizeProjectTabId(projectSearch.get('from'));
  const projectSettingsTo =
    settingsProject !== null
      ? `/project/${encodeURIComponent(settingsProject.id)}?tab=${projectSettingsFrom}`
      : '/';

  // Reset local UI when switching team context, and load that team's
  // pinned list from storage.
  useEffect(() => {
    setFilterQuery('');
    setShowArchived(false);
    setShowProjects(true);
    setPinnedIds(activeTeamId ? readIdList(PINNED_KEY_PREFIX + activeTeamId) : []);
  }, [activeTeamId]);

  const projectsByTeam = useMemo(() => {
    const map = new Map<string, typeof projects>();
    for (const p of projects ?? []) {
      const list = map.get(p.teamId) ?? [];
      list.push(p);
      map.set(p.teamId, list);
    }
    return map;
  }, [projects]);

  const teamsLoading = teams === null;
  const activeTeam = teams?.find((tm) => tm.id === activeTeamId) ?? null;
  const teamProjectsAll = activeTeam ? (projectsByTeam.get(activeTeam.id) ?? []) : [];
  const showFilter = teamProjectsAll.length > 8;

  const lowerQuery = filterQuery.trim().toLowerCase();
  const { filteredActive, filteredArchived } = useMemo(() => {
    const list = [...teamProjectsAll].sort((a, b) => a.name.localeCompare(b.name));
    const filtered = !lowerQuery ? list : list.filter((p) => p.name.toLowerCase().includes(lowerQuery));
    return {
      filteredActive: filtered.filter((p) => p.status !== 'archived'),
      filteredArchived: filtered.filter((p) => p.status === 'archived'),
    };
  }, [teamProjectsAll, lowerQuery]);

  const projectsById = useMemo(() => {
    const map = new Map<string, (typeof teamProjectsAll)[number]>();
    for (const p of teamProjectsAll) map.set(p.id, p);
    return map;
  }, [teamProjectsAll]);

  const pinnedProjects = useMemo(
    () =>
      pinnedIds
        .map((id) => projectsById.get(id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined && p.status !== 'archived')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [pinnedIds, projectsById],
  );

  // Pinned projects float to the top of the single PROJECT list
  // automatically; the panel is a project list, not a pin list.
  const orderedActive = useMemo(() => {
    const pinnedSet = new Set(pinnedIds);
    return [
      ...pinnedProjects,
      ...filteredActive.filter((p) => !pinnedSet.has(p.id)),
    ];
  }, [pinnedProjects, filteredActive, pinnedIds]);
  // Unread badge per project — shared via ActivityUnreadContext (single batch in Layout)
  const { getBadge } = useActivityUnread();

  const itemClass =
    (extra = ''): NavLinkProps['className'] =>
      ({ isActive }) =>
        `sidebar-item${extra ? ` ${extra}` : ''}${isActive ? ' sidebar-item-active' : ''}`;

  const openCreateProject = (teamId?: string) => {
    setPrefillTeamId(teamId ?? activeTeamId ?? null);
    setCreateProjectOpen(true);
  };

  const togglePin = (projectId: string) => {
    if (!activeTeamId) return;
    setPinnedIds(togglePinnedId(activeTeamId, projectId));
  };

  // Cross-component sync: the project header star writes the same key.
  useEffect(() => {
    if (!activeTeamId) return;
    const key = PINNED_KEY_PREFIX + activeTeamId;
    const reload = () => setPinnedIds(readIdList(key));
    const onPinsChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ teamId?: string }>).detail;
      if (detail?.teamId && detail.teamId !== activeTeamId) return;
      reload();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) reload();
    };
    window.addEventListener(PINS_CHANGED_EVENT, onPinsChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PINS_CHANGED_EVENT, onPinsChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [activeTeamId]);

  // Switch workspace: remember it for the next session, then navigate to
  // the canonical workspace route (/:slug/projects). The route stays the
  // source of truth (see Layout).
  const handleSelectTeam = (teamId: string) => {
    writeLastActiveTeamId(teamId);
    const target = teams?.find((tm) => tm.id === teamId);
    const slug = target?.slug || target?.id || teamId;
    navigate(`/${encodeURIComponent(slug)}/projects`);
  };

  // Global routes (invites/docs/...) keep showing the last team as context.
  const dashboardTo = activeTeam
    ? `/${encodeURIComponent(activeTeam.slug || activeTeam.id)}/projects`
    : '/';
  const membersTo = activeTeam
    ? `/${encodeURIComponent(activeTeam.slug || activeTeam.id)}/members`
    : '/';
  const settingsTo = activeTeam
    ? `/${encodeURIComponent(activeTeam.slug || activeTeam.id)}/settings`
    : '/';

  // Zero-team has no sidebar chrome: Layout hides the sidebar + drawer, so
  // render nothing (loading skeleton above still shows while teams load).
  if (!teamsLoading && !activeTeam) return null;

  return (
    <aside className="sidebar" aria-label={t('sidebar.primaryNav')}>
      {teamsLoading ? (
        <div role="status" aria-label={t('sidebar.loadingTeams') as string} aria-busy="true">
          <span className="sr-only">{t('sidebar.loadingTeamsText')}</span>
          <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 8px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 36 }}>
              <Skeleton style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0 }} />
              <Skeleton style={{ width: "55%", height: 13 }} />
              <Skeleton style={{ width: 12, height: 12, borderRadius: 4, marginLeft: "auto", flexShrink: 0 }} />
            </div>
            <Skeleton style={{ width: "45%", height: 10 }} />
            <Skeleton style={{ width: "100%", height: 32, borderRadius: 8 }} />
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 6px 6px 36px" }}>
                <Skeleton style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0 }} />
                <Skeleton style={{ width: `${60 + i * 5}%`, height: 12 }} />
              </div>
            ))}
            <Skeleton style={{ width: "100%", height: 36, borderRadius: 8 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid var(--border-hairline)", paddingTop: 8 }}>
              <Skeleton style={{ width: 28, height: 28, borderRadius: 999, flexShrink: 0 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Skeleton style={{ width: 90, height: 13 }} />
                <Skeleton style={{ width: 120, height: 11 }} />
              </div>
            </div>
          </div>
        </div>
      ) : activeTeam ? (
        settingsMode ? (
          <>
            <WorkspaceSwitcher
              teams={teams ?? []}
              activeTeamId={activeTeam.id}
              onSelectTeam={handleSelectTeam}
              onCreateTeam={() => onCreateTeam?.()}
            />
            <SettingsNav teamSlug={activeTeam.slug || activeTeam.id} dashboardTo={dashboardTo} onSelect={onNavigate} />
            <UserFooter />
          </>
        ) : projectSettingsMode && settingsProject !== null ? (
          <>
            <WorkspaceSwitcher
              teams={teams ?? []}
              activeTeamId={activeTeam.id}
              onSelectTeam={handleSelectTeam}
              onCreateTeam={() => onCreateTeam?.()}
            />
            <ProjectSettingsNav projectId={settingsProject.id} projectTo={projectSettingsTo} onSelect={onNavigate} />
            <UserFooter />
          </>
        ) : (
        <>
          <WorkspaceSwitcher
            teams={teams ?? []}
            activeTeamId={activeTeam.id}
            onSelectTeam={handleSelectTeam}
            onCreateTeam={() => onCreateTeam?.()}
          />

          <nav className="sidebar-nav" aria-label={t('sidebar.invitations')}>
            <NavLink to="/invites" className={itemClass()} aria-label={t('sidebar.invitations')}>
              <EnvelopeSimple size={15} weight="duotone" aria-hidden="true" />
              <span>{t('sidebar.invitations')}</span>
              {invitations.length > 0 && (
                <span
                  className="sidebar-count sidebar-count--alert"
                  role="img"
                  aria-label={t('sidebar.pendingInvitations', { count: invitations.length }) as string}
                >
                  {invitations.length > 99 ? '99+' : invitations.length}
                </span>
              )}
            </NavLink>
          </nav>

          <div className="sidebar-section sidebar-team-label">
            <span>{t('sidebar.thisTeam', { team: activeTeam.name })}</span>
            <span className="sidebar-count-muted" aria-hidden="true">
              {filteredActive.length}
            </span>
          </div>
          <nav className="sidebar-nav" aria-label={t('sidebar.teamsNav')}>
            <NavLink to={dashboardTo} end className={itemClass()} aria-label={t('sidebar.dashboard')}>
              <House size={15} weight="duotone" aria-hidden="true" />
              <span>{t('sidebar.dashboard')}</span>
            </NavLink>
          </nav>

          {/* L1 — active-team project panel. The only scrollable region in
              the sidebar (flex:1 + min-height:0 + overflow-y:auto in CSS).
              New project / filter / pinned / A-Z list / archived
              all live here; everything below the divider is fixed. */}
          <section
            className="sidebar-l1"
            aria-label={activeTeam.name}
          >
            <button
              type="button"
              className="sidebar-create-project"
              aria-label={t('sidebar.newProjectIn', { team: activeTeam.name }) as string}
              onClick={() => openCreateProject(activeTeam.id)}
              data-tour-id="create-project"
            >
              <Plus size={14} weight="bold" aria-hidden="true" />
              <span>{t('sidebar.newProject')}</span>
            </button>

            {showProjects && showFilter && (
              <div className="sidebar-filter" role="search">
                <MagnifyingGlass size={14} aria-hidden="true" className="sidebar-filter-icon" />
                <input
                  type="text"
                  className="sidebar-filter-input"
                  placeholder={t('sidebar.filterPlaceholder') as string}
                  aria-label={t('sidebar.filterPlaceholder') as string}
                  value={filterQuery}
                  maxLength={100}
                  onChange={(e) => setFilterQuery(e.target.value)}
                />
              </div>
            )}

            <nav className="sidebar-nav sidebar-nav--l1" aria-label={t('sidebar.projects')}>
              <button
                type="button"
                className="sidebar-item sidebar-projects-toggle"
                aria-expanded={showProjects}
                onClick={() => setShowProjects((v) => !v)}
              >
                <FolderSimple size={15} weight="duotone" aria-hidden="true" />
                <span className="sidebar-item-label">{t('sidebar.projects')}</span>
                <span className="sidebar-count-muted">{orderedActive.length}</span>
                <CaretDown size={12} weight="bold" aria-hidden="true" className="sidebar-projects-chevron" />
              </button>
              {showProjects && (
              <>
              {orderedActive.length === 0 ? (
                lowerQuery ? (
                  <div className="sidebar-empty">
                    <p>{t('sidebar.noMatches', { query: filterQuery })}</p>
                    <Button variant="ghost" size="sm" onClick={() => setFilterQuery('')}>
                      {t('sidebar.clearFilter')}
                    </Button>
                  </div>
                ) : (
                  <div className="sidebar-project-empty">
                    <span>{t('sidebar.noProjectsYet')}</span>{' '}
                  </div>
                )
              ) : (
                orderedActive.map((p) => (
                  <ProjectRow
                    key={p.id}
                    p={p}
                    badge={getBadge(p.id)}
                    itemClass={itemClass}
                    pinned={pinnedIds.includes(p.id)}
                    onTogglePin={togglePin}
                  />
                ))
              )}
              {filteredArchived.length > 0 && (
                <div className="sidebar-archived">
                  <button
                    type="button"
                    className="sidebar-item sidebar-archived-toggle"
                    aria-expanded={showArchived}
                    onClick={() => setShowArchived((v) => !v)}
                  >
                    <FolderSimple size={15} weight="duotone" aria-hidden="true" />
                    <span className="sidebar-item-label">{t('sidebar.archived')}</span>
                    <span className="sidebar-count-muted">{filteredArchived.length}</span>
                    <CaretDown size={12} weight="bold" aria-hidden="true" className="sidebar-archived-chevron" />
                  </button>
                  {showArchived && (
                    <div className="sidebar-archived-children">
                      {filteredArchived.map((p) => (
                        <NavLink
                          key={p.id}
                          to={`/project/${p.id}`}
                          className={itemClass('sidebar-project-item sidebar-project-item--archived')}
                          title={t('sidebar.archivedProjectTitle', { name: p.name, archived: t('sidebar.archived') }) as string}
                        >
                          <FolderSimple size={14} weight="duotone" aria-hidden="true" />
                          <span className="sidebar-item-label">{p.name}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )}
              </>
              )}
            </nav>
          </section>
          <div className="sidebar-team-footer">
            <NavLink to={membersTo} className={itemClass()}>
              <UsersThree size={15} weight="duotone" aria-hidden="true" />
              <span>
                {t('sidebar.members', { count: activeTeam.memberCount })}
              </span>
            </NavLink>
            {activeTeam.role !== 'viewer' && (
              <NavLink to={settingsTo} className={itemClass()}>
                <GearSix size={15} weight="duotone" aria-hidden="true" />
                <span>
                  {t('sidebar.settings')}
                </span>
              </NavLink>
            )}
          </div>
          {/* Thin divider between the team panel and the fixed bottom.
              Non-interactive. */}
          <div className="sidebar-divider" role="separator" aria-orientation="horizontal" />
          <nav className="sidebar-nav" aria-label={t('sidebar.docs')}>
            <NavLink to="/docs" className={itemClass()} aria-label={t('sidebar.docs')}>
              <Notebook size={15} weight="duotone" aria-hidden="true" />
              <span>{t('sidebar.docs')}</span>
            </NavLink>
            <NavLink to="/pricing" className={itemClass()} aria-label={t('sidebar.pricing')}>
              <CurrencyCircleDollar size={15} weight="duotone" aria-hidden="true" />
              <span>{t('sidebar.pricing')}</span>
            </NavLink>
          </nav>
          <p className="sidebar-hint" aria-hidden="true">
            Ctrl + K · Alt + 1–9
          </p>
          <UserFooter />
        </>
        )
      ) : null}

      <NewProjectModal
        open={createProjectOpen}
        onClose={() => {
          setCreateProjectOpen(false);
          setPrefillTeamId(null);
        }}
        initialTeamId={prefillTeamId}
      />
    </aside>
  );
}
