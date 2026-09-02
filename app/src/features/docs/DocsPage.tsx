import { Lightning, Plugs, Keyboard, ArrowSquareOut } from '@phosphor-icons/react';
import { Link, useLocation } from 'react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DocsNav } from './DocsNav';
import { DocsToc, DocsTocMobile, type DocsTocItem } from './DocsToc';

const DOC_NAV_ITEMS: DocsTocItem[] = [
  { id: 'docs-overview', label: 'docs.toc.overview' },
  { id: 'quickstart', label: 'docs.toc.quickstart' },
  { id: 'docs-mcp', label: 'docs.toc.mcp' },
  { id: 'shortcuts', label: 'docs.toc.shortcuts' },
];

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], descKey: 'docs.shortcuts.palette' },
  { keys: ['Ctrl', 'C'], descKey: 'docs.shortcuts.toggleChat' },
  { keys: ['Ctrl', 'B'], descKey: 'docs.shortcuts.toggleSidebar' },
  { keys: ['↑', '↓'], descKey: 'docs.shortcuts.navigateResults' },
  { keys: ['Enter'], descKey: 'docs.shortcuts.runCommand' },
  { keys: ['Esc'], descKey: 'docs.shortcuts.escape' },
  { keys: ['Alt', '1-9', '0'], descKey: 'docs.shortcuts.switchTabAlt' },
  { keys: ['[', ']'], descKey: 'docs.shortcuts.switchTabBracket' },
  { keys: ['N'], descKey: 'docs.shortcuts.newItem' },
];

