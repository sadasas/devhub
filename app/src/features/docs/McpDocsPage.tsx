import { Check, Copy, Key, ArrowSquareOut } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { Button } from '../../components/Button';
import { DocsNav } from './DocsNav';
import { DocsToc, type DocsTocItem } from './DocsToc';
import { Callout } from './Callout';

const ENV_EXAMPLE = '$env:DEVHUB_MCP_KEY = "devhub_your_key_here"';

const OPENCODE_CONFIG = `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "devhub": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer {env:DEVHUB_MCP_KEY}"
      }
    }
  }
}`;

const MCP_TOOLS = [
  'project_state',
  'update_prd',
  'plan_project',
  'create_task',
  'update_task',
  'add_issue',
  'update_issue',
  'add_decision',
  'update_milestone',
  'add_table',
  'add_relation',
  'delete_relation',
  'add_tech',
];

const TOC_ITEMS: DocsTocItem[] = [
  { id: 'mcp-prereq', label: 'Before you begin' },
  { id: 'mcp-key', label: 'Create an API key' },
  { id: 'mcp-project-id', label: 'Get your project ID' },
  { id: 'mcp-env', label: 'Set the env variable' },
  { id: 'mcp-config', label: 'Create opencode.json' },
  { id: 'mcp-restart', label: 'Restart opencode' },
  { id: 'mcp-verify', label: 'Verify the connection' },
  { id: 'mcp-troubleshooting', label: 'Troubleshooting' },
];

const PREREQS = [
  { strong: 'opencode is installed', desc: 'This guide uses opencode, but any MCP client works with the same server.' },
  { strong: 'The DevHub server is running', desc: 'Check /api/health returns ok before continuing.' },
  { strong: 'You are logged in', desc: 'API keys are per-user, so you need an active account.' },
];

function CodeBlock({ code, lang, file }: { code: string; lang: string; file?: string }) {
  const { copied, copy } = useCopyFeedback();

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-meta">
          <span className="code-block-badge">{lang}</span>
          {file && <span className="code-block-label">{file}</span>}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="code-block-copy"
          leftIcon={
            copied ? (
              <Check size={12} weight="bold" aria-hidden="true" />
            ) : (
              <Copy size={12} aria-hidden="true" />
            )
          }
          onClick={() => void copy(code)}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="code-block-body">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function McpDocsPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">MCP Integration</h1>
          <p className="page-subtitle">Connect AI coding agents to read and update your DevHub projects.</p>
        </div>
      </header>

      <div className="docs-grid">
        <div className="docs-main">
          <DocsNav />
          <div className="docs-body">
            <section id="mcp-prereq" className="docs-prereq">
              <h2 className="docs-section-title">Before you begin</h2>
              <ul className="docs-prereq-list">
                {PREREQS.map((p) => (
                  <li key={p.strong} className="docs-prereq-item">
                    <span className="docs-prereq-check" aria-hidden="true">
                      <Check size={12} weight="bold" />
                    </span>
                    <span>
                      <strong>{p.strong}</strong> — {p.desc}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section id="mcp-key" className="docs-step">
              <span className="docs-step-num">01</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">Create an API key</h2>
                <p className="docs-step-desc">
                  Keys are per-user and scoped to your own projects. The raw key is shown only once, so
                  save it right away.
                </p>
                <Button
                  leftIcon={<Key size={14} weight="bold" aria-hidden="true" />}
                  onClick={() => navigate('/keys')}
                >
                  Go to API Keys
                </Button>
              </div>
            </section>

            <section id="mcp-project-id" className="docs-step">
              <span className="docs-step-num">02</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">Get your project ID</h2>
                <p className="docs-step-desc">
                  Every tool takes a <code className="inline-code">projectId</code>. Open the project you
                  want the agent to manage — its ID is shown at the top of the page, next to the project
                  name, with a copy button.
                </p>
              </div>
            </section>

            <section id="mcp-env" className="docs-step">
              <span className="docs-step-num">03</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">Set the env variable</h2>
                <p className="docs-step-desc">opencode reads the key from your shell environment when it starts.</p>
                <CodeBlock lang="PowerShell" code={ENV_EXAMPLE} />
                <Callout>
                  Use <code className="inline-code">setx DEVHUB_MCP_KEY "devhub_…"</code> to make it
                  permanent.
                </Callout>
              </div>
            </section>

            <section id="mcp-config" className="docs-step">
              <span className="docs-step-num">04</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">Create opencode.json</h2>
                <p className="docs-step-desc">
                  Add the devhub server to your project config. An example ships with this repo at
                  opencode.example.json.
                </p>
                <CodeBlock lang="JSON" file="opencode.json" code={OPENCODE_CONFIG} />
                <Callout>
                  For production, point the url at your deployed server, e.g.
                  https://devhub.example.com/mcp.
                </Callout>
              </div>
            </section>

            <section id="mcp-restart" className="docs-step">
              <span className="docs-step-num">05</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">Restart opencode</h2>
                <p className="docs-step-desc">
                  Config is loaded once at startup and not hot-reloaded. Quit opencode and start it again,
                  then open a new session.
                </p>
              </div>
            </section>

            <section id="mcp-verify" className="docs-step">
              <span className="docs-step-num">06</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">Verify the connection</h2>
                <p className="docs-step-desc">
                  Run <code className="inline-code">/mcp</code> in opencode — devhub should be connected
                  with these tools:
                </p>
                <ul className="docs-chips">
                  {MCP_TOOLS.map((t) => (
                    <li key={t} className="docs-chip">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section id="mcp-troubleshooting" className="docs-troubleshooting">
              <h2 className="docs-section-title">Troubleshooting</h2>
              <div className="data-list">
                <div className="data-row">
                  <div className="data-row-main">
                    <div className="data-row-title">
                      <span className="row-title-text">401 on every call</span>
                    </div>
                    <div className="data-row-sub">
                      Wrong, expired, or revoked key. Create a new one in API Keys, update DEVHUB_MCP_KEY,
                      and restart opencode.
                    </div>
                  </div>
                </div>
                <div className="data-row">
                  <div className="data-row-main">
                    <div className="data-row-title">
                      <span className="row-title-text">Cannot connect</span>
                    </div>
                    <div className="data-row-sub">
                      The DevHub server is not running. Start it and check /api/health returns ok.
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="docs-next">
              <h2 className="docs-section-title">Next steps</h2>
              <div className="docs-next-grid">
                <button type="button" className="docs-card" onClick={() => navigate('/docs/api')}>
                  <ArrowSquareOut size={18} weight="duotone" aria-hidden="true" />
                  <span className="docs-card-text">
                    <span className="docs-card-title">API Reference</span>
                    <span className="docs-card-sub">Explore the REST endpoints behind the tools</span>
                  </span>
                  <ArrowSquareOut size={14} className="docs-card-arrow" aria-hidden="true" />
                </button>
                <button type="button" className="docs-card" onClick={() => navigate('/keys')}>
                  <Key size={18} weight="duotone" aria-hidden="true" />
                  <span className="docs-card-text">
                    <span className="docs-card-title">API Keys</span>
                    <span className="docs-card-sub">Create or revoke the keys your agents use</span>
                  </span>
                  <ArrowSquareOut size={14} className="docs-card-arrow" aria-hidden="true" />
                </button>
              </div>
            </section>
          </div>
        </div>
        <DocsToc items={TOC_ITEMS} />
      </div>
    </div>
  );
}