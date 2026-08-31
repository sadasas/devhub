import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ShieldCheck, Trash, Clock, Key } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { formatRelative } from '../../lib/utils';

interface AuthorizedApp {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  scope: string;
  resource: string;
  tokenPrefix: string;
  expiresAt: string;
  createdAt: string;
}

export function KeysPage() {
  const [apps, setApps] = useState<AuthorizedApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.authorizedApps().then((res) => {
      if (!cancelled) setApps(res.apps);
    }).catch((err) => {
      if (!cancelled) setError(getErrorMessage(err, 'Failed to load'));
    });
    return () => { cancelled = true; };
  }, []);

  async function onRevoke(clientId: string) {
    if (!confirm('Revoke this app? Token will stop working.')) return;
    setRevoking(clientId);
    try {
      await api.revokeAuthorizedApp(clientId);
      setApps((prev) => (prev ?? []).filter((a) => a.clientId !== clientId));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to revoke'));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Connected MCP</h1>
          <p className="page-subtitle">
            OAuth 2.1 PKCE — apps authorized via <code className="inline-code">opencode mcp auth devhub</code>. Tokens auto-refresh, 15m expiry.
          </p>
        </div>
      </header>
      {error && <InlineError>{error}</InlineError>}
      {apps === null ? (
        <div className="data-list" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="data-row">
              <Skeleton style={{ width: '40%' }} />
            </div>
          ))}
        </div>
      ) : apps.length === 0 ? (
        <div className="page-empty">
          <EmptyState
            icon={<ShieldCheck size={22} />}
            title="No connected apps"
            description="Run opencode mcp auth devhub and log in via the custom form to connect your first agent."
            action={
              <Link className="btn btn-primary btn-md" to="/docs/mcp">
                <Key size={14} weight="bold" aria-hidden="true" style={{ marginRight: 6 }} />
                OAuth Guide
              </Link>
            }
          />
        </div>
      ) : (
        <div className="data-list">
          <div className="data-list-header">
            <span className="data-list-count">{apps.length} connected app{apps.length !== 1 ? 's' : ''}</span>
          </div>
          {apps.map((app) => (
            <div key={app.clientId} className="data-row">
              <div className="data-row-main">
                <div className="data-row-title">
                  <span className="row-title-text">{app.clientName}</span>
                  <span className="key-status-dot" title="Active" />
                </div>
                <div className="data-row-meta">
                  <code>{app.tokenPrefix}</code>
                  <span>· {app.scope}</span>
                  <span className="key-last-used">
                    <Clock size={12} weight="duotone" aria-hidden="true" />
                    expires {formatRelative(app.expiresAt)}
                  </span>
                </div>
                <div className="data-row-meta" style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {app.redirectUris[0]} · {new Date(app.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="data-row-side">
                <Button size="sm" variant="ghost" loading={revoking === app.clientId} onClick={() => void onRevoke(app.clientId)} leftIcon={<Trash size={12} aria-hidden="true" />}>
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="auth-banner" style={{ marginTop: 24 }}>
        <ShieldCheck size={14} weight="duotone" aria-hidden="true" />
        <p>
          MCP: <code>Authorization: Bearer &lt;access_token&gt;</code> (scope <code>mcp</code>) — next refresh in 15m.
        </p>
      </div>
    </div>
  );
}

