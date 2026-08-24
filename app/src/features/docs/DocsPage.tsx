import { BookOpen, ArrowSquareOut } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { DocsNav } from './DocsNav';
import { DocsToc, DocsTocMobile, type DocsTocItem } from './DocsToc';

const DOC_NAV_ITEMS: DocsTocItem[] = [
  { id: 'docs-overview', label: 'docs.toc.overview' },
  { id: 'docs-mcp', label: 'docs.toc.mcp' },
  { id: 'docs-api', label: 'docs.toc.api' },
  { id: 'docs-shortcuts', label: 'docs.toc.shortcuts' },
];

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], descKey: 'docs.shortcuts.palette' },
  { keys: ['?'], descKey: 'docs.shortcuts.paletteWhenClosed' },
  { keys: ['/'], descKey: 'docs.shortcuts.slash' },
  { keys: ['↑', '↓'], descKey: 'docs.shortcuts.navigateResults' },
  { keys: ['Enter'], descKey: 'docs.shortcuts.runCommand' },
  { keys: ['Esc'], descKey: 'docs.shortcuts.escape' },
  { keys: ['Alt', '1-9', '0'], descKey: 'docs.shortcuts.switchTabAlt' },
  { keys: ['[', ']'], descKey: 'docs.shortcuts.switchTabBracket' },
  { keys: ['N'], descKey: 'docs.shortcuts.newItem' },
];

export function DocsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('extras');

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
            <section id="docs-overview" className="docs-section">
              <h2 className="docs-section-title">{t('docs.section.overview')}</h2>
              <p className="docs-step-desc">
                {t('docs.overview.body1')} <code className="inline-code">/p/:projectId</code>{' '}
                {t('docs.overview.body2')}
              </p>
            </section>

            <section id="docs-mcp" className="docs-section">
              <h2 className="docs-section-title">{t('docs.section.mcp')}</h2>
              <p className="docs-step-desc">
                {t('docs.mcp.intro')}
              </p>
              <button type="button" className="docs-card" onClick={() => navigate('/docs/mcp')}>
                <BookOpen size={18} weight="duotone" aria-hidden="true" />
                <span className="docs-card-text">
                  <span className="docs-card-title">{t('docs.mcp.setupGuide')}</span>
                  <span className="docs-card-sub">{t('docs.mcp.setupGuideSub')}</span>
                </span>
                <ArrowSquareOut size={14} className="docs-card-arrow" aria-hidden="true" />
              </button>
            </section>

            <section id="docs-shortcuts" className="docs-section">
              <h2 className="docs-section-title">{t('docs.section.shortcuts')}</h2>
              <p className="docs-step-desc">
                {t('docs.shortcuts.intro')}
              </p>
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
                {t('docs.shortcuts.tip1')} <kbd className="docs-kbd">Ctrl</kbd>{' '}
                <kbd className="docs-kbd">K</kbd> {t('docs.shortcuts.tip2')}{' '}
                <kbd className="docs-kbd">?</kbd> {t('docs.shortcuts.tip3')}
              </p>
            </section>
          </div>
        </div>
        <DocsToc items={DOC_NAV_ITEMS.map((item) => ({ ...item, label: t(item.label) }))} />
      </div>
    </div>
  );
}
