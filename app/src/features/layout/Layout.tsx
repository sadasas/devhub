import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { List, MagnifyingGlass } from '@phosphor-icons/react';
import { Sidebar } from './Sidebar';
import { TeamRail } from './TeamRail';
import { Logo } from '../../components/Logo';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { openPalette } from '../../lib/palette-events';
import { useTeams } from '../../state/teams-context';
import { useProjects } from '../../state/projects-context';
import { CreateTeamModal } from '../teams/CreateTeamModal';

const RAIL_ACTIVE_KEY = 'devhub:rail:activeTeam';
const RAIL_MAIN_KEY = 'devhub:rail:activeMain';

export function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('shell');
  const { teams } = useTeams();
  const { projects } = useProjects();

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
    <div className="layout">
      <a className="skip-link" href="#main-content">
        {t('layout.skipToContent')}
      </a>
      <div className="app-lang" aria-label="Language">
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
      <div className="team-rail-desktop" aria-hidden="true">
        <TeamRail
          teams={teams}
          activeTeamId={activeTeamId}
          activeMain={activeMain}
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
      <main className="main" id="main-content">
        <Outlet />
      </main>
      <CreateTeamModal open={createTeamOpen} onClose={() => setCreateTeamOpen(false)} />
    </div>
  );
}
