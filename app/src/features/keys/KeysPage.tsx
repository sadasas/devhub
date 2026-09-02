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
      {apps === null && !error ? (
        <div className="data-list" role="status" aria-live="polite" aria-busy="true" aria-label="Loading connected apps">
          <span className="sr-only">Loading connected apps…</span>
          <div aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="data-row" style={{ height: 64 }}>
                <div className="data-row-main" style={{ gap: 4 }}>
                  <div className="data-row-title">
                    <Skeleton className="skeleton-row" style={{ width: '45%' }} />
                    <Skeleton style={{ width: 8, height: 8, borderRadius: 999 }} />
                  </div>
                  <div className="data-row-meta">
                    <Skeleton className="skeleton-row-xs" style={{ width: 88 }} />
                    <Skeleton className="skeleton-row-sm" style={{ width: 120 }} />
                  </div>
                  <div className="data-row-meta">
                    <Skeleton className="skeleton-row-sm" style={{ width: '60%', height: 11 }} />
                  </div>
                </div>
                <div className="data-row-side">
                  <Skeleton className="skeleton-row-sm" style={{ width: 56, height: 28, borderRadius: 8 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : apps !== null && apps.length === 0 ? (
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
      ) : apps !== null && apps.length > 0 ? (
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
                <Button size="sm" variant="ghost" loading={revoking === app.clientId} onClick={() => void onRevoke(app.clientId)} leftIcon={<Trash size={13} aria-hidden="true" />}>
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="auth-banner" style={{ marginTop: 24 }}>
        <ShieldCheck size={14} weight="duotone" aria-hidden="true" />
        <p>
          MCP: <code>Authorization: Bearer &lt;access_token&gt;</code> (scopes <code>mcp</code> / <code>mcp:read</code> / <code>mcp:write</code>) — next refresh in 15m.
        </p>
      </div>
    </div>
  );
}

