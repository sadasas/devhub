import { DocsNav } from './DocsNav';
import { DocsToc, type DocsTocItem } from './DocsToc';

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  desc: string;
  auth?: boolean;
}

interface ApiGroup {
  id: string;
  title: string;
  desc: string;
  endpoints: Endpoint[];
}

const GROUPS: ApiGroup[] = [
  {
    id: 'health',
    title: 'Health',
    desc: 'Liveness probe for the server.',
    endpoints: [
      { method: 'GET', path: '/api/health', desc: 'Returns ok when the server is up.', auth: false },
    ],
  },
  {
    id: 'auth',
    title: 'Auth',
    desc: 'Session-based sign up and sign in.',
    endpoints: [
      { method: 'POST', path: '/api/auth/register', desc: 'Create an account. Rate limited.', auth: false },
      { method: 'POST', path: '/api/auth/login', desc: 'Log in and start a session. Rate limited.', auth: false },
      { method: 'POST', path: '/api/auth/logout', desc: 'End the current session.' },
      { method: 'GET', path: '/api/auth/me', desc: 'Return the current user.' },
    ],
  },
  {
    id: 'keys',
    title: 'API Keys',
    desc: 'Per-user keys that authenticate MCP requests. The raw key is shown only once at creation.',
    endpoints: [
      { method: 'GET', path: '/api/keys', desc: 'List your API keys.' },
      { method: 'POST', path: '/api/keys', desc: 'Create an API key.' },
      { method: 'DELETE', path: '/api/keys/:id', desc: 'Revoke an API key.' },
    ],
  },
  {
    id: 'projects',
    title: 'Projects',
    desc: 'Create, update, back up, and restore projects.',
    endpoints: [
      { method: 'GET', path: '/api/projects', desc: 'List projects you can access.' },
      { method: 'GET', path: '/api/projects/stats', desc: 'Aggregate stats across projects.' },
      { method: 'POST', path: '/api/projects', desc: 'Create a project.' },
      { method: 'GET', path: '/api/projects/:projectId', desc: 'Project details.' },
      { method: 'PATCH', path: '/api/projects/:projectId', desc: 'Update name, description, status, or PRD.' },
      { method: 'DELETE', path: '/api/projects/:projectId', desc: 'Delete a project permanently.' },
      { method: 'GET', path: '/api/projects/:projectId/state', desc: 'Full project state: tasks, issues, decisions, schema.' },
      { method: 'PUT', path: '/api/projects/:projectId/state', desc: 'Replace the full project state.' },
      { method: 'GET', path: '/api/projects/:projectId/export', desc: 'Export the project as a JSON document.' },
      { method: 'POST', path: '/api/projects/import', desc: 'Import a previously exported JSON document.' },
    ],
  },
  {
    id: 'teams',
    title: 'Teams',
    desc: 'Collaborate with other people on shared projects.',
    endpoints: [
      { method: 'GET', path: '/api/teams', desc: 'List your teams.' },
      { method: 'POST', path: '/api/teams', desc: 'Create a team.' },
      { method: 'GET', path: '/api/teams/invitations', desc: 'Incoming invitations for you.' },
      { method: 'GET', path: '/api/teams/:teamId', desc: 'Team details.' },
      { method: 'PATCH', path: '/api/teams/:teamId', desc: 'Update team name or description.' },
      { method: 'DELETE', path: '/api/teams/:teamId', desc: 'Delete a team.' },
      { method: 'GET', path: '/api/teams/:teamId/members', desc: 'List team members.' },
      { method: 'PATCH', path: '/api/teams/:teamId/members/:userId', desc: 'Change a member’s role.' },
      { method: 'DELETE', path: '/api/teams/:teamId/members/:userId', desc: 'Remove a member.' },
      { method: 'GET', path: '/api/teams/:teamId/invitations', desc: 'List invitations the team sent.' },
      { method: 'POST', path: '/api/teams/:teamId/invitations', desc: 'Invite a user by email.' },
      { method: 'POST', path: '/api/teams/:teamId/invitations/:invitationId/accept', desc: 'Accept an invitation.' },
      { method: 'DELETE', path: '/api/teams/:teamId/invitations/:invitationId', desc: 'Revoke a pending invitation.' },
    ],
  },
  {
    id: 'public',
    title: 'Public',
    desc: 'Read-only endpoints for sharing a project with anyone, no login required. Only projects with visibility set to public are served; everything else returns 404.',
    endpoints: [
      { method: 'GET', path: '/api/public/projects/:projectId', desc: 'Project meta (name, description, status, PRD, team).', auth: false },
      { method: 'GET', path: '/api/public/projects/:projectId/state', desc: 'Full project state for public viewing.', auth: false },
    ],
  },
  {
    id: 'mcp',
    title: 'MCP Transport',
    desc: 'The Model Context Protocol endpoint used by AI agents. Authenticated with an API key, not a session cookie.',
    endpoints: [{ method: 'POST', path: '/mcp', desc: 'Streamable HTTP endpoint exposing 15 tools.', auth: true }],
  },
];

const TOC_ITEMS: DocsTocItem[] = GROUPS.map((g) => ({ id: g.id, label: g.title }));

export function ApiDocsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">API Reference</h1>
          <p className="page-subtitle">
            Every endpoint returns JSON. Auth endpoints use a session cookie, the MCP endpoint uses a
            per-user API key, and public endpoints require no authentication.
          </p>
        </div>
      </header>

      <div className="docs-grid">
        <div className="docs-main">
          <DocsNav />
          <div className="docs-body">
            {GROUPS.map((group) => (
              <section key={group.id} id={group.id} className="docs-section">
                <h2 className="docs-section-title">{group.title}</h2>
                <p className="docs-step-desc">{group.desc}</p>
                <ul className="docs-endpoints">
                  {group.endpoints.map((ep) => (
                    <li key={ep.method + ep.path} className="docs-endpoint">
                      <span className={`docs-method docs-method-${ep.method.toLowerCase()}`}>{ep.method}</span>
                      <code className="docs-path">{ep.path}</code>
                      <span className="docs-endpoint-desc">
                        {ep.desc}
                        {ep.auth === false ? (
                          <span className="docs-endpoint-tag">public</span>
                        ) : (
                          ep.auth && <span className="docs-endpoint-tag">api key</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
        <DocsToc items={TOC_ITEMS} />
      </div>
    </div>
  );
}