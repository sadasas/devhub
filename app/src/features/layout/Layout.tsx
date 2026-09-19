import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChatsCircle, List, MagnifyingGlass } from '@phosphor-icons/react';
import { Sidebar } from './Sidebar';
import { LAST_ACTIVE_TEAM_KEY, writeLastActiveTeamId } from './WorkspaceSwitcher';
import { isTourActive, readTourStep, subscribeTour } from '../onboarding/tour-events';
import { newestTeamId } from '../onboarding/tour-dom';
import { openPalette } from '../../lib/palette-events';
import { onToggleChat, toggleChat } from '../../lib/chat-events';
import { api } from '../../lib/api';
import { realtimeWsUrl, TeamChatSocket } from '../../lib/realtime-client';
import { useTeams } from '../../state/teams-context';
import { resolveTeamlessRedirect } from './team-guard';
import { useProjects } from '../../state/projects-context';
import { useAuth } from '../../state/auth-context';
import { CreateTeamModal } from '../teams/CreateTeamModal';
import { ProjectChatWidget } from '../project/ProjectChatWidget';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const SIDEBAR_WIDTH_KEY = 'devhub:layout:sidebarWidth';
const SIDEBAR_COLLAPSED_KEY = 'devhub:layout:sidebarCollapsed';
const CHAT_WIDTH_KEY = 'devhub:layout:chatWidth';
const CHAT_OPEN_PREFIX = 'devhub:layout:chatOpen:';
const TOPBAR_CHAT_UNREAD_POLL_MS = 30_000;

// Content-header chat toggle — bar action (36px) inside main's sticky
// content-header (replaces the removed floating FAB + global topbar).
// Calls the existing toggleChat() event (no prop drilling) and reflects
// open state via aria-expanded. Unread badge: polling + socket refresh.
function TopbarChatButton({ teamId, open, isMobile }: { teamId: string; open: boolean; isMobile: boolean }) {
  const { t } = useTranslation('project');
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!teamId) return;
    try {
      const count = await api.getUnreadCount(teamId);
      setUnread(count);
    } catch {
      /* badge best-effort */
    }
  }, [teamId]);

  useEffect(() => {
    if (!user || !teamId || open) return;
    let cancelled = false;
    const doPoll = async () => {
      if (cancelled) return;
      await refreshUnread();
    };
    void doPoll();
    const timer = setInterval(() => void doPoll(), TOPBAR_CHAT_UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user, teamId, open, refreshUnread]);

  useEffect(() => {
    if (!user || !teamId || open) return;
    const socket = new TeamChatSocket({
      wsUrl: realtimeWsUrl(),
      teamId,
      onMessageNew: () => void refreshUnread(),
    });
    return () => socket.close();
  }, [user, teamId, open, refreshUnread]);

  // Clear the local badge when chat opens. Server-side read marking stays
  // in ProjectChatWidget (single writer) to avoid duplicate requests.
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  const showBadge = !open && unread > 0;

  return (
    <button
      id="topbar-chat-btn"
      type="button"
      className="topbar-btn topbar-btn-chat"
      onClick={() => toggleChat()}
      aria-label={open ? t('chat.closeAria') : t('chat.launcherAria')}
      aria-expanded={open}
      aria-controls={isMobile ? 'project-chat-drawer' : 'chat-inline-shell'}
      aria-haspopup={isMobile ? 'dialog' : undefined}
    >
      <ChatsCircle size={18} weight="bold" aria-hidden="true" />
      {showBadge && (
        <>
          <span className="topbar-chat-badge" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
          <span className="sr-only">{t('chat.unread', { count: unread })}</span>
        </>
      )}
    </button>
  );
}

