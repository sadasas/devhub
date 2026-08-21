import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { List, MagnifyingGlass } from '@phosphor-icons/react';
import { Sidebar } from './Sidebar';
import { Logo } from '../../components/Logo';
import { openPalette } from '../../lib/palette-events';

export function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

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

  return (
    <div className="layout">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <button
          type="button"
          className="topbar-btn"
          onClick={() => setNavOpen((o) => !o)}
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={navOpen}
        >
          <List size={18} weight="bold" aria-hidden="true" />
        </button>
        <span className="topbar-brand">
          <Logo size={16} />
          <span>DevHub</span>
        </span>
        <button
          type="button"
          className="topbar-btn"
          onClick={openPalette}
          aria-label="Open command palette"
        >
          <MagnifyingGlass size={18} aria-hidden="true" />
        </button>
      </header>
      <button
        type="button"
        className={`nav-backdrop${navOpen ? ' nav-backdrop-open' : ''}`}
        onClick={() => setNavOpen(false)}
        aria-label="Close navigation"
        tabIndex={navOpen ? 0 : -1}
      />
      <div className={`sidebar-drawer${navOpen ? ' sidebar-open' : ''}`}>
        <Sidebar />
      </div>
      <main className="main" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}