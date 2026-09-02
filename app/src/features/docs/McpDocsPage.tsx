import {
  ArrowSquareOut,
  Check,
  Code,
  Copy,
  Cursor as CursorIcon,
  Key,
  Robot,
  Sparkle,
  Terminal,
  Wind,
  Warning,
  CaretDown,
  Info,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/Button';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { Callout } from './Callout';
import { DocsNav } from './DocsNav';
import { DocsToc, DocsTocMobile, type DocsTocItem } from './DocsToc';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'docs-mcp-agent';

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
] as const;

const TOC_ITEMS: { id: string; labelKey: string }[] = [
  { id: 'mcp-prereq', labelKey: 'docs.mcp.toc.prereq' },
  { id: 'mcp-key', labelKey: 'docs.mcp.toc.key' },
  { id: 'mcp-project-id', labelKey: 'docs.mcp.toc.projectId' },
  { id: 'mcp-env', labelKey: 'docs.mcp.toc.env' },
  { id: 'mcp-config', labelKey: 'docs.mcp.toc.config' },
  { id: 'mcp-oauth', labelKey: 'docs.mcp.toc.oauth' },
  { id: 'mcp-ratelimit', labelKey: 'docs.mcp.toc.ratelimit' },
  { id: 'mcp-restart', labelKey: 'docs.mcp.toc.restart' },
  { id: 'mcp-verify', labelKey: 'docs.mcp.toc.verify' },
  { id: 'mcp-auto-prompt', labelKey: 'docs.mcp.toc.autoPrompt' },
  { id: 'mcp-agentsync', labelKey: 'docs.mcp.toc.agentsync' },
  { id: 'mcp-troubleshooting', labelKey: 'docs.mcp.toc.troubleshooting' },
];

const PREREQS = [
  { strongKey: 'docs.mcp.prereq.opencodeStrong', descKey: 'docs.mcp.prereq.opencodeDesc' },
  { strongKey: 'docs.mcp.prereq.reachableStrong', descKey: 'docs.mcp.prereq.reachableDesc' },
  { strongKey: 'docs.mcp.prereq.loggedInStrong', descKey: 'docs.mcp.prereq.loggedInDesc' },
];

type AgentId = 'opencode' | 'claude' | 'cursor' | 'windsurf' | 'vscode' | 'gemini';

const AGENT_IDS: readonly AgentId[] = ['opencode', 'claude', 'cursor', 'windsurf', 'vscode', 'gemini'] as const;

const AGENT_META: Record<AgentId, { label: string; Icon: typeof Terminal }> = {
  opencode: { label: 'OpenCode', Icon: Terminal },
  claude: { label: 'Claude Code', Icon: Robot },
  cursor: { label: 'Cursor', Icon: CursorIcon },
  windsurf: { label: 'Windsurf', Icon: Wind },
  vscode: { label: 'VS Code/Copilot', Icon: Code },
  gemini: { label: 'Gemini', Icon: Sparkle },
};

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

const AUTO_PROMPT_SNIPPET = `## Prerequisites

Before sync begins, ensure MCP is configured (OAuth 2.1 PKCE):

1. Run \`opencode mcp auth devhub\` — browser opens to DevHub login (form custom), then auto-stores token.
2. Check env var DEVHUB_PROJECT_ID — if empty, ask user via question tool (custom: true):
   "Project ID is not set. Open a project in DevHub → copy the ID from the header, then paste it here."
3. If MCP returns 401 (token expired), run \`opencode mcp auth devhub\` again.
4. If MCP is not reachable (server down), log as pending and continue main work.`;

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

// Variant wrappers — same core content, file-specific label (prompt wants 5 varian)
const AGENTS_VARIANT_SNIPPETS: Record<string, string> = {
  'AGENTS.md': AGENTS_SNIPPET,
  'CLAUDE.md': `# CLAUDE.md — DevHub Agent Sync\n\n${AGENTS_SNIPPET}`,
  '.cursorrules': `# .cursorrules — DevHub Agent Sync\n\n${AGENTS_SNIPPET}`,
  '.windsurfrules': `# .windsurfrules — DevHub Agent Sync\n\n${AGENTS_SNIPPET}`,
  '.github/copilot-instructions.md': `# .github/copilot-instructions.md — DevHub Agent Sync\n\n${AGENTS_SNIPPET}`,
};

