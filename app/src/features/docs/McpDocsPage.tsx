import { Check, Copy, Key, ArrowSquareOut } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { Button } from '../../components/Button';
import { DocsNav } from './DocsNav';
import { DocsToc, DocsTocMobile, type DocsTocItem } from './DocsToc';
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
  'add_test_case',
  'update_test_case',
  'add_api_collection',
  'add_api_endpoint',
  'update_api_endpoint',
  'create_whiteboard',
  'update_whiteboard',
];

const TOC_ITEMS: DocsTocItem[] = [
  { id: 'mcp-prereq', label: 'Before you begin' },
  { id: 'mcp-key', label: 'Create an API key' },
  { id: 'mcp-project-id', label: 'Get your project ID' },
  { id: 'mcp-env', label: 'Set the env variable' },
  { id: 'mcp-config', label: 'Create opencode.json' },
  { id: 'mcp-restart', label: 'Restart opencode' },
  { id: 'mcp-verify', label: 'Verify the connection' },
  { id: 'mcp-agentsync', label: 'Automate your workflow' },
  { id: 'mcp-troubleshooting', label: 'Troubleshooting' },
];

const AGENTS_SNIPPET = `# DevHub Agent Sync Protocol

Aturan ini berlaku ketika MCP server devhub terkonfigurasi dan dapat dijangkau.
Jika tidak terjangkau, catat sebagai pending dan lanjutkan kerja utama.

## Resolusi project target (berjenjang)
1. User menyebut project di sesi -> pakai itu.
2. Env var DEVHUB_PROJECT_ID terisi -> pakai itu.
3. Tidak keduanya -> tanya user sekali di awal sesi kerja, lalu konsisten.

## Sinkronisasi wajib
| Kejadian                                | Tool DevHub                     | Moment                |
| --------------------------------------- | ------------------------------- | --------------------- |
| Keputusan arsitektural/tradeoff fix     | add_decision                    | Saat keputusan fix    |
| Rencana kerja disusun / mulai implement | create_task                     | Awal sesi kerja       |
| Pekerjaan selesai & terverifikasi       | update_task status done         | Sebelum tutup sesi    |
| Flowchart / diagram dirancang           | create_whiteboard/update_...    | Saat desain dibuat    |

## Aturan perilaku
- Hanya keputusan selevel ADR yang dicatat — pilihan kosmetik tidak.
- Task granular per unit kerja yang bisa diverifikasi.
- Verifikasi dengan project_state (default cap 200 baris — pakai limit: 0).`;

const AGENTSYNC_ENV_EXAMPLE = `$env:DEVHUB_MCP_KEY = "devhub_your_key_here"      # wajib — auth MCP
$env:DEVHUB_PROJECT_ID = "<your-project-uuid>" # opsional — target sync default

# Linux/macOS:
export DEVHUB_MCP_KEY="devhub_your_key_here"
export DEVHUB_PROJECT_ID="<your-project-uuid>"`;

const AGENTSYNC_DECISION_EXAMPLE = `add_decision {
  projectId: "<your-project-uuid>",
  title: "Pakai pointer events untuk drag touch",
  status: "accepted",
  context: "HTML5 drag-and-drop tidak berfungsi di perangkat touch",
  options: [
    "Library DnD eksternal — fitur lengkap tapi tambah dependensi",
    "Pointer events long-press — tanpa dependensi baru"
  ],
  decision: "Pointer events long-press, reuse handler drop existing",
  consequences: "Tanpa dependensi baru; perlu hit-test manual per kolom"
}`;

const PREREQS = [
  { strong: 'opencode is installed', desc: 'This guide uses opencode, but any MCP client works with the same server.' },
  { strong: 'DevHub is reachable', desc: 'Check /api/health returns ok before continuing.' },
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
          <DocsTocMobile items={TOC_ITEMS} />
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
                <Callout>
                  The <code className="inline-code">update_prd</code> tool supports markdown in its text
                  fields: <code className="inline-code">-</code> bullets, <code className="inline-code">1.</code>{' '}
                  numbered lists, <strong>bold</strong>, <em>italic</em>, and{' '}
                  <code className="inline-code">`code`</code> — rendered on the project About tab.
                </Callout>
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
                  For production, use the hosted endpoint, e.g. https://devhub.example.com/mcp.
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

            <section id="mcp-agentsync" className="docs-step">
              <span className="docs-step-num">07</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">Automate your workflow (agent auto-sync)</h2>
                <p className="docs-step-desc">
                  Once the MCP server is connected, teach your AI agent to keep DevHub in sync
                  automatically: decisions become ADRs, planned work becomes tasks, finished work is
                  marked done, and flowcharts are saved as whiteboards. Add these rules to your repo's{' '}
                  <code className="inline-code">AGENTS.md</code> so every opencode session follows them.
                </p>
                <CodeBlock lang="Markdown" file="AGENTS.md" code={AGENTS_SNIPPET} />
                <p className="docs-step-desc">
                  The agent resolves which project to sync to dynamically: a project you mention in the
                  session wins, then the <code className="inline-code">DEVHUB_PROJECT_ID</code> env var,
                  otherwise it asks you once. Set both variables alongside your key:
                </p>
                <CodeBlock lang="PowerShell" code={AGENTSYNC_ENV_EXAMPLE} />
                <Callout>
                  Only architecture-level decisions belong here (structure, dependencies, patterns,
                  hosting, security) — not cosmetic choices. One decision = one{' '}
                  <code className="inline-code">add_decision</code> call, made when the decision is
                  final.
                </Callout>
                <p className="docs-step-desc">Example of what the agent records:</p>
                <CodeBlock lang="JSON" code={AGENTSYNC_DECISION_EXAMPLE} />
                <Callout>
                  Tip: <code className="inline-code">project_state</code> returns at most 200 rows per
                  collection by default — pass <code className="inline-code">limit: 0</code> to see
                  everything.
                </Callout>
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
                      DevHub is not reachable. Make sure the service is up and /api/health returns ok.
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="docs-next">
              <h2 className="docs-section-title">Next steps</h2>
              <div className="docs-next-grid">
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