export function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try { const v = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)); return v >= 200 && v <= 400 ? v : 240; } catch { return 240; }
  });
  const [chatWidth, setChatWidth] = useState<number>(() => {
    try { const v = Number(localStorage.getItem(CHAT_WIDTH_KEY)); return v >= 320 && v <= 440 ? v : 360; } catch { return 360; }
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'; } catch { return false; }
  });
  const [isMobileChat, setIsMobileChat] = useState<boolean>(() => {
    try { return typeof window !== 'undefined' ? window.matchMedia('(max-width: 860px)').matches : false; } catch { return false; }
  });

  // Tour state is observed for team-context forcing only. The sidebar is
  // always visible on desktop, so the tour runs without any force-open lock.
  const tourActive = useSyncExternalStore(subscribeTour, isTourActive, () => false);
  const tourStep = useSyncExternalStore(subscribeTour, readTourStep, () => 0);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useFocusTrap<HTMLDivElement>(navOpen);
  const location = useLocation();
  const { t } = useTranslation('shell');
  const { teams, invitations } = useTeams();
  const { projects } = useProjects();
  const { user } = useAuth();

  // Team context derived from the route (the rail selection state is gone).
  // Slug workspace routes (/:slug/projects|members|settings) resolve via the
  // teams list by slug; unknown slugs stay null so the page can 404/redirect.
  const derivedTeamId = useMemo(() => {
    if (location.pathname.startsWith('/team/')) {
      return location.pathname.split('/')[2] ?? null;
    }
    if (location.pathname.startsWith('/project/')) {
      const pid = location.pathname.split('/')[2];
      const proj = (projects ?? []).find((p) => p.id === pid);
      return proj?.teamId ?? null;
    }
    const segs = location.pathname.split('/').filter(Boolean);
    if (segs.length >= 1 && segs.length <= 2) {
      const first = segs[0] ?? '';
      const second = segs[1] ?? '';
      const isWorkspaceSuffix = second === '' || second === 'projects' || second === 'members' || second === 'settings';
      const staticFirst = new Set([
        'invites',
        'connected',
        'keys',
        'templates',
        'profile',
        'docs',
        'pricing',
        'payments',
        'reset-password',
        'privacy',
        'terms',
        '404',
        'p',
        'billing',
        'project',
        'team',
      ]);
      if (!staticFirst.has(first) && (segs.length === 2 ? isWorkspaceSuffix : true)) {
        const found = (teams ?? []).find(
          (tm) => (tm.slug || tm.id).toLowerCase() === first.toLowerCase(),
        );
        if (found) return found.id;
        // Unknown slug: let the workspace page handle history/404.
        if (segs.length === 2 && isWorkspaceSuffix) return null;
      }
    }
    return null;
  }, [location.pathname, projects, teams]);

  // Single-mode team-first sidebar (Opsi A): there is no Home/All-Team
  // mode. The route resolves at most one context team (derivedTeamId);
  // every other route falls back to the last workspace so the L1 project
  // panel stays populated. Only zero teams resolve to null (onboarding).
  const activeTeamId = useMemo(() => {
    if (derivedTeamId) return derivedTeamId;
    if (!teams || teams.length === 0) return null;
    // No team in the route: restore the last workspace. A fresh session
    // (no key) or a stale id (deleted team, logout, shared browser) falls
    // back to the first team; zero teams stays null for onboarding.
    try {
      const last = localStorage.getItem(LAST_ACTIVE_TEAM_KEY);
      if (last && teams.some((tm) => tm.id === last)) return last;
    } catch {
      // Storage unavailable — fall through to the first team.
    }
    return teams[0]?.id ?? null;
  }, [derivedTeamId, teams]);

  // Zero-team: no sidebar chrome at all (desktop group + mobile drawer
  // hidden, minimal content-header). The onboarding card owns team creation.
  // Declared here (before any useEffect/render use) to avoid TDZ:
  // the keyboard-shortcut effect deps below evaluate on every render.
  const isZeroTeam = teams !== null && teams.length === 0;

  useEffect(() => { try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)); } catch {} }, [sidebarWidth]);
  useEffect(() => { try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed)); } catch {} }, [sidebarCollapsed]);
  useEffect(() => { try { localStorage.setItem(CHAT_WIDTH_KEY, String(chatWidth)); } catch {} }, [chatWidth]);

  // Remember the resolved team so the next session restores it. Only real
  // membership ids are stored (tour-forced ids bypass this via effectiveTeamId).
  useEffect(() => {
    if (!activeTeamId) return;
    if (!teams?.some((tm) => tm.id === activeTeamId)) return;
    writeLastActiveTeamId(activeTeamId);
  }, [activeTeamId, teams]);

  // chat open per-team persistence
  useEffect(() => {
    if (!activeTeamId) { setChatOpen(false); return; }
    try {
      const v = localStorage.getItem(CHAT_OPEN_PREFIX + activeTeamId);
      setChatOpen(v === 'true');
    } catch { setChatOpen(false); }
  }, [activeTeamId]);

  useEffect(() => {
    if (!activeTeamId) return;
    try { localStorage.setItem(CHAT_OPEN_PREFIX + activeTeamId, String(chatOpen)); } catch {}
  }, [chatOpen, activeTeamId]);

  // track mobile breakpoint for chat inline vs drawer
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 860px)');
    const onChange = () => setIsMobileChat(mql.matches);
    onChange();
    try { mql.addEventListener('change', onChange); return () => mql.removeEventListener('change', onChange); }
    catch {
      mql.addListener(onChange as any);
      return () => mql.removeListener(onChange as any);
    }
  }, []);

  // listen global toggleChat event (Ctrl+C) to control inline state on desktop
  useEffect(() => {
    const off = onToggleChat(() => setChatOpen((v) => !v));
    return off;
  }, []);

  // Mobile drawer auto-close on navigation — except when ENTERING a
  // settings view: the drawer must stay open on the settings submenu list
  // and only close after the user picks a section (SettingsNav onSelect).
  // Berlaku untuk team (/x/settings) maupun project (/project/:id?tab=settings).
  // Perubahan query biasa (sort/filter) tidak menyentuh drawer.
  const prevLocRef = useRef(location.pathname + location.search);
  useEffect(() => {
    const prev = prevLocRef.current;
    const cur = location.pathname + location.search;
    prevLocRef.current = cur;
    const prevPath = prev.split('?')[0] ?? '';
    if (location.pathname !== prevPath) {
      const enteringSettings =
        location.pathname.endsWith('/settings') && !prev.endsWith('/settings');
      if (enteringSettings) return;
      setNavOpen(false);
      return;
    }
    const wasProjectSettings = prev.includes('tab=settings');
    const isProjectSettings =
      location.pathname.startsWith('/project/') &&
      new URLSearchParams(location.search).get('tab') === 'settings';
    if (isProjectSettings && !wasProjectSettings) return;
    if (!isProjectSettings && wasProjectSettings) setNavOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!navOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [navOpen]);

  // keyboard: Esc closes drawer/chat/modal, Ctrl+C / ] toggles chat,
  // Ctrl/Cmd+B toggles the desktop sidebar rail.
  // Team chat shortcuts follow the selected team.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable));
      const isModal = Boolean(document.querySelector('.modal-backdrop, .palette'));
      if (e.key === 'Escape') {
        // Esc closes inline chat when open on desktop (not when modal/palette open)
        if (!isModal && chatOpen && !isMobileChat) {
          const isChatFocused = Boolean(document.querySelector('#chat-inline-shell:focus-within'));
          if (isChatFocused || !isTyping) {
            e.preventDefault();
            setChatOpen(false);
            return;
          }
        }
      }
      // Ctrl/Cmd+C toggles team chat — guard against typing, modal, and text selection (copy)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (isTyping || isModal) return;
        if (window.getSelection()?.toString()) return;
        if (!user || !activeTeamId) return;
        e.preventDefault();
        setChatOpen((v) => !v);
        return;
      }
      // ] toggles chat inline on desktop
      if (!isTyping && !isModal && !window.matchMedia('(max-width: 860px)').matches && e.key === ']' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!user || !activeTeamId) return;
        e.preventDefault();
        setChatOpen((v) => !v);
        return;
      }
      // Ctrl/Cmd+B toggles the desktop sidebar rail — desktop only, never
      // while typing or when a modal/palette owns the keyboard. No-op when
      // the sidebar is hidden (zero-team onboarding).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        if (isTyping || isModal) return;
        if (window.matchMedia('(max-width: 860px)').matches) return;
        if (isZeroTeam) return;
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [user, activeTeamId, chatOpen, isMobileChat, isZeroTeam]);

  const onHandlePointerDown = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const next = Math.min(360, Math.max(220, startW + dx));
      setSidebarWidth(next);
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onChatHandlePointerDown = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const startW = chatWidth;
    const onMove = (ev: PointerEvent) => {
      const dx = startX - ev.clientX; // dragging left increases width
      const next = Math.min(440, Math.max(320, startW + dx));
      setChatWidth(next);
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Tour step 2 (create project) forces the newest team's context so the
  // sidebar New project button always exists as an anchor — without
  // navigating or touching persisted selection.
  const tourTeamId = useMemo(() => {
    if (!(tourActive && tourStep === 2)) return null;
    return newestTeamId(teams);
  }, [tourActive, tourStep, teams]);
  const effectiveTeamId = tourTeamId ?? activeTeamId;

  // Team chat (button, panel, shortcuts) follows the selected team.

  const isChatInlineOpen = chatOpen && !isMobileChat;

  // Zero-team guard: team-scoped pages bounce to onboarding (or invites).
  // Pure decision in ./team-guard (unit-tested); loading renders normally.
  const teamGuard = resolveTeamlessRedirect({
    userPresent: !!user,
    teams,
    invitationCount: invitations.length,
    pathname: location.pathname,
  });
  if (teamGuard === 'toInvites') return <Navigate to="/invites" replace />;
  if (teamGuard === 'toHome') return <Navigate to="/" replace />;

  return (
    <div className="layout" data-chat-open={isChatInlineOpen ? 'true' : undefined} data-sidebar-collapsed={sidebarCollapsed ? 'true' : undefined} style={{ ['--sidebar-w' as any]: `${sidebarCollapsed ? 0 : sidebarWidth}px`, ['--chat-w' as any]: `${isChatInlineOpen ? chatWidth : 0}px` } as React.CSSProperties}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          const el = document.getElementById('main-content');
          if (el) {
            el.focus({ preventScroll: true });
            el.scrollIntoView({ block: 'start' });
          }
        }}
      >
        {t('layout.skipToContent')}
      </a>
      <button
        type="button"
        className={`nav-backdrop${navOpen ? ' nav-backdrop-open' : ''}`}
        onClick={() => setNavOpen(false)}
        aria-label={t('layout.closeNav')}
        tabIndex={navOpen ? 0 : -1}
      />
      {!isZeroTeam && (
        <div className="desktop-sidebar-group">
          <div className="sidebar-shell">
            <div id="sidebar-region" className="sidebar-region">
              <Sidebar activeTeamId={effectiveTeamId} onCreateTeam={() => setCreateTeamOpen(true)} />
            </div>
            <div className="sidebar-handle" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" onPointerDown={onHandlePointerDown} />
          </div>
        </div>
      )}
      {!isZeroTeam && (
        <div
          ref={drawerRef}
          id="mobile-nav-drawer"
          className={`sidebar-drawer${navOpen ? ' sidebar-open' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={t('sidebar.teamsNav')}
          aria-hidden={!navOpen ? true : undefined}
          inert={!navOpen ? true : undefined}
        >
          <div className="sidebar-drawer-inner">
            <Sidebar activeTeamId={activeTeamId} onCreateTeam={() => setCreateTeamOpen(true)} onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      )}
      <main className={`main${isZeroTeam ? ' main--onboarding' : ''}`} id="main-content" tabIndex={-1} inert={!isZeroTeam && navOpen ? true : undefined}>
        <div className={`content-header${isZeroTeam ? ' content-header--minimal' : ''}`}>
          {!isZeroTeam && (
            <button
              ref={hamburgerRef}
              type="button"
              className="topbar-btn topbar-sidebar-btn"
              onClick={() => {
                if (window.matchMedia('(max-width: 860px)').matches) setNavOpen((o) => !o);
                else setSidebarCollapsed((v) => !v);
              }}
              aria-label={sidebarCollapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar')}
              aria-expanded={!sidebarCollapsed}
              aria-controls="sidebar-region"
              title={sidebarCollapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar')}
            >
              <List size={18} weight="bold" aria-hidden="true" />
            </button>
          )}
          <div className="content-header-actions">
            <button
              type="button"
              className="topbar-btn"
              onClick={openPalette}
              aria-label={t('palette.open')}
            >
              <MagnifyingGlass size={18} aria-hidden="true" />
            </button>
            {user && activeTeamId ? (
              <TopbarChatButton teamId={activeTeamId} open={chatOpen} isMobile={isMobileChat} />
            ) : null}
          </div>
        </div>
        <Outlet />
      </main>
      {user && activeTeamId && (() => {
        const activeTeam = teams?.find((tm) => tm.id === activeTeamId);
        if (!activeTeam) return null;
        return (
          <ProjectChatWidget
            teamId={activeTeamId}
            teamName={activeTeam.name}
            open={chatOpen}
            onOpenChange={setChatOpen}
            width={chatWidth}
            onWidthChange={setChatWidth}
            onResizeHandlePointerDown={onChatHandlePointerDown}
            isMobile={isMobileChat}
          />
        );
      })()}
      <CreateTeamModal open={createTeamOpen} onClose={() => setCreateTeamOpen(false)} />
    </div>
  );
}
