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
  'add_milestone',
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

These rules apply when the MCP server devhub is configured (see opencode.json) and reachable.
If not reachable, log as pending, continue main work, and retry at end of session — sync must not block work.

## Project target resolution (hierarchical)
1. User mentions a project in session → use that.
2. Env var DEVHUB_PROJECT_ID is set → use that.
3. Neither → ask user once at session start, then stay consistent until session ends.

Never guess projectId or write it directly to any file.

## Milestone resolution
Before creating a task (session start or mid-session), ask the user whether the task should be grouped under a milestone:
1. Fetch the milestone list from project_state (see milestones[]).
2. If no milestones exist → offer to create one.
3. If milestones exist → ask via question tool: "Use a milestone for this task?"
   Options: [Use existing milestone, Create new milestone, No milestone]
4. If "existing" → list milestone names, pick one → use its milestoneId.
5. If "new" → ask name, version (optional), target date (optional) → add_milestone, use the returned ID.
6. If "none" → create_task without milestoneId.

## Required sync
| Event | DevHub Tool | When |
| --- | --- | --- |
| Architecture decision finalized | add_decision | When decision is final |
| Work plan drafted / implementation starts | create_task | Session start |
| Work completed & verified | update_task status done | Before closing session |
| Flowchart / architecture diagram designed or changed | create_whiteboard / update_whiteboard | When design is created |
| Bug found / issue confirmed | add_issue | When issue is created |
| Issue linked to task | update_issue (linkedTaskId) | When linking |
| Test case written for task/issue | add_test_case | When test is written |
| Milestone created / status changed | add_milestone / update_milestone | When milestone is changed |

## Behavior rules
- Only ADR-level decisions are recorded — not small cosmetic/style choices.
- One decision = one call; do not batch them at end of project.
- Tasks are created granular per verifiable unit of work, not one giant task.
- After syncing, verify with project_state if unsure (default cap is 200 rows per collection — use limit: 0).`;

const AGENTSYNC_ENV_EXAMPLE = `$env:DEVHUB_MCP_KEY = "devhub_your_key_here"      # required — MCP auth
$env:DEVHUB_PROJECT_ID = "<your-project-uuid>" # optional — default sync target

# Linux/macOS:
export DEVHUB_MCP_KEY="devhub_your_key_here"
export DEVHUB_PROJECT_ID="<your-project-uuid>"`;

const TASK_LIFECYCLE = `Status: todo → inProgress → review → done

# 1. Create a task when planning work
create_task {
  projectId: "<your-project-uuid>",
  title: "Implement drag handler for touch devices",
  status: "todo",
  priority: "high",
  estimate: 8,
  labels: ["frontend", "ui"],
  description: "Long-press pointer events for touch drag, no new dependencies"
}

# 2. Update status when starting work
update_task {
  projectId: "<your-project-uuid>",
  taskId: "<task-uuid>",
  status: "inProgress"
}

# 3. Mark done — completedAt & actualHours are auto-set
update_task {
  projectId: "<your-project-uuid>",
  taskId: "<task-uuid>",
  status: "done"
}`;

const ISSUE_LIFECYCLE = `Status: open → reproduced → fixing → resolved | wontfix

# 1. Report a new bug
add_issue {
  projectId: "<your-project-uuid>",
  title: "Drag handler does not trigger on iOS Safari",
  severity: "high",
  status: "open",
  description: "Pointer events do not fire on long-press in iOS Safari 17+",
  reproduction: "1. Open app in iOS Safari 2. Long-press a card 3. No drag occurs"
}

# 2. Confirm reproduction then link to task
update_issue {
  projectId: "<your-project-uuid>",
  issueId: "<issue-uuid>",
  status: "reproduced",
  linkedTaskId: "<task-uuid>"
}

# 3. Mark resolved when fix is merged
update_issue {
  projectId: "<your-project-uuid>",
  issueId: "<issue-uuid>",
  status: "resolved"
}`;

const DECISION_LIFECYCLE = `Status: proposed → accepted | rejected | superseded

