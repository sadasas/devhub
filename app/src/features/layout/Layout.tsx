import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { List, MagnifyingGlass } from '@phosphor-icons/react';
import { Sidebar } from './Sidebar';
import { TeamRail } from './TeamRail';
import { Logo } from '../../components/Logo';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { openPalette } from '../../lib/palette-events';
import { useTeams } from '../../state/teams-context';
import { useProjects } from '../../state/projects-context';
import { useAuth } from '../../state/auth-context';
import { CreateTeamModal } from '../teams/CreateTeamModal';
import { ProjectChatWidget } from '../project/ProjectChatWidget';

const RAIL_ACTIVE_KEY = 'devhub:rail:activeTeam';
const SIDEBAR_COLLAPSED_KEY = 'devhub:layout:sidebarCollapsed';
const SIDEBAR_WIDTH_KEY = 'devhub:layout:sidebarWidth';
const RAIL_MAIN_KEY = 'devhub:rail:activeMain';

export function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'; } catch { return false; }
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try { const v = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)); return v >= 200 && v <= 400 ? v : 240; } catch { return 240; }
  });
  const [liveMsg, setLiveMsg] = useState('');
  const [hoverExpand, setHoverExpand] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('shell');
  const { teams } = useTeams();
  const { projects } = useProjects();
  const { user } = useAuth();

  const effectiveCollapsed = collapsed && !hoverExpand;

  const [railTeamId, setRailTeamId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(RAIL_ACTIVE_KEY);
    } catch {
      return null;
    }
  });

  const [activeMain, setActiveMain] = useState<'home' | 'team'>(() => {
    try {
      const v = localStorage.getItem(RAIL_MAIN_KEY);
      return v === 'team' || v === 'home' ? v : 'home';
    } catch {
      return 'home';
    }
  });

  const derivedFromRoute = useMemo(() => {
    if (location.pathname.startsWith('/team/')) {
      return location.pathname.split('/')[2] ?? null;
    }
    if (location.pathname.startsWith('/project/')) {
      const pid = location.pathname.split('/')[2];
      const proj = (projects ?? []).find((p) => p.id === pid);
      return proj?.teamId ?? null;
    }
    return null;
  }, [location.pathname, projects]);

  const derivedMainFromRoute = useMemo<'home' | 'team' | null>(() => {
    if (location.pathname.startsWith('/team/') || location.pathname.startsWith('/project/')) return 'team';
    if (location.pathname === '/' || location.pathname.startsWith('/invites') || location.pathname.startsWith('/pricing') || location.pathname.startsWith('/payments') || location.pathname.startsWith('/keys') || location.pathname.startsWith('/templates') || location.pathname.startsWith('/docs') || location.pathname.startsWith('/admin')) return 'home';
    return null;
  }, [location.pathname]);

  useEffect(() => {
    if (derivedFromRoute) {
      setRailTeamId(derivedFromRoute);
      setActiveMain('team');
    }
  }, [derivedFromRoute]);

  useEffect(() => {
    if (derivedMainFromRoute) {
      setActiveMain(derivedMainFromRoute);
    }
  }, [derivedMainFromRoute]);

  useEffect(() => {
    if (railTeamId) {
      try {
        localStorage.setItem(RAIL_ACTIVE_KEY, railTeamId);
      } catch {}
    }
  }, [railTeamId]);

  useEffect(() => {
    try {
      localStorage.setItem(RAIL_MAIN_KEY, activeMain);
    } catch {}
  }, [activeMain]);

  useEffect(() => { try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed)); } catch {} setLiveMsg(collapsed ? 'Sidebar collapsed' : 'Sidebar expanded'); }, [collapsed]);

  useEffect(() => { try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)); } catch {} }, [sidebarWidth]);

  const activeTeamId = useMemo(() => {
    if (derivedFromRoute) return derivedFromRoute;
    if (railTeamId && teams?.some((tm) => tm.id === railTeamId)) return railTeamId;
    return teams?.[0]?.id ?? null;
  }, [derivedFromRoute, railTeamId, teams]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

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

  const handleToggleCollapsed = () => { if (window.matchMedia('(max-width: 860px)').matches) return; setHoverExpand(false); setCollapsed(v => !v); };

  const handleHoverEnter = () => {
    if (window.matchMedia('(max-width: 860px)').matches) return;
    if (!collapsed) return;
    if (window.matchMedia('(hover: none)').matches) return;
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    setHoverExpand(true);
  };
  const handleHoverLeave = () => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => setHoverExpand(false), 140) as unknown as number;
  };

  useEffect(() => {
    return () => { if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current); };
  }, []);

  useEffect(() => {
    if (!collapsed) setHoverExpand(false);
  }, [collapsed]);

  // keyboard Ctrl+B or [ to toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const isB = e.key.toLowerCase() === 'b';
      const isBracket = e.key === '[';
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isTyping) return;
      if (window.matchMedia('(max-width: 860px)').matches) return;
      if ((mod && isB) || (!mod && isBracket)) { e.preventDefault(); setCollapsed(v => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onHandlePointerDown = (e: React.PointerEvent) => {
    if (effectiveCollapsed) return;
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const next = Math.min(360, Math.max(220, startW + dx));
      if (next < 140) setCollapsed(true); else setSidebarWidth(next);
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleSelectTeam = (teamId: string) => {
    setRailTeamId(teamId);
    setActiveMain('team');
    setNavOpen(false);
    navigate(`/team/${teamId}`);
  };

  const handleSelectHome = () => {
    setActiveMain('home');
    setNavOpen(false);
    navigate('/');
  };

  return (
    <div className="layout" data-collapsed={collapsed ? 'true' : undefined} data-hover-expand={hoverExpand ? 'true' : undefined} style={{ ['--sidebar-w' as any]: `${sidebarWidth}px` } as React.CSSProperties}>
      <a className="skip-link" href="#main-content">
        {t('layout.skipToContent')}
      </a>
      <div className="app-prefs" aria-label="Preferences">
        <ThemeSwitcher triggerClassName="app-lang-btn" />
        <LanguageSwitcher triggerClassName="app-lang-btn" />
      </div>
      <header className="topbar">
        <button
          type="button"
          className="topbar-btn"
          onClick={() => setNavOpen((o) => !o)}
          aria-label={navOpen ? t('layout.closeNav') : t('layout.openNav')}
          aria-expanded={navOpen}
        >
          <List size={18} weight="bold" aria-hidden="true" />
        </button>
        <span className="topbar-brand">
          <Logo size={16} />
          <span>DevHub</span>
        </span>
        <ThemeSwitcher triggerClassName="topbar-btn" />
        <LanguageSwitcher triggerClassName="topbar-btn" />
        <button
          type="button"
          className="topbar-btn"
          onClick={openPalette}
          aria-label={t('palette.open')}
        >
          <MagnifyingGlass size={18} aria-hidden="true" />
        </button>
      </header>
      <button
        type="button"
        className={`nav-backdrop${navOpen ? ' nav-backdrop-open' : ''}`}
        onClick={() => setNavOpen(false)}
        aria-label={t('layout.closeNav')}
        tabIndex={navOpen ? 0 : -1}
      />
      <div className="team-rail-desktop" aria-hidden="true" onMouseEnter={handleHoverEnter} onMouseLeave={handleHoverLeave} onFocusCapture={handleHoverEnter} onBlurCapture={handleHoverLeave}>
        <TeamRail
          teams={teams}
          activeTeamId={activeTeamId}
          activeMain={activeMain}
          compact={effectiveCollapsed}
          collapsed={collapsed}
          onToggleCollapsed={handleToggleCollapsed}
          onSelectTeam={handleSelectTeam}
          onSelectHome={handleSelectHome}
          onCreateTeam={() => setCreateTeamOpen(true)}
        />
      </div>
      <div className={`sidebar-drawer${navOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-drawer-inner">
          <div className="team-rail-mobile">
            <TeamRail
              teams={teams}
              activeTeamId={activeTeamId}
              activeMain={activeMain}
              onSelectTeam={handleSelectTeam}
              onSelectHome={handleSelectHome}
              onCreateTeam={() => setCreateTeamOpen(true)}
            />
          </div>
          <Sidebar activeTeamId={activeTeamId} activeMain={activeMain} onCreateTeam={() => setCreateTeamOpen(true)} />
        </div>
      </div>
      <div className="sidebar-shell" style={{ width: collapsed ? 0 : undefined }} aria-hidden={effectiveCollapsed} onMouseEnter={handleHoverEnter} onMouseLeave={handleHoverLeave} onFocusCapture={handleHoverEnter} onBlurCapture={handleHoverLeave}>
        <div id="sidebar-region" className="sidebar-region" inert={effectiveCollapsed ? '' as any : undefined} aria-hidden={effectiveCollapsed}>
          <Sidebar activeTeamId={activeTeamId} activeMain={activeMain} onCreateTeam={() => setCreateTeamOpen(true)} />
        </div>
        {!collapsed && <div className="sidebar-handle" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" onPointerDown={onHandlePointerDown} onDoubleClick={handleToggleCollapsed} />}
      </div>
      <main className="main" id="main-content">
        <Outlet />
      </main>
      <div aria-live="polite" className="sr-only">{liveMsg}</div>
      <CreateTeamModal open={createTeamOpen} onClose={() => setCreateTeamOpen(false)} />
      {user && activeTeamId && (() => {
        const activeTeam = teams?.find((tm) => tm.id === activeTeamId);
        if (!activeTeam) return null;
        const isChatRoute = location.pathname.startsWith('/team/') && new URLSearchParams(location.search).get('tab') === 'chat';
        if (isChatRoute) return null;
        return <ProjectChatWidget teamId={activeTeamId} teamName={activeTeam.name} />;
      })()}
    </div>
  );
}
