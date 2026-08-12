import { Check, Copy, Key } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { Button } from '../../components/Button';

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

function CodeBlock({ label, code }: { label: string; code: string }) {
  const { copied, copy } = useCopyFeedback();

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-label">{label}</span>
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

      <div className="docs-body">
        <section className="docs-step">
          <span className="docs-step-num">01</span>
          <div className="docs-step-content">
            <h2 className="docs-step-title">Create an API key</h2>
            <p className="docs-step-desc">
              Keys are per-user and scoped to your own projects. The raw key is shown only once, so save it
              right away.
            </p>
            <Button
              leftIcon={<Key size={14} weight="bold" aria-hidden="true" />}
              onClick={() => navigate('/keys')}
            >
              Go to API Keys
            </Button>
          </div>
        </section>

        <section className="docs-step">
          <span className="docs-step-num">02</span>
          <div className="docs-step-content">
            <h2 className="docs-step-title">Get your project ID</h2>
            <p className="docs-step-desc">
              Every tool takes a <code className="inline-code">projectId</code>. Open the project you want the
              agent to manage — its ID is shown at the top of the page, next to the project name, with a
              copy button.
            </p>
          </div>
        </section>

        <section className="docs-step">
          <span className="docs-step-num">03</span>
          <div className="docs-step-content">
            <h2 className="docs-step-title">Set the env variable</h2>
            <p className="docs-step-desc">opencode reads the key from your shell environment when it starts.</p>
            <CodeBlock label="PowerShell" code={ENV_EXAMPLE} />
            <p className="docs-step-note">
              Use <code className="inline-code">setx DEVHUB_MCP_KEY "devhub_…"</code> to make it permanent.
            </p>
          </div>
        </section>

        <section className="docs-step">
          <span className="docs-step-num">04</span>
          <div className="docs-step-content">
            <h2 className="docs-step-title">Create opencode.json</h2>
            <p className="docs-step-desc">
              Add the devhub server to your project config. An example ships with this repo at
              opencode.example.json.
            </p>
            <CodeBlock label="opencode.json" code={OPENCODE_CONFIG} />
            <p className="docs-step-note">
              For production, point the url at your deployed server, e.g. https://devhub.example.com/mcp.
            </p>
          </div>
        </section>

        <section className="docs-step">
          <span className="docs-step-num">05</span>
          <div className="docs-step-content">
            <h2 className="docs-step-title">Restart opencode</h2>
            <p className="docs-step-desc">
              Config is loaded once at startup and not hot-reloaded. Quit opencode and start it again, then
              open a new session.
            </p>
          </div>
        </section>

        <section className="docs-step">
          <span className="docs-step-num">06</span>
          <div className="docs-step-content">
            <h2 className="docs-step-title">Verify the connection</h2>
            <p className="docs-step-desc">
              Run <code className="inline-code">/mcp</code> in opencode — devhub should be connected with
              these tools:
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

        <section className="docs-troubleshooting">
          <h2 className="docs-step-title">Troubleshooting</h2>
          <div className="data-list">
            <div className="data-row">
              <div className="data-row-main">
                <div className="data-row-title">
                  <span className="row-title-text">401 on every call</span>
                </div>
                <div className="data-row-sub">
                  Wrong, expired, or revoked key. Create a new one in API Keys, update DEVHUB_MCP_KEY, and
                  restart opencode.
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
      </div>
    </div>
  );
}
