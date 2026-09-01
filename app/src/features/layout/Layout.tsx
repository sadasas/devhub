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
import { onToggleChat } from '../../lib/chat-events';
import { useTeams } from '../../state/teams-context';
import { useProjects } from '../../state/projects-context';
import { useAuth } from '../../state/auth-context';
import { CreateTeamModal } from '../teams/CreateTeamModal';
import { ProjectChatWidget } from '../project/ProjectChatWidget';
import { useTeamUnread } from '../../hooks/useTeamUnread';

const RAIL_ACTIVE_KEY = 'devhub:rail:activeTeam';
const SIDEBAR_COLLAPSED_KEY = 'devhub:layout:sidebarCollapsed';
const SIDEBAR_WIDTH_KEY = 'devhub:layout:sidebarWidth';
const RAIL_MAIN_KEY = 'devhub:rail:activeMain';
const CHAT_WIDTH_KEY = 'devhub:layout:chatWidth';
const CHAT_OPEN_PREFIX = 'devhub:layout:chatOpen:';

export function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      // default is collapsed true; if key missing => true (new behavior)
      if (v === null) return true;
      return v === 'true';
    } catch { return true; }
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try { const v = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)); return v >= 200 && v <= 400 ? v : 240; } catch { return 240; }
  });
  const [chatWidth, setChatWidth] = useState<number>(() => {
    try { const v = Number(localStorage.getItem(CHAT_WIDTH_KEY)); return v >= 320 && v <= 440 ? v : 360; } catch { return 360; }
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [isMobileChat, setIsMobileChat] = useState<boolean>(() => {
    try { return typeof window !== 'undefined' ? window.matchMedia('(max-width: 860px)').matches : false; } catch { return false; }
  });
  const [liveMsg, setLiveMsg] = useState('');
  // staged hover: railHover = main rail expanded, hoveredId = which item second shows
  const [isRailHovered, setIsRailHovered] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const railEnterTimeoutRef = useRef<number | null>(null);
  const railLeaveTimeoutRef = useRef<number | null>(null);
  const itemHoverTimeoutRef = useRef<number | null>(null);
  const hoverGroupLeaveRef = useRef<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('shell');
  const { teams } = useTeams();
  const { projects } = useProjects();
  const { user } = useAuth();
  const teamUnread = useTeamUnread(teams, projects);

  const isSecondVisible = useMemo(() => {
    if (!collapsed) return true; // pinned docked — always visible
    return isRailHovered && hoveredId !== null;
  }, [collapsed, isRailHovered, hoveredId]);

  // rail compact when collapsed and not hovered
  const railCompact = collapsed && !isRailHovered;

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
    if (location.pathname === '/' || location.pathname.startsWith('/invites') || location.pathname.startsWith('/pricing') || location.pathname.startsWith('/payments') || location.pathname.startsWith('/connected') || location.pathname.startsWith('/keys') || location.pathname.startsWith('/templates') || location.pathname.startsWith('/docs')) return 'home';
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
  useEffect(() => { try { localStorage.setItem(CHAT_WIDTH_KEY, String(chatWidth)); } catch {} }, [chatWidth]);

  const activeTeamId = useMemo(() => {
    if (derivedFromRoute) return derivedFromRoute;
    if (activeMain === 'home') return null;
    if (railTeamId && teams?.some((tm) => tm.id === railTeamId)) return railTeamId;
    return teams?.[0]?.id ?? null;
  }, [derivedFromRoute, railTeamId, teams, activeMain]);

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

  // auto-collapse sidebar on narrow desktop when chat opens to keep main >=560
  useEffect(() => {
    if (!chatOpen) return;
    if (isMobileChat) return;
    if (collapsed) return;
    try {
      if (window.innerWidth < 1280) setCollapsed(true);
    } catch {}
  }, [chatOpen, isMobileChat, collapsed]);

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

  const handleToggleCollapsed = () => {
    if (window.matchMedia('(max-width: 860px)').matches) return;
    // clear all hover timers when toggling pinned
    if (railEnterTimeoutRef.current) window.clearTimeout(railEnterTimeoutRef.current);
    if (railLeaveTimeoutRef.current) window.clearTimeout(railLeaveTimeoutRef.current);
    if (itemHoverTimeoutRef.current) window.clearTimeout(itemHoverTimeoutRef.current);
    if (hoverGroupLeaveRef.current) window.clearTimeout(hoverGroupLeaveRef.current);
    setIsRailHovered(false);
    setHoveredId(null);
    setCollapsed(v => !v);
  };

  const clearHoverTimers = () => {
    if (hoverGroupLeaveRef.current) { window.clearTimeout(hoverGroupLeaveRef.current); hoverGroupLeaveRef.current = null; }
    if (railLeaveTimeoutRef.current) { window.clearTimeout(railLeaveTimeoutRef.current); railLeaveTimeoutRef.current = null; }
    if (itemHoverTimeoutRef.current) { window.clearTimeout(itemHoverTimeoutRef.current); itemHoverTimeoutRef.current = null; }
  };

  const isReducedMotion = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  };

  const handleRailEnter = () => {
    if (window.matchMedia('(max-width: 860px)').matches) return;
    if (!collapsed) return;
    if (window.matchMedia('(hover: none)').matches) return;
    clearHoverTimers();
    if (railEnterTimeoutRef.current) window.clearTimeout(railEnterTimeoutRef.current);
    if (railLeaveTimeoutRef.current) window.clearTimeout(railLeaveTimeoutRef.current);
    if (isReducedMotion()) {
      setIsRailHovered(true);
      return;
    }
    // enter delay to filter mouse pass-through
    railEnterTimeoutRef.current = window.setTimeout(() => {
      setIsRailHovered(true);
    }, 150) as unknown as number;
  };

  const handleRailLeave = () => {
    if (railEnterTimeoutRef.current) { window.clearTimeout(railEnterTimeoutRef.current); railEnterTimeoutRef.current = null; }
    if (railLeaveTimeoutRef.current) window.clearTimeout(railLeaveTimeoutRef.current);
    if (isReducedMotion()) {
      setIsRailHovered(false);
      return;
    }
    railLeaveTimeoutRef.current = window.setTimeout(() => {
      setIsRailHovered(false);
    }, 300) as unknown as number;
  };

  const handleHoverItem = (id: string | null) => {
    if (window.matchMedia('(max-width: 860px)').matches) return;
    if (!collapsed) return;
    if (window.matchMedia('(hover: none)').matches) return;
    clearHoverTimers();
    if (itemHoverTimeoutRef.current) window.clearTimeout(itemHoverTimeoutRef.current);
    if (isReducedMotion()) {
      setIsRailHovered(!!id || isRailHovered);
      setHoveredId(id);
      return;
    }
    if (id === null) {
      // leave item but stay on rail -> keep rail expanded, hide second after delay
      // 250ms gives time to cross bridge to second (fixed overlay)
      itemHoverTimeoutRef.current = window.setTimeout(() => setHoveredId(null), 250) as unknown as number;
    } else {
      // enter item -> show second after small debounce to avoid flicker on fast move
      const delay = hoveredId ? 40 : 120;
      itemHoverTimeoutRef.current = window.setTimeout(() => {
        setIsRailHovered(true);
        setHoveredId(id);
      }, delay) as unknown as number;
    }
  };

  const handleHoverGroupEnter = () => {
    clearHoverTimers();
    // keep rail expanded while over second
    if (collapsed) setIsRailHovered(true);
  };

  const handleHoverGroupLeave = () => {
    if (hoverGroupLeaveRef.current) window.clearTimeout(hoverGroupLeaveRef.current);
    if (isReducedMotion()) {
      setIsRailHovered(false);
      setHoveredId(null);
      return;
    }
    hoverGroupLeaveRef.current = window.setTimeout(() => {
      setIsRailHovered(false);
      setHoveredId(null);
    }, 400) as unknown as number;
  };

  useEffect(() => {
    return () => {
      if (railEnterTimeoutRef.current) window.clearTimeout(railEnterTimeoutRef.current);
      if (railLeaveTimeoutRef.current) window.clearTimeout(railLeaveTimeoutRef.current);
      if (itemHoverTimeoutRef.current) window.clearTimeout(itemHoverTimeoutRef.current);
      if (hoverGroupLeaveRef.current) window.clearTimeout(hoverGroupLeaveRef.current);
    };
  }, []);

  useEffect(() => {
    if (!collapsed) {
      setIsRailHovered(false);
      setHoveredId(null);
    }
  }, [collapsed]);

  // keyboard Ctrl+B or [ to toggle, Ctrl+C / ] to toggle chat, Esc to dismiss flyout
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable));
      const isModal = Boolean(document.querySelector('.modal-backdrop, .palette'));
      // Esc dismisses staged flyout when collapsed OR closes chat inline
      if (e.key === 'Escape') {
        const isModalEsc = isModal;
        if (!isModalEsc && collapsed && (isRailHovered || hoveredId !== null)) {
          e.preventDefault();
          if (railEnterTimeoutRef.current) window.clearTimeout(railEnterTimeoutRef.current);
          if (railLeaveTimeoutRef.current) window.clearTimeout(railLeaveTimeoutRef.current);
          if (itemHoverTimeoutRef.current) window.clearTimeout(itemHoverTimeoutRef.current);
          if (hoverGroupLeaveRef.current) window.clearTimeout(hoverGroupLeaveRef.current);
          setIsRailHovered(false);
          setHoveredId(null);
          return;
        }
        // Esc closes inline chat when open on desktop (not when modal/palette open)
        if (!isModalEsc && chatOpen && !isMobileChat) {
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
      // ] toggles chat inline on desktop (mirror [ for sidebar)
      if (!isTyping && !isModal && !window.matchMedia('(max-width: 860px)').matches && e.key === ']' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!user || !activeTeamId) return;
        e.preventDefault();
        setChatOpen((v) => !v);
        return;
      }
      if (isTyping) return;
      if (window.matchMedia('(max-width: 860px)').matches) return;
      const mod = e.ctrlKey || e.metaKey;
      const isB = e.key.toLowerCase() === 'b';
      const isBracket = e.key === '[';
      if ((mod && isB) || (!mod && isBracket)) { e.preventDefault(); setCollapsed(v => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [user, activeTeamId, collapsed, isRailHovered, hoveredId, chatOpen, isMobileChat]);

  const onHandlePointerDown = (e: React.PointerEvent) => {
    if (collapsed) return;
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

  // derived sidebar context for staged hover
  const sidebarTeamId = useMemo(() => {
    if (!collapsed) return activeTeamId;
    if (hoveredId === 'home') return null;
    if (hoveredId) return hoveredId;
    return activeTeamId;
  }, [collapsed, hoveredId, activeTeamId]);
  const sidebarMain: 'home' | 'team' = useMemo(() => {
    if (!collapsed) return activeMain;
    if (hoveredId === 'home') return 'home';
    if (hoveredId) return 'team';
    return activeMain;
  }, [collapsed, hoveredId, activeMain]);

  const isChatInlineOpen = chatOpen && !isMobileChat;
  return (
    <div className="layout" data-collapsed={collapsed ? 'true' : undefined} data-rail-hover={isRailHovered ? 'true' : undefined} data-second-visible={isSecondVisible ? 'true' : undefined} data-hover-expand={isRailHovered ? 'true' : undefined} data-chat-open={isChatInlineOpen ? 'true' : undefined} style={{ ['--sidebar-w' as any]: `${sidebarWidth}px`, ['--chat-w' as any]: `${isChatInlineOpen ? chatWidth : 0}px` } as React.CSSProperties}>
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
      <div className="desktop-sidebar-group" onPointerEnter={handleHoverGroupEnter} onPointerLeave={handleHoverGroupLeave}>
        <div className="team-rail-desktop" aria-hidden="false" onPointerEnter={handleRailEnter} onPointerLeave={handleRailLeave} onFocusCapture={handleRailEnter} onBlurCapture={handleHoverGroupLeave}>
          <TeamRail
            teams={teams}
            activeTeamId={activeTeamId}
            activeMain={activeMain}
            compact={railCompact}
            collapsed={collapsed}
            unreadByTeam={teamUnread}
            onToggleCollapsed={handleToggleCollapsed}
            onSelectTeam={handleSelectTeam}
            onSelectHome={handleSelectHome}
            onCreateTeam={() => setCreateTeamOpen(true)}
            onHoverItem={handleHoverItem}
            hoveredId={hoveredId}
          />
        </div>
        <div className="sidebar-shell" data-visible={isSecondVisible ? 'true' : 'false'} aria-hidden={collapsed && !isSecondVisible} onPointerEnter={handleHoverGroupEnter} onPointerLeave={handleHoverGroupLeave}>
          <div id="sidebar-region" className="sidebar-region" inert={collapsed && !isSecondVisible ? '' as any : undefined} aria-hidden={collapsed && !isSecondVisible}>
            <Sidebar activeTeamId={sidebarTeamId} activeMain={sidebarMain} onCreateTeam={() => setCreateTeamOpen(true)} />
          </div>
          {!collapsed && <div className="sidebar-handle" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" onPointerDown={onHandlePointerDown} onDoubleClick={handleToggleCollapsed} />}
        </div>
      </div>
      <div className={`sidebar-drawer${navOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-drawer-inner">
          <div className="team-rail-mobile">
            <TeamRail
              teams={teams}
              activeTeamId={activeTeamId}
              activeMain={activeMain}
              unreadByTeam={teamUnread}
              onSelectTeam={handleSelectTeam}
              onSelectHome={handleSelectHome}
              onCreateTeam={() => setCreateTeamOpen(true)}
            />
          </div>
          <Sidebar activeTeamId={activeTeamId} activeMain={activeMain} onCreateTeam={() => setCreateTeamOpen(true)} />
        </div>
      </div>
      <main className="main" id="main-content">
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
      <div aria-live="polite" className="sr-only">{liveMsg}</div>
      <CreateTeamModal open={createTeamOpen} onClose={() => setCreateTeamOpen(false)} />
    </div>
  );
}

