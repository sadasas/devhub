import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { List, MagnifyingGlass } from '@phosphor-icons/react';
import { Sidebar } from './Sidebar';
import { Logo } from '../../components/Logo';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { openPalette } from '../../lib/palette-events';

export function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const { t } = useTranslation('shell');

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
      <div className={`sidebar-drawer${navOpen ? ' sidebar-open' : ''}`}>
        <Sidebar />
      </div>
      <main className="main" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}