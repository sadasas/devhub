import { BookOpen, ArrowSquareOut } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { DocsNav } from './DocsNav';
import { DocsToc } from './DocsToc';

const DOC_NAV_ITEMS = [
  { id: 'docs-overview', label: 'Overview' },
  { id: 'docs-mcp', label: 'MCP Integration' },
  { id: 'docs-api', label: 'API Reference' },
  { id: 'docs-shortcuts', label: 'Keyboard Shortcuts' },
];

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], desc: 'Open or close the command palette' },
  { keys: ['?'], desc: 'Open the command palette (when it is closed)' },
  { keys: ['↑', '↓'], desc: 'Move through palette results' },
  { keys: ['Enter'], desc: 'Run the selected palette command' },
  { keys: ['Esc'], desc: 'Close the palette or the active modal' },
  { keys: ['N'], desc: 'Create a new task on the board (edit access required, not while typing)' },
];

export function DocsPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Docs</h1>
          <p className="page-subtitle">Everything you need to run DevHub, from integrations to the API.</p>
        </div>
      </header>

      <div className="docs-grid">
        <div className="docs-main">
          <DocsNav />
          <div className="docs-body">
            <section id="docs-overview" className="docs-section">
              <h2 className="docs-section-title">Overview</h2>
              <p className="docs-step-desc">
                DevHub is a self-hosted project management tool built for solo developers. It keeps your
                tasks, issues, decisions, and schema in one place, and lets AI coding agents read and
                update projects through MCP or the REST API. Projects can also be shared publicly as a
                read-only view at <code className="inline-code">/p/:projectId</code> — no login required.
              </p>
            </section>

            <section id="docs-mcp" className="docs-section">
              <h2 className="docs-section-title">MCP Integration</h2>
              <p className="docs-step-desc">
                Connect opencode and other AI agents to your DevHub server so they can create tasks, file
                issues, and track decisions directly from your editor.
              </p>
              <button type="button" className="docs-card" onClick={() => navigate('/docs/mcp')}>
                <BookOpen size={18} weight="duotone" aria-hidden="true" />
                <span className="docs-card-text">
                  <span className="docs-card-title">Setup guide</span>
                  <span className="docs-card-sub">Create a key, configure opencode, and verify the connection</span>
                </span>
                <ArrowSquareOut size={14} className="docs-card-arrow" aria-hidden="true" />
              </button>
            </section>

            <section id="docs-api" className="docs-section">
              <h2 className="docs-section-title">API Reference</h2>
              <p className="docs-step-desc">
                Every REST endpoint DevHub exposes, grouped by resource: auth, API keys, projects, teams,
                and the MCP transport.
              </p>
              <button type="button" className="docs-card" onClick={() => navigate('/docs/api')}>
                <ArrowSquareOut size={18} weight="duotone" aria-hidden="true" />
                <span className="docs-card-text">
                  <span className="docs-card-title">Browse endpoints</span>
                  <span className="docs-card-sub">Methods, auth requirements, and payload notes</span>
                </span>
                <ArrowSquareOut size={14} className="docs-card-arrow" aria-hidden="true" />
              </button>
            </section>

            <section id="docs-shortcuts" className="docs-section">
              <h2 className="docs-section-title">Keyboard Shortcuts</h2>
              <p className="docs-step-desc">
                DevHub is built to stay on the keyboard. Shortcuts are ignored while you are typing in an
                input or textarea, so they never fight your text.
              </p>
              <ul className="docs-keys">
                {SHORTCUTS.map((s) => (
                  <li key={s.desc} className="docs-key-row">
                    <span className="docs-key-combo">
                      {s.keys.map((k) => (
                        <kbd key={k} className="docs-kbd">
                          {k}
                        </kbd>
                      ))}
                    </span>
                    <span className="docs-key-desc">{s.desc}</span>
                  </li>
                ))}
              </ul>
              <p className="docs-step-note">
                Tip: press <kbd className="docs-kbd">Ctrl</kbd> <kbd className="docs-kbd">K</kbd> anywhere
                to search commands and projects, or press <kbd className="docs-kbd">?</kbd> to open the
                palette.
              </p>
            </section>
          </div>
        </div>
        <DocsToc items={DOC_NAV_ITEMS} />
      </div>
    </div>
  );
}