# 1. Record an architectural decision (one-shot, no update tool)
add_decision {
  projectId: "<your-project-uuid>",
  title: "Pointer events for touch drag",
  status: "accepted",
  context: "HTML5 drag-and-drop does not work on touch devices",
  options: [
    "External DnD library — full features but adds dependency",
    "Pointer events long-press — no new dependencies"
  ],
  decision: "Pointer events long-press, reuse existing drop handler",
  consequences: "No new dependencies; manual hit-test per column required"
}

# 2. For replaced decisions, use status superseded
add_decision {
  projectId: "<your-project-uuid>",
  title: "Replace pointer events with Solid DnD",
  status: "superseded",
  context: "Previous decision (pointer events) is unstable on Firefox",
  options: [
    "Pointer events (initial decision)",
    "Solid DnD library — more mature"
  ],
  decision: "Solid DnD library, because pointer events has bugs on Firefox",
  consequences: "Adds new dependency; more stable cross-browser"
}`;

const WHITEBOARD_LIFECYCLE = `Create → update (elements full replacement, max 50 per project)

# 1. Create whiteboard with initial elements
create_whiteboard {
  projectId: "<your-project-uuid>",
  name: "Architecture — Drag Handler",
  description: "Pointer events flow diagram for touch drag",
  elements: [
    { kind: "sticky", x: 0, y: 0, w: 200, h: 120, color: "#e8b955",
      text: "User long-press card" },
    { kind: "sticky", x: 250, y: 0, w: 200, h: 120, color: "#6ea8fe",
      text: "PointerDown event fires" },
    { kind: "edge", x1: 200, y1: 60, x2: 250, y2: 60,
      color: "#8b5cf6", width: 2, arrowhead: true },
    { kind: "shape", shapeType: "rect", x: 500, y: 0, w: 120, h: 80,
      color: "#22c55e", fill: false, strokeWidth: 2, label: "Drag start" }
  ]
}

# 2. Update whiteboard — elements are replaced wholesale
update_whiteboard {
  projectId: "<your-project-uuid>",
  whiteboardId: "<whiteboard-uuid>",
  elements: [
    { kind: "sticky", x: 0, y: 0, w: 200, h: 120, color: "#e8b955",
      text: "User long-press card" },
    { kind: "sticky", x: 250, y: 0, w: 200, h: 120, color: "#6ea8fe",
      text: "PointerDown fires (with 300ms delay)" },
    { kind: "sticky", x: 500, y: 0, w: 200, h: 120, color: "#22c55e",
      text: "Drag confirmed → setPointerCapture" },
    { kind: "edge", x1: 200, y1: 60, x2: 250, y2: 60,
      color: "#8b5cf6", width: 2, arrowhead: true },
    { kind: "edge", x1: 450, y1: 60, x2: 500, y2: 60,
      color: "#8b5cf6", width: 2, arrowhead: true }
  ]
}`;

const MILESTONE_LIFECYCLE = `Status: planned → inProgress → released

# 1. Create a new milestone
add_milestone {
  projectId: "<your-project-uuid>",
  name: "M1: Drag Handler",
  version: "v1.0",
  targetDate: "2026-09-15",
  status: "planned"
}

# 2. Start progress
update_milestone {
  projectId: "<your-project-uuid>",
  milestoneId: "<milestone-uuid>",
  status: "inProgress"
}

# 3. Release — add changelog
update_milestone {
  projectId: "<your-project-uuid>",
  milestoneId: "<milestone-uuid>",
  status: "released",
  changelog: "- Pointer events drag handler\\n- Touch support iOS Safari 17+"
}`;

const AUTO_PROMPT_SNIPPET = `## Prerequisites

Before sync begins, ensure MCP is configured:

1. Check env var DEVHUB_MCP_KEY — if empty, ask user via question tool (custom: true):
   "DevHub MCP key is not set. Open DevHub → sidebar → API Keys → create a key, then paste it here."
2. Check env var DEVHUB_PROJECT_ID — if empty, ask user via question tool (custom: true):
   "Project ID is not set. Open a project in DevHub → copy the ID from the header, then paste it here."
3. If MCP returns 401 (key invalid/expired), ask user again:
   "MCP key is not valid. Create a new key at DevHub → API Keys → then paste it here."