const AUTO_PROMPT_VARIANT_SNIPPETS: Record<string, string> = {
  'AGENTS.md': AUTO_PROMPT_SNIPPET,
  'CLAUDE.md': `# CLAUDE.md — DevHub Prerequisites\n\n${AUTO_PROMPT_SNIPPET}`,
  '.cursorrules': `# .cursorrules — DevHub Prerequisites\n\n${AUTO_PROMPT_SNIPPET}`,
  '.windsurfrules': `# .windsurfrules — DevHub Prerequisites\n\n${AUTO_PROMPT_SNIPPET}`,
  '.github/copilot-instructions.md': `# .github/copilot-instructions.md — DevHub Prerequisites\n\n${AUTO_PROMPT_SNIPPET}`,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMcpUrl(): string {
  const raw =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  // VITE_API_URL is often https://host/api/v1 — MCP lives at /mcp, not /api/v1/mcp
  const stripped = raw.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
  if (!stripped) return 'http://localhost:3000/mcp';
  // If raw was already an origin or unknown path, keep it; otherwise use stripped origin
  // Safer to drop query/hash and keep origin when VITE_API_URL ends with /api/v1
  if (/\/api\/v1\/?$/i.test(raw)) return `${stripped}/mcp`;
  return `${stripped}/mcp`;
}

function getInitialAgent(): AgentId {
  if (typeof window === 'undefined') return 'opencode';
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('agent')?.toLowerCase();
    if (param && (AGENT_IDS as readonly string[]).includes(param)) {
      return param as AgentId;
    }
    // hash may contain ?agent=...
    if (url.hash.includes('agent=')) {
      const hashParams = new URLSearchParams(url.hash.split('?')[1] ?? '');
      const h = hashParams.get('agent')?.toLowerCase();
      if (h && (AGENT_IDS as readonly string[]).includes(h)) return h as AgentId;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && (AGENT_IDS as readonly string[]).includes(stored)) return stored as AgentId;
  } catch {
    // ignore
  }
  return 'opencode';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CodeBlock({ code, lang, file }: { code: string; lang: string; file?: string }) {
  const { t } = useTranslation('extras');
  const { copied, copy } = useCopyFeedback();
  const regionLabel = file ? `${lang} ${file}` : `${lang} code`;

  return (
    <div className="code-block" role="region" aria-label={regionLabel}>
      <div className="code-block-header">
        <span className="code-block-meta">
          <span className="code-block-badge">{lang}</span>
          {file && <span className="code-block-label">{file}</span>}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="code-block-copy"
          aria-label={copied ? t('api.workbench.copied') : t('api.workbench.copy')}
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
      <pre className="code-block-body" tabIndex={0}>
        <code>{code}</code>
      </pre>
      <span aria-live="polite" className="sr-only">
        {copied ? t('api.workbench.copied') : ''}
      </span>
    </div>
  );
}

function AgentPicker({
  selected,
  onSelect,
}: {
  selected: AgentId;
  onSelect: (id: AgentId) => void;
}) {
  const { t } = useTranslation('extras');
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const idx = AGENT_IDS.indexOf(selected);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = AGENT_IDS[(idx + dir + AGENT_IDS.length) % AGENT_IDS.length]!;
        onSelect(next);
        // focus the new tab on next tick
        requestAnimationFrame(() => {
          const el = document.getElementById(`agent-tab-${next}`);
          el?.focus();
        });
      } else if (e.key === 'Home') {
        e.preventDefault();
        onSelect(AGENT_IDS[0]!);
        document.getElementById(`agent-tab-${AGENT_IDS[0]!}`)?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        const last = AGENT_IDS[AGENT_IDS.length - 1]!;
        onSelect(last);
        document.getElementById(`agent-tab-${last}`)?.focus();
      }
    },
    [selected, onSelect],
  );

  return (
    <div className="docs-agent-picker-wrap" aria-label={t('docs.mcp.agent.tabsLabel')}>
      <div
        ref={listRef}
        className="docs-agent-picker"
        role="tablist"
        aria-label={t('docs.mcp.agent.pickerLabel')}
        onKeyDown={handleKeyDown}
      >
        {AGENT_IDS.map((id) => {
          const meta = AGENT_META[id];
          const Icon = meta.Icon;
          const isActive = selected === id;
          return (
            <button
              key={id}
              id={`agent-tab-${id}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`agent-panel-${id}`}
              tabIndex={isActive ? 0 : -1}
              className="docs-agent-tab"
              onClick={() => onSelect(id)}
            >
              <Icon size={14} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />
              <span>{t(`docs.mcp.agent.${id}` as const, { defaultValue: meta.label })}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EnvSwitcher({ psCode, bashCode }: { psCode: string; bashCode: string }) {
  const { t } = useTranslation('extras');
  const [shell, setShell] = useState<'ps' | 'bash'>('ps');

  return (
    <div className="docs-env-wrap">
      <div className="segmented" role="tablist" aria-label="Shell selector">
        <button
          type="button"
          role="tab"
          aria-selected={shell === 'ps'}
          className={`segment ${shell === 'ps' ? 'segment-active' : ''}`}
          onClick={() => setShell('ps')}
        >
          {t('docs.mcp.env.powershell')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={shell === 'bash'}
          className={`segment ${shell === 'bash' ? 'segment-active' : ''}`}
          onClick={() => setShell('bash')}
        >
          {t('docs.mcp.env.bash')}
        </button>
      </div>
      <div role="tabpanel" aria-label={shell === 'ps' ? 'PowerShell' : 'bash'}>
        <CodeBlock lang={shell === 'ps' ? 'PowerShell' : 'bash'} code={shell === 'ps' ? psCode : bashCode} />
      </div>
      <p className="docs-step-note">{t('docs.mcp.env.hint')}</p>
    </div>
  );
}

function LifecycleAccordion({
  title,
  code,
  defaultOpen = false,
}: {
  title: string;
  code: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className="docs-accordion" open={defaultOpen}>
      <summary>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{title}</h3>
        <CaretDown size={12} weight="bold" aria-hidden="true" className="docs-accordion-chevron" />
      </summary>
      <div className="docs-accordion-body">
        <CodeBlock lang="Text" code={code} />
      </div>
    </details>
  );
}

type VariantFile = { id: string; file: string; lang: string; code: string; labelKey: string };

function DocsVariantTabs({ variants, commitNoteKey }: { variants: VariantFile[]; commitNoteKey: string }) {
  const { t } = useTranslation('extras');
  const [activeId, setActiveId] = useState<string>(() => variants[0]?.id ?? '');
  const active = variants.find((v) => v.id === activeId) ?? variants[0]!;

  return (
    <div className="docs-agents-variant-tabs">
      <div className="segmented docs-variant-segmented" role="tablist" aria-label={t('docs.mcp.agentsync.variantLabel')}>
        {variants.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={activeId === v.id}
            className={`segment ${activeId === v.id ? 'segment-active' : ''}`}
            onClick={() => setActiveId(v.id)}
            aria-controls={`variant-panel-${v.id}`}
            id={`variant-tab-${v.id}`}
          >
            {t(v.labelKey as any, { defaultValue: v.file })}
          </button>
        ))}
      </div>
      <div id={`variant-panel-${active.id}`} role="tabpanel" aria-labelledby={`variant-tab-${active.id}`} style={{ marginTop: 10 }}>
        <CodeBlock lang={active.lang} file={active.file} code={active.code} />
      </div>
      <Callout>
        <span>{t(commitNoteKey, { defaultValue: 'Commit file ini ke repo root — agen membacanya setiap sesi.' })}</span>
      </Callout>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function McpDocsPage() {
  const { t } = useTranslation('extras');
  const [agent, setAgent] = useState<AgentId>(() => getInitialAgent());
  const tocItems: DocsTocItem[] = useMemo(
    () => TOC_ITEMS.map((item) => ({ id: item.id, label: t(item.labelKey) })),
    [t],
  );

  const mcpUrl = useMemo(() => getMcpUrl(), []);
  // also compute apiUrl for docs transparency
  const apiUrl = useMemo(() => {
    const raw =
      (import.meta.env.VITE_API_URL as string | undefined) ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    return raw.replace(/\/+$/, '');
  }, []);

  // Persist agent selection
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, agent);
    } catch {
      // ignore
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('agent', agent);
      window.history.replaceState(null, '', url.toString());
    } catch {
      // ignore
    }
  }, [agent]);

  // Sync if URL changes externally (back/forward)
  useEffect(() => {
    const onPop = () => {
      const next = getInitialAgent();
      setAgent((prev) => (prev !== next ? next : prev));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const psEnv = useMemo(
    () => `$env:DEVHUB_PROJECT_ID = "a1b2c3d4-e5f6-4a7b-9c0d-1234567890ab"  # optional
# OAuth — run: opencode mcp auth devhub (browser login, token auto-rotated)`,
    [],
  );
  const bashEnv = useMemo(
    () => `export DEVHUB_PROJECT_ID="a1b2c3d4-e5f6-4a7b-9c0d-1234567890ab"  # optional
# OAuth — run: opencode mcp auth devhub (browser login, token auto-rotated)`,
    [],
  );

  const projectIdExample = t('docs.mcp.projectId.headerExample');
  const { copied: copiedPid, copy: copyPid } = useCopyFeedback();

  // Per-agent config snippets — OAuth public only (no API key)
  const snippets = useMemo(() => {
    const url = mcpUrl;
    return {
      opencode: {
        files: [
          {
            file: 'opencode.json',
            lang: 'JSON',
            code: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "devhub": {
      "type": "remote",
      "url": "${url}",
      "enabled": true
    }
  }
}`,
          },
        ],
      },
      claude: {
        cli: `claude mcp add --transport http devhub ${url}`,
        files: [
          {
            file: '.mcp.json  (project)',
            lang: 'JSON',
            code: `{
  "mcpServers": {
    "devhub": {
      "type": "http",
      "url": "${url}"
    }
  }
}`,
          },
          {
            file: '~/.claude.json  (global)',
            lang: 'JSON',
            code: `{
  "mcpServers": {
    "devhub": {
      "type": "http",
      "url": "${url}"
    }
  }
}`,
          },
        ],
      },
      cursor: {
        files: [
          {
            file: '.cursor/mcp.json  (project)',
            lang: 'JSON',
            code: `{
  "mcpServers": {
    "devhub": {
      "url": "${url}"
    }
  }
}`,
          },
          {
            file: '~/.cursor/mcp.json  (global)',
            lang: 'JSON',
            code: `{
  "mcpServers": {
    "devhub": {
      "url": "${url}"
    }
  }
}`,
          },
        ],
      },
      windsurf: {
        files: [
          {
            file: '~/.codeium/windsurf/mcp_config.json',
            lang: 'JSON',
            code: `{
  "mcpServers": {
    "devhub": {
      "serverUrl": "${url}"
    }
  }
}`,
          },
        ],
      },
      vscode: {
        files: [
          {
            file: '.vscode/mcp.json  (workspace)',
            lang: 'JSON',
            code: `{
  "servers": {
    "devhub": {
      "type": "http",
      "url": "${url}"
    }
  }
}`,
          },
          {
            file: '.github/copilot/mcp.json  (optional)',
            lang: 'JSON',
            code: `{
  "servers": {
    "devhub": {
      "type": "http",
      "url": "${url}"
    }
  }
}`,
          },
        ],
      },
      gemini: {
        files: [
          {
            file: '~/.gemini/settings.json',
            lang: 'JSON',
            code: `{
  "mcpServers": {
    "devhub": {
      "serverUrl": "${url}"
    }
  }
}`,
          },
        ],
      },
    } as Record<AgentId, { files: { file: string; lang: string; code: string }[]; cli?: string }>;
  }, [mcpUrl]);

  const verifyCurl = useMemo(
    () =>
      `# OAuth — get token via opencode mcp auth devhub, then:\nTOKEN=$(jq -r .access_token ~/.local/share/opencode/mcp-auth.json)\ncurl -s -X POST ${mcpUrl} \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq`,
    [mcpUrl],
  );

  const restartText = useMemo(() => {
    const map: Record<AgentId, string> = {
      opencode: t('docs.mcp.restart.opencode'),
      claude: t('docs.mcp.restart.claude'),
      cursor: t('docs.mcp.restart.cursor'),
      windsurf: t('docs.mcp.restart.windsurf'),
      vscode: t('docs.mcp.restart.vscode'),
      gemini: t('docs.mcp.restart.gemini'),
    };
    return map[agent];
  }, [agent, t]);

  const verifyCheck = useMemo(() => {
    const map: Record<AgentId, string> = {
      opencode: t('docs.mcp.verify.opencodeCheck'),
      claude: t('docs.mcp.verify.claudeCheck'),
      cursor: t('docs.mcp.verify.cursorCheck'),
      windsurf: t('docs.mcp.verify.windsurfCheck'),
      vscode: t('docs.mcp.verify.vscodeCheck'),
      gemini: t('docs.mcp.verify.geminiCheck'),
    };
    return map[agent];
  }, [agent, t]);

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

          {/* Agent picker — sticky above docs-body */}
          <AgentPicker selected={agent} onSelect={setAgent} />

          <div className="docs-body">
            {/* 00 How it connects — DI MCP (moved from DocsPage overview) */}
            <section id="mcp-how-it-connects" className="docs-section" tabIndex={-1}>
              <h2 className="docs-section-title">{t('docs.hub.diagramTitle', { defaultValue: 'How it connects' })}</h2>
              <p className="docs-step-desc" style={{ marginBottom: 12 }}>
                {t('docs.hub.diagramCaption', {
                  defaultValue: 'Browser & agents → Streamable HTTP → Postgres. Agents and browser share the same API.',
                })}
              </p>
              <figure className="docs-diagram" aria-labelledby="mcp-diagram-title" style={{ marginTop: 8 }}>
                <figcaption id="mcp-diagram-title" className="sr-only">
                  {t('docs.hub.diagramCaption')}
                </figcaption>
                <div className="docs-diagram-card" role="img" aria-label={t('docs.hub.diagramCaption')}>
                  <svg
                    viewBox="0 0 720 140"
                    width="100%"
                    height="140"
                    preserveAspectRatio="xMidYMid meet"
                    aria-hidden="true"
                    className="docs-diagram-svg"
                  >
                    <defs>
                      <marker
                        id="mcp-docs-arrow"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
                      </marker>
                    </defs>
                    <g>
                      <rect x="12" y="36" width="150" height="68" rx="12" fill="var(--bg-elevated)" stroke="var(--border-hairline)" />
                      <text x="87" y="62" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text-primary)" fontFamily="var(--font-sans)">
                        {t('docs.hub.browserLabel', { defaultValue: 'Browser' })}
                      </text>
                      <text x="87" y="80" textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="var(--font-mono)">
                        {t('docs.hub.agentLabel', { defaultValue: 'Agent' })}
                      </text>
                    </g>
                    <line x1="162" y1="70" x2="228" y2="70" stroke="var(--accent)" strokeWidth="1.8" markerEnd="url(#mcp-docs-arrow)" />
                    <g>
                      <rect x="228" y="24" width="264" height="92" rx="12" fill="var(--bg-elevated)" stroke="var(--border-hairline)" />
                      <text x="360" y="58" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text-primary)" fontFamily="var(--font-mono)">
                        {t('docs.hub.mcpLabel', { defaultValue: 'POST /mcp' })}
                      </text>
                      <text x="360" y="76" textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="var(--font-mono)">
                        {t('docs.hub.transportLabel', { defaultValue: 'Streamable HTTP' })}
                      </text>
                      <text x="360" y="92" textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">
                        {mcpUrl}
                      </text>
                    </g>
                    <line x1="492" y1="70" x2="560" y2="70" stroke="var(--accent)" strokeWidth="1.8" markerEnd="url(#mcp-docs-arrow)" />
                    <g>
                      <rect x="560" y="36" width="148" height="68" rx="12" fill="var(--bg-elevated)" stroke="var(--border-hairline)" />
                      <text x="634" y="62" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text-primary)" fontFamily="var(--font-sans)">
                        {t('docs.hub.postgresLabel', { defaultValue: 'Postgres' })}
                      </text>
                      <text x="634" y="80" textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="var(--font-mono)">
                        Postgres
                      </text>
                    </g>
                  </svg>
                  <p className="docs-diagram-meta">
                    <span className="docs-diagram-label">{t('docs.hub.apiUrlLabel', { defaultValue: 'API URL' })}:</span>{' '}
                    <code className="inline-code">{mcpUrl}</code>
                  </p>
                </div>
              </figure>
            </section>

            {/* Phase A — Setup (long page) */}
            <div className="docs-phase-header" aria-hidden="true">
              <span className="docs-phase-kicker">Phase 1 — Setup</span>
              <span className="docs-phase-title">Hubungkan agent ke DevHub</span>
            </div>

            {/* Prereqs */}
            <section id="mcp-prereq" className="docs-prereq" tabIndex={-1}>
              <h2 className="docs-section-title">{t('docs.mcp.toc.prereq')}</h2>
              <ul className="docs-prereq-list">
                {PREREQS.map((p, idx) => {
                  const isFirst = idx === 0;
                  const label = AGENT_META[agent]?.label ?? "OpenCode";
                  const strongText = isFirst ? t("docs.mcp.prereq.agentStrong", { agent: label }) : t(p.strongKey);
                  const descText = isFirst ? t("docs.mcp.prereq.agentDesc", { agent: label }) : t(p.descKey);
                  const strong = strongText === "docs.mcp.prereq.agentStrong" ? `${label} ${t("docs.mcp.prereq.fallbackInstalled")}` : strongText;
                  const desc = descText === "docs.mcp.prereq.agentDesc" ? t(p.descKey) : descText;
                  return (
                    <li key={p.strongKey} className="docs-prereq-item">
                      <span className="docs-prereq-check" aria-hidden="true">
                        <Check size={12} weight="bold" />
                      </span>
                      <span>
                        <strong>{strong}</strong> — {desc}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="docs-step-note" style={{ marginTop: 10 }}>
                Endpoint: <code className="inline-code">POST {mcpUrl}</code>
                {apiUrl ? (
                  <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontSize: 12 }}>
                    ({apiUrl}/mcp — Streamable HTTP, OAuth Bearer — scopes mcp / mcp:read / mcp:write)
                  </span>
                ) : null}
              </p>
            </section>

            {/* 01 OAuth — no key needed */}
            <section id="mcp-key" className="docs-step" tabIndex={-1}>
              <span className="docs-step-num">01</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.keyTitle', { defaultValue: 'Authorize via OAuth' })}</h2>
                <p className="docs-step-desc">
                  No API key needed — OAuth public uses PKCE. Run{' '}
                  <code className="inline-code">opencode mcp auth devhub</code> and log in via the custom form.
                </p>
                <Callout>
                  <span>
                    After <code className="inline-code">opencode mcp auth devhub</code>, token is stored in{' '}
                    <code className="inline-code">~/.local/share/opencode/mcp-auth.json</code> and auto-refreshed.
                  </span>
                </Callout>
              </div>
            </section>

            {/* 02 Project ID */}
            <section id="mcp-project-id" className="docs-step" tabIndex={-1}>
              <span className="docs-step-num">02</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.projectIdTitle')}</h2>
                <p className="docs-step-desc">{t('docs.mcp.projectId.desc')}</p>
                <div className="docs-project-id-row">
                  <span className="docs-project-id-mono" aria-label={t('docs.mcp.projectId.exampleLabel')}>
                    {projectIdExample}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t('docs.mcp.projectId.copyLabel')}
                    leftIcon={
                      copiedPid ? <Check size={12} weight="bold" aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />
                    }
                    onClick={() => void copyPid('a1b2c3d4-e5f6-4a7b-9c0d-1234567890ab')}
                  >
                    {copiedPid ? t('api.workbench.copied') : t('api.workbench.copy')}
                  </Button>
                  <span aria-live="polite" className="sr-only">
                    {copiedPid ? t('api.workbench.copied') : ''}
                  </span>
                </div>
                <p className="docs-step-note">
                  Path: <code className="inline-code">/project/:id</code> — copy the UUID from the header. Keep the dash
                  format, don&apos;t trim.
                </p>
                <Callout>
                  <span>{t('docs.mcp.projectId.tip')}</span>
                </Callout>
              </div>
            </section>

            {/* 03 Env */}
            <section id="mcp-env" className="docs-step" tabIndex={-1}>
              <span className="docs-step-num">03</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.envTitle')}</h2>
                <EnvSwitcher psCode={psEnv} bashCode={bashEnv} />
              </div>
            </section>

            {/* 04 Config — per agent */}
            <section id="mcp-config" className="docs-step" tabIndex={-1}>
              <span className="docs-step-num">04</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.configTitle', { agent: AGENT_META[agent].label })}</h2>
                <p className="docs-step-desc">{t('docs.mcp.agent.configHint')}</p>

                <div
                  key={agent}
                  id={`agent-panel-${agent}`}
                  role="tabpanel"
                  aria-labelledby={`agent-tab-${agent}`}
                  className="docs-section-stack"
                >
                  {snippets[agent].cli ? (
                    <div className="docs-config-card">
                      <div className="docs-config-card-head">
                        <span className="docs-config-card-label">{t('docs.mcp.agent.cliTitle')}</span>
                      </div>
                      <div style={{ padding: 10 }}>
                        <CodeBlock lang="bash" file={agent === 'claude' ? 'Terminal' : undefined} code={snippets[agent].cli!} />
                      </div>
                    </div>
                  ) : null}

                  {snippets[agent].files.map((f) => (
                    <div key={f.file} className="docs-config-card">
                      <div className="docs-config-card-head">
                        <span className="docs-config-card-label">{f.file}</span>
                      </div>
                      <div style={{ padding: 10 }}>
                        <CodeBlock lang={f.lang} file={f.file} code={f.code} />
                      </div>
                    </div>
                  ))}

                  {agent === 'windsurf' ? (
                    <Callout tone="warn">
                      <span style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <Warning size={14} weight="bold" aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>{t('docs.mcp.agent.windsurfWarn')}</span>
                      </span>
                    </Callout>
                  ) : null}

                  <Callout tone="success">
                    <span>
                      <strong>Next:</strong> jalankan <code className="inline-code">opencode mcp auth devhub</code> → browser → login via
                      form custom → token auto-rotated &amp; disimpan di{' '}
                      <code className="inline-code">~/.local/share/opencode/mcp-auth.json</code>. Pastikan{' '}
                      <code className="inline-code">enabled: true</code>.
                    </span>
                  </Callout>
                </div>
              </div>
            </section>

            {/* Phase B — References (still long page, not collapsible) */}
            <div className="docs-phase-header" aria-hidden="true">
              <span className="docs-phase-kicker">Phase 2 — Reference</span>
              <span className="docs-phase-title">Cara kerja &amp; batas</span>
            </div>

            {/* 05 OAuth — public flow */}
            <section id="mcp-oauth" className="docs-step" tabIndex={-1}>
              <span className="docs-step-num">05</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.oauthTitle', { defaultValue: 'OAuth 2.1 PKCE — Public' })}</h2>
                <p className="docs-step-desc">
                  {t('docs.mcp.oauth.desc', {
                    defaultValue: 'OAuth 2.1 PKCE — DevHub is the Authorization Server (PKCE S256 mandatory).',
                  })}
                </p>
                <div className="docs-config-card" style={{ padding: 12 }}>
                  <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                    <strong>Discovery:</strong>{' '}
                    <code className="inline-code">GET /.well-known/oauth-authorization-server</code> &{' '}
                    <code className="inline-code">/.well-known/oauth-protected-resource</code>
                    <br />
                    <strong>Flow:</strong> <code className="inline-code">POST /oauth/register</code> (DCR) →{' '}
                    <code className="inline-code">GET /oauth/authorize?code_challenge</code> (login via form custom) →{' '}
                    <code className="inline-code">POST /oauth/token</code> (code+verifier → access_token 15m + refresh 30d rotation)
                    <br />
                    <strong>MCP:</strong> <code className="inline-code">Authorization: Bearer &lt;access_token&gt;</code>{' '}
                    (scope <code className="inline-code">mcp</code>). <code className="inline-code">WWW-Authenticate</code> hints{' '}
                    <code className="inline-code">resource_metadata</code> on 401.
                  </p>
                </div>
              </div>
            </section>

            {/* 06 Rate limit */}
            <section id="mcp-ratelimit" className="docs-step" tabIndex={-1}>
              <span className="docs-step-num">06</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.ratelimitTitle', { defaultValue: 'Rate Limits' })}</h2>
                <div className="docs-config-card" style={{ padding: 12 }}>
                  <ul style={{ fontSize: 13, lineHeight: 1.6, margin: 0, paddingLeft: 16 }}>
                    <li>
                      <code className="inline-code">/api/v1/*</code> 300/15m per IP
                    </li>
                    <li>
                      <code className="inline-code">/mcp</code> 120/15m per IP + 500/15m per token
                    </li>
                    <li>
                      <code className="inline-code">/auth/*</code> 5–10/15m (login/register/password/forgot)
                    </li>
                    <li>
                      <code className="inline-code">429</code> → <code className="inline-code">RATE_LIMITED</code> (draft-7 headers)
                    </li>
                  </ul>
                </div>
                <p className="docs-step-note">
                  {t('docs.mcp.ratelimit.note', {
                    defaultValue: 'Whiteboard: 50 boards / 1000 elements, 5000 tasks/issues.',
                  })}
                </p>
              </div>
            </section>

            {/* Phase C — Run (long page, sticky) */}
            <div className="docs-phase-header" aria-hidden="true">
              <span className="docs-phase-kicker">Phase 3 — Run</span>
              <span className="docs-phase-title">Restart &amp; verifikasi</span>
            </div>

            {/* 07 Restart */}
            <section id="mcp-restart" className="docs-step" tabIndex={-1}>
              <span className="docs-step-num">07</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.restartTitle', { agent: AGENT_META[agent].label })}</h2>
                <div className="docs-config-card" style={{ padding: 12 }}>
                  <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.55 }}>
                    <Info size={14} weight="bold" aria-hidden="true" style={{ marginTop: 2, color: 'var(--accent)', flexShrink: 0 }} />
                    <span>{restartText}</span>
                  </p>
                </div>
                <ul className="docs-verify-list" aria-label={t('docs.mcp.restart.title')}>
                  <li className="docs-verify-item">
                    <span className="docs-verify-check" aria-hidden="true">
                      <Check size={10} weight="bold" />
                    </span>
                    <span>
                      <strong>OpenCode:</strong> {t('docs.mcp.restart.opencode')}
                    </span>
                  </li>
                  <li className="docs-verify-item">
                    <span className="docs-verify-check" aria-hidden="true">
                      <Check size={10} weight="bold" />
                    </span>
                    <span>
                      <strong>Claude:</strong> {t('docs.mcp.restart.claude')}
                    </span>
                  </li>
                  <li className="docs-verify-item">
                    <span className="docs-verify-check" aria-hidden="true">
                      <Check size={10} weight="bold" />
                    </span>
                    <span>
                      <strong>Cursor:</strong> {t('docs.mcp.restart.cursor')}
                    </span>
                  </li>
                  <li className="docs-verify-item">
                    <span className="docs-verify-check" aria-hidden="true">
                      <Check size={10} weight="bold" />
                    </span>
                    <span>
                      <strong>Windsurf:</strong> {t('docs.mcp.restart.windsurf')}
                    </span>
                  </li>
                  <li className="docs-verify-item">
                    <span className="docs-verify-check" aria-hidden="true">
                      <Check size={10} weight="bold" />
                    </span>
                    <span>
                      <strong>VS Code:</strong> {t('docs.mcp.restart.vscode')}
                    </span>
                  </li>
                  <li className="docs-verify-item">
                    <span className="docs-verify-check" aria-hidden="true">
                      <Check size={10} weight="bold" />
                    </span>
                    <span>
                      <strong>Gemini:</strong> {t('docs.mcp.restart.gemini')}
                    </span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 08 Verify */}
            <section id="mcp-verify" className="docs-step" tabIndex={-1}>
              <span className="docs-step-num">08</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.verifyTitle')}</h2>

                <h3 className="docs-step-subtitle" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                  {t('docs.mcp.verify.checklistTitle')}
                </h3>
                <div className="docs-config-card" style={{ padding: 12 }}>
                  <p style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.55 }}>
                    <Check size={14} weight="bold" aria-hidden="true" style={{ marginTop: 2, color: 'var(--accent)' }} />
                    <span>{verifyCheck}</span>
                  </p>
                </div>
                <ul className="docs-verify-list">
                  <li className="docs-verify-item">
                    <span className="docs-verify-check" aria-hidden="true">
                      <Check size={10} weight="bold" />
                    </span>
                    <span>{t('docs.mcp.verify.opencodeCheck')}</span>
                  </li>
                  <li className="docs-verify-item">
                    <span className="docs-verify-check" aria-hidden="true">
                      <Check size={10} weight="bold" />
                    </span>
                    <span>{t('docs.mcp.verify.claudeCheck')}</span>
                  </li>
                  <li className="docs-verify-item">
                    <span className="docs-verify-check" aria-hidden="true">
                      <Check size={10} weight="bold" />
                    </span>
                    <span>{t('docs.mcp.verify.cursorCheck')}</span>
                  </li>
                  <li className="docs-verify-item">
                    <span className="docs-verify-check" aria-hidden="true">
                      <Check size={10} weight="bold" />
                    </span>
                    <span>{t('docs.mcp.verify.windsurfCheck')}</span>
                  </li>
                  <li className="docs-verify-item">
                    <span className="docs-verify-check" aria-hidden="true">
                      <Check size={10} weight="bold" />
                    </span>
                    <span>{t('docs.mcp.verify.vscodeCheck')}</span>
                  </li>
                  <li className="docs-verify-item">
                    <span className="docs-verify-check" aria-hidden="true">
                      <Check size={10} weight="bold" />
                    </span>
                    <span>{t('docs.mcp.verify.geminiCheck')}</span>
                  </li>
                </ul>

                <h3 className="docs-step-subtitle">{t('docs.mcp.verify.curlLabel')}</h3>
                <p className="docs-step-note">{t('docs.mcp.verify.curlDesc')}</p>
                <CodeBlock lang="bash" code={verifyCurl} />
                <p className="docs-step-note">{t('docs.mcp.verify.toolsHint')}</p>

                <h3 className="docs-step-subtitle">{t('docs.mcp.verify.chipsLabel')}</h3>
                <ul className="docs-chips" aria-label={t('docs.mcp.verify.chipsLabel')}>
                  {MCP_TOOLS.map((tool) => (
                    <li key={tool} className="docs-chip">
                      {tool}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Phase D — Automate (long page) */}
            <div className="docs-phase-header" aria-hidden="true">
              <span className="docs-phase-kicker">Phase 4 — Automate</span>
              <span className="docs-phase-title">Agent auto-sync</span>
            </div>

            {/* 09 Auto prompt — 5 variant tabs */}
            <section id="mcp-auto-prompt" className="docs-step" tabIndex={-1}>
              <span className="docs-step-num">09</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.autoPromptTitle')}</h2>
                <p className="docs-step-desc">
                  Let your agent ask for missing config instead of failing silently. Choose your instruction file — all variants contain the same prerequisite checks, only the filename differs.
                </p>
                <DocsVariantTabs
                  variants={[
                    { id: 'ap-agents', file: 'AGENTS.md', lang: 'Markdown', code: AUTO_PROMPT_VARIANT_SNIPPETS['AGENTS.md']!, labelKey: 'docs.mcp.agentsync.variantAGENTS' },
                    { id: 'ap-claude', file: 'CLAUDE.md', lang: 'Markdown', code: AUTO_PROMPT_VARIANT_SNIPPETS['CLAUDE.md']!, labelKey: 'docs.mcp.agentsync.variantCLAUDE' },
                    { id: 'ap-cursor', file: '.cursorrules', lang: 'Markdown', code: AUTO_PROMPT_VARIANT_SNIPPETS['.cursorrules']!, labelKey: 'docs.mcp.agentsync.variantCursor' },
                    { id: 'ap-windsurf', file: '.windsurfrules', lang: 'Markdown', code: AUTO_PROMPT_VARIANT_SNIPPETS['.windsurfrules']!, labelKey: 'docs.mcp.agentsync.variantWindsurf' },
                    { id: 'ap-copilot', file: '.github/copilot-instructions.md', lang: 'Markdown', code: AUTO_PROMPT_VARIANT_SNIPPETS['.github/copilot-instructions.md']!, labelKey: 'docs.mcp.agentsync.variantCopilot' },
                  ]}
                  commitNoteKey="docs.mcp.autoPrompt.commitNote"
                />
              </div>
            </section>

            {/* 10 Agent sync — 5 variant tabs */}
            <section id="mcp-agentsync" className="docs-step" tabIndex={-1}>
              <span className="docs-step-num">10</span>
              <div className="docs-step-content">
                <h2 className="docs-step-title">{t('docs.mcp.step.agentsyncTitle')}</h2>
                <p className="docs-step-desc">
                  Copy the full sync protocol to your instruction file. All variants share the same hierarchy (project target resolution → milestone resolution → required sync table), only the filename differs.
                </p>
                <DocsVariantTabs
                  variants={[
                    { id: 'as-agents', file: 'AGENTS.md', lang: 'Markdown', code: AGENTS_VARIANT_SNIPPETS['AGENTS.md']!, labelKey: 'docs.mcp.agentsync.variantAGENTS' },
                    { id: 'as-claude', file: 'CLAUDE.md', lang: 'Markdown', code: AGENTS_VARIANT_SNIPPETS['CLAUDE.md']!, labelKey: 'docs.mcp.agentsync.variantCLAUDE' },
                    { id: 'as-cursor', file: '.cursorrules', lang: 'Markdown', code: AGENTS_VARIANT_SNIPPETS['.cursorrules']!, labelKey: 'docs.mcp.agentsync.variantCursor' },
                    { id: 'as-windsurf', file: '.windsurfrules', lang: 'Markdown', code: AGENTS_VARIANT_SNIPPETS['.windsurfrules']!, labelKey: 'docs.mcp.agentsync.variantWindsurf' },
                    { id: 'as-copilot', file: '.github/copilot-instructions.md', lang: 'Markdown', code: AGENTS_VARIANT_SNIPPETS['.github/copilot-instructions.md']!, labelKey: 'docs.mcp.agentsync.variantCopilot' },
                  ]}
                  commitNoteKey="docs.mcp.agentsync.commitNote"
                />
                <div style={{ marginTop: 12 }}>
                  <CodeBlock
                    lang="PowerShell"
                    code={`$env:DEVHUB_PROJECT_ID = "<your-project-uuid>" # optional — default sync target\n# then: opencode mcp auth devhub`}
                  />
                </div>

                <h3 className="docs-step-subtitle">{t('docs.mcp.lifecycle.title')}</h3>
                <p className="docs-step-note" style={{ marginBottom: 10 }}>
                  Collapsed by default — expand what you need. Keep tasks granular, verify with{' '}
                  <code className="inline-code">project_state</code> before creating.
                </p>

                <LifecycleAccordion title={t('docs.mcp.lifecycle.task')} code={TASK_LIFECYCLE} />
                <LifecycleAccordion title={t('docs.mcp.lifecycle.issue')} code={ISSUE_LIFECYCLE} />
                <LifecycleAccordion title={t('docs.mcp.lifecycle.decision')} code={DECISION_LIFECYCLE} />
                <LifecycleAccordion title={t('docs.mcp.lifecycle.whiteboard')} code={WHITEBOARD_LIFECYCLE} />
                <LifecycleAccordion title={t('docs.mcp.lifecycle.api')} code={API_LIFECYCLE} />
                <LifecycleAccordion title={t('docs.mcp.lifecycle.milestone')} code={MILESTONE_LIFECYCLE} />
              </div>
            </section>

            {/* Troubleshooting — matrix 2 kolom */}
            <section id="mcp-troubleshooting" className="docs-troubleshooting" tabIndex={-1}>
              <h2 className="docs-section-title">{t('docs.mcp.toc.troubleshooting')}</h2>
              <p className="docs-step-note" style={{ marginBottom: 12 }}>
                {t('docs.mcp.trouble.intro', { defaultValue: 'Quick diagnosis — find your symptom on the left, apply the fix on the right.' })}
              </p>
              <div className="docs-troubleshooting-wrap" role="region" aria-label={t('docs.mcp.trouble.title', { defaultValue: 'Troubleshooting matrix' })}>
                <table className="docs-troubleshooting-table">
                  <caption className="sr-only">{t('docs.mcp.trouble.title', { defaultValue: 'Troubleshooting matrix' })}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('docs.mcp.trouble.tableSymptom')}</th>
                      <th scope="col">{t('docs.mcp.trouble.tableFix')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr aria-label={`${t('docs.mcp.trouble.row401AllSymptom')} — ${t('docs.mcp.trouble.row401AllFix')}`}>
                      <td data-label={t('docs.mcp.trouble.tableSymptom')}>
                        <strong>{t('docs.mcp.trouble.row401AllSymptom')}</strong>
                      </td>
                      <td data-label={t('docs.mcp.trouble.tableFix')}>{t('docs.mcp.trouble.row401AllFix')}</td>
                    </tr>
                    <tr aria-label={`${t('docs.mcp.trouble.row401ScopedSymptom')} — ${t('docs.mcp.trouble.row401ScopedFix')}`}>
                      <td>
                        <strong>{t('docs.mcp.trouble.row401ScopedSymptom')}</strong>
                      </td>
                      <td>{t('docs.mcp.trouble.row401ScopedFix')}</td>
                    </tr>
                    <tr aria-label={`${t('docs.mcp.trouble.row400Symptom')} — ${t('docs.mcp.trouble.row400Fix')}`}>
                      <td>
                        <strong>{t('docs.mcp.trouble.row400Symptom')}</strong>
                      </td>
                      <td>{t('docs.mcp.trouble.row400Fix')}</td>
                    </tr>
                    <tr aria-label={`${t('docs.mcp.trouble.rowProjectIdSymptom')} — ${t('docs.mcp.trouble.rowProjectIdFix')}`}>
                      <td>
                        <strong>{t('docs.mcp.trouble.rowProjectIdSymptom')}</strong>
                      </td>
                      <td>{t('docs.mcp.trouble.rowProjectIdFix')}</td>
                    </tr>
                    <tr aria-label={`${t('docs.mcp.trouble.rowToolsNotListedSymptom')} — ${t('docs.mcp.trouble.rowToolsNotListedFix')}`}>
                      <td>
                        <strong>{t('docs.mcp.trouble.rowToolsNotListedSymptom')}</strong>
                      </td>
                      <td>{t('docs.mcp.trouble.rowToolsNotListedFix')}</td>
                    </tr>
                    <tr aria-label={`${t('docs.mcp.trouble.rowNotVisibleSymptom')} — ${t('docs.mcp.trouble.rowNotVisibleFix')}`}>
                      <td>
                        <strong>{t('docs.mcp.trouble.rowNotVisibleSymptom')}</strong>
                      </td>
                      <td>{t('docs.mcp.trouble.rowNotVisibleFix')}</td>
                    </tr>
                    <tr aria-label={`${t('docs.mcp.trouble.rowCursorCeilingSymptom')} — ${t('docs.mcp.trouble.rowCursorCeilingFix')}`}>
                      <td>
                        <strong>{t('docs.mcp.trouble.rowCursorCeilingSymptom')}</strong>
                      </td>
                      <td>{t('docs.mcp.trouble.rowCursorCeilingFix')}</td>
                    </tr>
                    <tr aria-label={`${t('docs.mcp.trouble.rowWindsurfUrlSymptom')} — ${t('docs.mcp.trouble.rowWindsurfUrlFix')}`}>
                      <td>
                        <strong>{t('docs.mcp.trouble.rowWindsurfUrlSymptom')}</strong>{' '}
                        <span className="badge badge-warn" style={{ marginLeft: 6 }}>
                          CRITICAL
                        </span>
                      </td>
                      <td>{t('docs.mcp.trouble.rowWindsurfUrlFix')}</td>
                    </tr>
                    <tr aria-label={`${t('docs.mcp.trouble.rowSseDeprecatedSymptom')} — ${t('docs.mcp.trouble.rowSseDeprecatedFix')}`}>
                      <td>
                        <strong>{t('docs.mcp.trouble.rowSseDeprecatedSymptom')}</strong>
                      </td>
                      <td>{t('docs.mcp.trouble.rowSseDeprecatedFix')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Callout tone="warn">
                <span style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <Warning size={14} weight="bold" aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>
                    <strong>400 on tool call:</strong> invalid args per zod schema — run{' '}
                    <code className="inline-code">project_state</code> first to see exact field names. Duplicate tasks?
                    read-then-write. Poll interval is 5s while tab visible — hard-refresh if stale.
                  </span>
                </span>
              </Callout>
            </section>

            <section className="docs-next">
              <h2 className="docs-section-title">{t('docs.mcp.nextSteps')}</h2>
              <div className="docs-next-grid">
                <Link
                  to="/connected"
                  className="docs-card"
                  aria-label={`${t('docs.mcp.apiKeysTitle')} — ${t('docs.mcp.apiKeysSub')}`}
                >
                  <Key size={18} weight="duotone" aria-hidden="true" />
                  <span className="docs-card-text">
                    <span className="docs-card-title">{t('docs.mcp.apiKeysTitle')}</span>
                    <span className="docs-card-sub">{t('docs.mcp.apiKeysSub')}</span>
                  </span>
                  <ArrowSquareOut size={14} className="docs-card-arrow" aria-hidden="true" />
                </Link>
              </div>
            </section>
          </div>
        </div>
        <DocsToc items={tocItems} />
      </div>
    </div>
  );
}

