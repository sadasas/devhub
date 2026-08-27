import { Check, Copy, Key, ArrowSquareOut } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { Button } from '../../components/Button';
import { DocsNav } from './DocsNav';
import { DocsToc, DocsTocMobile, type DocsTocItem } from './DocsToc';

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

const TOC_ITEMS: { id: string; labelKey: string }[] = [
  { id: 'mcp-prereq', labelKey: 'docs.mcp.toc.prereq' },
  { id: 'mcp-key', labelKey: 'docs.mcp.toc.key' },
  { id: 'mcp-project-id', labelKey: 'docs.mcp.toc.projectId' },
  { id: 'mcp-env', labelKey: 'docs.mcp.toc.env' },
  { id: 'mcp-config', labelKey: 'docs.mcp.toc.config' },
  { id: 'mcp-restart', labelKey: 'docs.mcp.toc.restart' },
  { id: 'mcp-verify', labelKey: 'docs.mcp.toc.verify' },
  { id: 'mcp-agentsync', labelKey: 'docs.mcp.toc.agentsync' },
  { id: 'mcp-troubleshooting', labelKey: 'docs.mcp.toc.troubleshooting' },
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
| API collection / endpoint baru diekspos (mis. tambah \`server/src/modules/*/handlers/*.ts\`, \`entity-router.ts\`, \`*.routes.ts\`) | add_api_collection / add_api_endpoint | Saat agen membuat/mengekspos endpoint atau collection baru — segera setelah route/handler committed & \`method+path\` final |
| Kontrak API endpoint berubah (method/path/params/body/responses/collection) | update_api_endpoint | Saat agen mengubah kontrak — patch sebelum tutup sesi/commit |

## Behavior rules
- Only ADR-level decisions are recorded — not small cosmetic/style choices.
- One decision = one call; do not batch them at end of project.
- Tasks are created granular per verifiable unit of work, not one giant task.
- Sebelum \`add_api_endpoint\`, baca \`project_state.apiEndpoints\` dan cocokkan \`method+path+collectionId\` untuk hindari duplikat (cap 500 collections / 5000 endpoints).
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

const API_LIFECYCLE = `Group + document endpoints (add_api_collection / add_api_endpoint → update_api_endpoint)

# 1. Create a collection to group endpoints (optional but recommended)
add_api_collection {
  projectId: "<your-project-uuid>",
  name: "Auth",
  description: "Login, register, session"
}

# 2. Document each new endpoint immediately after the route/handler is committed
add_api_endpoint {
  projectId: "<your-project-uuid>",
  collectionId: "<collection-uuid>",
  method: "POST",
  path: "/api/auth/login",
  name: "Login",
  description: "Authenticates a user and sets an httpOnly session cookie",
  headers: [],
  params: [],
  body: "{ email: string, password: string }",
  responses: [{ status: 200, contentType: "application/json", description: "JWT cookie set", body: "{ user: { id, email } }" }]
}

# 3. Patch the contract when it changes (method/path/params/body/responses/collection)
update_api_endpoint {
  projectId: "<your-project-uuid>",
  endpointId: "<endpoint-uuid>",
  path: "/api/v1/auth/login",
  description: "Now returns version + ETag — see docs",
  responses: [{ status: 200, contentType: "application/json", description: "Updated response", body: "{ user, version }" }]
}

# Tip: before add_api_endpoint, read project_state.apiEndpoints and match method+path+collectionId to avoid duplicates (cap 500 collections / 5000 endpoints)`;

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
  { strongKey: 'docs.mcp.prereq.opencodeStrong', descKey: 'docs.mcp.prereq.opencodeDesc' },
  { strongKey: 'docs.mcp.prereq.reachableStrong', descKey: 'docs.mcp.prereq.reachableDesc' },
  { strongKey: 'docs.mcp.prereq.loggedInStrong', descKey: 'docs.mcp.prereq.loggedInDesc' },
];

function CodeBlock({ code, lang, file }: { code: string; lang: string; file?: string }) {
  const { t } = useTranslation('extras');
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
          {copied ? t('api.workbench.copied') : t('api.workbench.copy')}
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
  const { t } = useTranslation('extras');
  const tocItems: DocsTocItem[] = TOC_ITEMS.map((item) => ({ id: item.id, label: t(item.labelKey) }));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('docs.mcp.title')}</h1>
          <p className="page-subtitle">{t('docs.mcp.subtitle')}</p>
        </div>
      </header>

      <div className="docs-grid">
        <div className="docs-main">
          <DocsTocMobile items={tocItems} />
          <DocsNav />
          <div className="docs-body">
            <section id="mcp-prereq" className="docs-prereq">
              <h2 className="docs-section-title">{t('docs.mcp.toc.prereq')}</h2>
              <ul className="docs-prereq-list">
                {PREREQS.map((p) => (
                  <li key={p.strongKey} className="docs-prereq-item">
                    <span className="docs-prereq-check" aria-hidden="true">
                      <Check size={12} weight="bold" />
                    </span>
                    <span>
                      <strong>{t(p.strongKey)}</strong> — {t(p.descKey)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section id="mcp-key" className="docs-step">
              <span className="docs-step-num">01</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.keyTitle')}</h2>
                <Button
                  leftIcon={<Key size={14} weight="bold" aria-hidden="true" />}
                  onClick={() => navigate('/keys')}
                >
                  {t('docs.mcp.goToKeys')}
                </Button>
              </div>
            </section>

            <section id="mcp-project-id" className="docs-step">
              <span className="docs-step-num">02</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.projectIdTitle')}</h2>
              </div>
            </section>

            <section id="mcp-env" className="docs-step">
              <span className="docs-step-num">03</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.envTitle')}</h2>
                <CodeBlock lang="PowerShell" code={ENV_EXAMPLE} />
              </div>
            </section>

            <section id="mcp-config" className="docs-step">
              <span className="docs-step-num">04</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.configTitle')}</h2>
                <CodeBlock lang="JSON" file="opencode.json" code={OPENCODE_CONFIG} />
              </div>
            </section>

            <section id="mcp-restart" className="docs-step">
              <span className="docs-step-num">05</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.restartTitle')}</h2>
              </div>
            </section>

            <section id="mcp-verify" className="docs-step">
              <span className="docs-step-num">06</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.verifyTitle')}</h2>
                <ul className="docs-chips">
                  {MCP_TOOLS.map((tool) => (
                    <li key={tool} className="docs-chip">
                      {tool}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section id="mcp-auto-prompt" className="docs-step">
              <span className="docs-step-num">07</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.autoPromptTitle')}</h2>
                <CodeBlock lang="Markdown" file="AGENTS.md" code={AUTO_PROMPT_SNIPPET} />
              </div>
            </section>

            <section id="mcp-agentsync" className="docs-step">
              <span className="docs-step-num">08</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.agentsyncTitle')}</h2>
                <CodeBlock lang="Markdown" file="AGENTS.md" code={AGENTS_SNIPPET} />
                <CodeBlock lang="PowerShell" code={AGENTSYNC_ENV_EXAMPLE} />

                <h3 className="docs-step-subtitle">{t('docs.mcp.lifecycle.task')}</h3>
                <CodeBlock lang="Text" code={TASK_LIFECYCLE} />

                <h3 className="docs-step-subtitle">{t('docs.mcp.lifecycle.issue')}</h3>
                <CodeBlock lang="Text" code={ISSUE_LIFECYCLE} />

                <h3 className="docs-step-subtitle">{t('docs.mcp.lifecycle.decision')}</h3>
                <CodeBlock lang="Text" code={DECISION_LIFECYCLE} />

                <h3 className="docs-step-subtitle">{t('docs.mcp.lifecycle.whiteboard')}</h3>
                <CodeBlock lang="Text" code={WHITEBOARD_LIFECYCLE} />

                <h3 className="docs-step-subtitle">{t('docs.mcp.lifecycle.api')}</h3>
                <CodeBlock lang="Text" code={API_LIFECYCLE} />

                <h3 className="docs-step-subtitle">{t('docs.mcp.lifecycle.milestone')}</h3>
                <CodeBlock lang="Text" code={MILESTONE_LIFECYCLE} />
              </div>
            </section>

            <section id="mcp-troubleshooting" className="docs-troubleshooting">
              <h2 className="docs-section-title">{t('docs.mcp.toc.troubleshooting')}</h2>
              <div className="data-list">
                <div className="data-row">
                  <div className="data-row-main">
                    <div className="data-row-title">
                      <span className="row-title-text">{t('docs.mcp.trouble.unauthorizedTitle')}</span>
                    </div>
                  </div>
                </div>
                <div className="data-row">
                  <div className="data-row-main">
                    <div className="data-row-title">
                      <span className="row-title-text">{t('docs.mcp.trouble.connectTitle')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="docs-next">
              <h2 className="docs-section-title">{t('docs.mcp.nextSteps')}</h2>
              <div className="docs-next-grid">
                <button type="button" className="docs-card" onClick={() => navigate('/keys')}>
                  <Key size={18} weight="duotone" aria-hidden="true" />
                  <span className="docs-card-text">
                    <span className="docs-card-title">{t('docs.mcp.apiKeysTitle')}</span>
                    <span className="docs-card-sub">{t('docs.mcp.apiKeysSub')}</span>
                  </span>
                  <ArrowSquareOut size={14} className="docs-card-arrow" aria-hidden="true" />
                </button>
              </div>
            </section>
          </div>
        </div>
        <DocsToc items={tocItems} />
      </div>
    </div>
  );
}