export function DocsPage() {
  const { t } = useTranslation('extras');
  const location = useLocation();

  void (import.meta.env.VITE_API_URL as string | undefined);

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace(/^#/, '');
    // Support both plain and docs- prefixed ids
    const el = document.getElementById(id) ?? document.getElementById(`docs-${id}`);
    if (el) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  }, [location.hash]);

  // Also handle direct /docs/quickstart route if ever added as path
  useEffect(() => {
    if (location.pathname === '/docs/quickstart') {
      const el = document.getElementById('quickstart') ?? document.getElementById('docs-quickstart');
      if (el) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      }
    }
  }, [location.pathname]);

  const mcpHref = '/docs/mcp';
  const quickstartHref = '/docs#quickstart';
  const shortcutsHref = '/docs#shortcuts';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('docs.page.title')}</h1>
          <p className="page-subtitle">{t('docs.page.subtitle')}</p>
        </div>
      </header>

      <div className="docs-grid">
        <div className="docs-main">
          <DocsTocMobile items={DOC_NAV_ITEMS.map((item) => ({ ...item, label: t(item.label) }))} />
          <DocsNav />

          <div className="docs-body">
            <section id="docs-overview" className="docs-section" tabIndex={-1}>
              <h2 className="docs-section-title">{t('docs.section.overview')}</h2>
              <p className="docs-step-desc">
                {t('docs.overview.body1')} <code className="inline-code">/p/:projectId</code> {t('docs.overview.body2')}
              </p>
            </section>

            <section className="docs-hub" aria-labelledby="docs-hub-title">
              <h2 id="docs-hub-title" className="docs-section-title">
                {t('docs.hub.title')}
              </h2>
              <div className="docs-hub-grid">
                <Link
                  to={quickstartHref}
                  className="docs-card"
                  aria-label={`${t('docs.hub.quickstartTitle')} — ${t('docs.hub.quickstartSub')}`}
                >
                  <Lightning size={18} weight="duotone" aria-hidden="true" />
                  <span className="docs-card-text">
                    <span className="docs-card-title">{t('docs.hub.quickstartTitle')}</span>
                    <span className="docs-card-sub">{t('docs.hub.quickstartSub')}</span>
                  </span>
                  <ArrowSquareOut size={14} className="docs-card-arrow" aria-hidden="true" />
                </Link>

                <Link
                  to={mcpHref}
                  className="docs-card"
                  aria-label={`${t('docs.hub.mcpTitle')} — ${t('docs.hub.mcpSub')}`}
                >
                  <Plugs size={18} weight="duotone" aria-hidden="true" />
                  <span className="docs-card-text">
                    <span className="docs-card-title">{t('docs.hub.mcpTitle')}</span>
                    <span className="docs-card-sub">{t('docs.hub.mcpSub')}</span>
                  </span>
                  <ArrowSquareOut size={14} className="docs-card-arrow" aria-hidden="true" />
                </Link>

                <Link
                  to={shortcutsHref}
                  className="docs-card"
                  aria-label={`${t('docs.hub.shortcutsTitle')} — ${t('docs.hub.shortcutsSub')}`}
                >
                  <Keyboard size={18} weight="duotone" aria-hidden="true" />
                  <span className="docs-card-text">
                    <span className="docs-card-title">{t('docs.hub.shortcutsTitle')}</span>
                    <span className="docs-card-sub">{t('docs.hub.shortcutsSub')}</span>
                  </span>
                  <ArrowSquareOut size={14} className="docs-card-arrow" aria-hidden="true" />
                </Link>
              </div>
            </section>

            <section id="quickstart" className="docs-section" tabIndex={-1}>
              <h2 className="docs-section-title">{t('docs.quickstart.title')}</h2>
              <p className="docs-step-desc">{t('docs.quickstart.subtitle')}</p>

              <ol className="docs-quickstart-steps">
                <li className="docs-quickstart-step">
                  <span className="docs-step-num" aria-hidden="true">
                    01
                  </span>
                  <div className="docs-step-content">
                    <h3 className="docs-step-title">{t('docs.quickstart.step1Title')}</h3>
                    <p className="docs-step-desc">{t('docs.quickstart.step1Desc')}</p>
                    <Link to="/connected" className="btn btn-secondary btn-sm">
                      {t('docs.quickstart.goToKeys')}
                    </Link>
                  </div>
                </li>
                <li className="docs-quickstart-step">
                  <span className="docs-step-num" aria-hidden="true">
                    02
                  </span>
                  <div className="docs-step-content">
                    <h3 className="docs-step-title">{t('docs.quickstart.step2Title')}</h3>
                    <p className="docs-step-desc">{t('docs.quickstart.step2Desc')}</p>
                  </div>
                </li>
                <li className="docs-quickstart-step">
                  <span className="docs-step-num" aria-hidden="true">
                    03
                  </span>
                  <div className="docs-step-content">
                    <h3 className="docs-step-title">{t('docs.quickstart.step3Title')}</h3>
                    <p className="docs-step-desc">{t('docs.quickstart.step3Desc')}</p>
                  </div>
                </li>
              </ol>

              <div className="docs-callout" role="note">
                <span className="docs-prereq-check" aria-hidden="true">
                  ✓
                </span>
                <div className="docs-callout-body">
                  <strong>{t('docs.quickstart.verifyTitle')}: </strong>
                  {t('docs.quickstart.verifyDesc')}
                </div>
              </div>
              <p className="docs-step-note">
                <Link to="/docs/mcp" className="keys-guide-link">
                  {t('docs.quickstart.goToMcp')} →
                </Link>
              </p>
            </section>

            <section id="docs-mcp" className="docs-section" tabIndex={-1}>
              <h2 className="docs-section-title">{t('docs.section.mcp')}</h2>
              <p className="docs-step-desc">{t('docs.mcp.intro')}</p>
              <Link to="/docs/mcp" className="docs-card" aria-label={`${t('docs.mcp.setupGuide')} — ${t('docs.mcp.setupGuideSub')}`}>
                <Plugs size={18} weight="duotone" aria-hidden="true" />
                <span className="docs-card-text">
                  <span className="docs-card-title">{t('docs.mcp.setupGuide')}</span>
                  <span className="docs-card-sub">{t('docs.mcp.setupGuideSub')}</span>
                </span>
                <ArrowSquareOut size={14} className="docs-card-arrow" aria-hidden="true" />
              </Link>
            </section>

            <section id="shortcuts" className="docs-section" tabIndex={-1}>
              <h2 className="docs-section-title">{t('docs.section.shortcuts')}</h2>
              <p className="docs-step-desc">{t('docs.shortcuts.intro')}</p>
              <ul className="docs-keys">
                {SHORTCUTS.map((s) => (
                  <li key={s.descKey} className="docs-key-row">
                    <span className="docs-key-combo">
                      {s.keys.map((k) => (
                        <kbd key={k} className="docs-kbd">
                          {k}
                        </kbd>
                      ))}
                    </span>
                    <span className="docs-key-desc">{t(s.descKey)}</span>
                  </li>
                ))}
              </ul>
              <p className="docs-step-note">
                {t('docs.shortcuts.tip1')} <kbd className="docs-kbd">Ctrl</kbd> <kbd className="docs-kbd">K</kbd> {t('docs.shortcuts.tip2')}
              </p>
            </section>
          </div>
        </div>
        <DocsToc items={DOC_NAV_ITEMS.map((item) => ({ ...item, label: t(item.label) }))} />
      </div>
    </div>
  );
}