4. If MCP is not reachable (server down), log as pending and continue main work.`;

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

            <section id="mcp-auto-prompt" className="docs-step">
              <span className="docs-step-num">07</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">Let your agent ask for missing config</h2>
                <p className="docs-step-desc">
                  If <code className="inline-code">DEVHUB_MCP_KEY</code> or{' '}
                  <code className="inline-code">DEVHUB_PROJECT_ID</code> are not set, the agent can
                  automatically prompt you via the built-in <code className="inline-code">question</code> tool
                  — no manual env setup required for quick demos. Add this section to your{' '}
                  <code className="inline-code">AGENTS.md</code>:
                </p>
                <CodeBlock lang="Markdown" file="AGENTS.md" code={AUTO_PROMPT_SNIPPET} />
                <Callout>
                  The <code className="inline-code">question</code> tool shows a dialog in the TUI where the
                  user can paste their key or project ID directly. The agent then uses the value for the
                  rest of the session.
                </Callout>
              </div>
            </section>

            <section id="mcp-agentsync" className="docs-step">
              <span className="docs-step-num">08</span>
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
                <Callout>
                  Tip: <code className="inline-code">project_state</code> returns at most 200 rows per
                  collection by default — pass <code className="inline-code">limit: 0</code> to see
                  everything.
                </Callout>

                <h3 className="docs-step-subtitle">Task lifecycle</h3>
                <p className="docs-step-desc">
                  Tasks track planned work through four statuses:
                </p>
                <CodeBlock lang="Text" code={TASK_LIFECYCLE} />
                <Callout>
                  <code className="inline-code">completedAt</code> and{' '}
                  <code className="inline-code">actualHours</code> are auto-set when status moves to{' '}
                  <code className="inline-code">done</code> — no need to pass them manually.
                </Callout>

                <h3 className="docs-step-subtitle">Issue lifecycle</h3>
                <p className="docs-step-desc">
                  Issues track bugs and link them to fixing tasks:
                </p>
                <CodeBlock lang="Text" code={ISSUE_LIFECYCLE} />
                <Callout>
                  Use <code className="inline-code">linkedTaskId</code> to connect an issue to the task
                  that fixes it. Set to <code className="inline-code">null</code> to unlink.
                </Callout>

                <h3 className="docs-step-subtitle">Decision lifecycle</h3>
                <p className="docs-step-desc">
                  Architecture decisions are one-shot — there is no{' '}
                  <code className="inline-code">update_decision</code> tool:
                </p>
                <CodeBlock lang="Text" code={DECISION_LIFECYCLE} />
                <Callout>
                  Only record decisions at the ADR level (structure, dependencies, patterns, hosting,
                  security) — not cosmetic or style choices.
                </Callout>

                <h3 className="docs-step-subtitle">Whiteboard lifecycle</h3>
                <p className="docs-step-desc">
                  Whiteboards store diagrams and flowcharts. Elements are replaced wholesale on update:
                </p>
                <CodeBlock lang="Text" code={WHITEBOARD_LIFECYCLE} />
                <Callout>
                  Max 50 whiteboards per project. Element IDs are auto-assigned if omitted. Element kinds:{' '}
                  <code className="inline-code">sticky</code>,{' '}
                  <code className="inline-code">shape</code>,{' '}
                  <code className="inline-code">edge</code>,{' '}
                  <code className="inline-code">text</code>,{' '}
                  <code className="inline-code">stroke</code>,{' '}
                  <code className="inline-code">boundary</code>,{' '}
                  <code className="inline-code">ref</code>.
                </Callout>

                <h3 className="docs-step-subtitle">Milestone lifecycle</h3>
                <p className="docs-step-desc">
                  Milestones group tasks into releases. The agent asks you before creating tasks:
                </p>
                <CodeBlock lang="Text" code={MILESTONE_LIFECYCLE} />
                <Callout>
                  <code className="inline-code">version</code> and{' '}
                  <code className="inline-code">targetDate</code> can be cleared by passing{' '}
                  <code className="inline-code">null</code>. Changelog supports markdown.
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