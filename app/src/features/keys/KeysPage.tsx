import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ShieldCheck, Trash, Clock, Key } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { DataErrorState } from '../../components/DataErrorState';
import { Skeleton } from '../../components/Skeleton';
import { formatExpiry } from '../../lib/utils';

function useNowTick(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

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
  const { t } = useTranslation(["account", "common"]);
  const now = useNowTick();
  const [apps, setApps] = useState<AuthorizedApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadErrorRaw, setLoadErrorRaw] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadErrorRaw(null);
    api.authorizedApps().then((res) => {
      if (!cancelled) setApps(res.apps);
    }).catch((err) => {
      if (!cancelled) setError(getErrorMessage(err, 'Failed to load'));
      if (!cancelled) setLoadErrorRaw(err);
    });
    return () => { cancelled = true; };
  }, [attempt]);

  async function onRevoke(clientId: string) {
    if (!confirm(t("account:keys.revokeConfirm"))) return;
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
      {/* Flat content card wraps page content; content stays inside the card body. */}
      <article className="pcard">
        <div className="pcard-body">
          <div className="narrow-center">
          <header className="page-header">
            <div>
              <h1 className="page-title">{t("account:keys.title")}</h1>
              <p className="page-subtitle">
                {t("account:keys.subtitle")}
              </p>
            </div>
            {apps !== null && !error && apps.length > 0 && (
              <span className="data-list-count">{t("account:keys.connectedCount", { count: apps.length })}</span>
            )}
          </header>
          {error ? (apps === null ? <DataErrorState error={loadErrorRaw ?? error} onRetry={() => { setError(null); setLoadErrorRaw(null); setAttempt((a) => a + 1); }} /> : <InlineError>{error}</InlineError>) : null}
      {apps === null && !error ? (
        <div className="data-list" role="status" aria-live="polite" aria-busy="true" aria-label={t("account:keys.loading")}>
          <span className="sr-only">{t("account:keys.loading")}</span>
          <div aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="data-row" style={{ height: 64 }}>
                <div className="data-row-main" style={{ gap: 4 }}>
                  <div className="data-row-title">
                    <Skeleton className="skeleton-row" style={{ width: '45%' }} />
                    <Skeleton style={{ width: 7, height: 7, borderRadius: 999, marginLeft: 8, flexShrink: 0 }} />
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
                  <Skeleton style={{ width: 96, height: 32, borderRadius: 8 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : apps !== null && apps.length === 0 ? (
        <div className="page-empty">
          <EmptyState
            icon={<ShieldCheck size={22} />}
            title={t("account:keys.empty.title")}
            description={t("account:keys.empty.description")}
            action={
              <Link className="btn btn-primary btn-md" to="/docs/mcp">
                <Key size={14} weight="bold" aria-hidden="true" style={{ marginRight: 6 }} /> {t("account:keys.empty.readGuide")} </Link>
            }
          />
        </div>
      ) : apps !== null && apps.length > 0 ? (
        <div className="data-list">
          {apps.map((app) => (
            <div key={app.clientId} className="data-row">
              <div className="data-row-main">
                <div className="data-row-title">
                  <span className="row-title-text">{app.clientName}</span>
                  <span className="key-status-dot" title={t("account:keys.active")} />
                </div>
                <div className="data-row-meta">
                  <code>{app.tokenPrefix}</code>
                  <span>· {app.scope}</span>
                  {(() => {
                    const diffMs = Date.parse(app.expiresAt) - now;
                    const isExpired = diffMs <= 0;
                    const isExpiringSoon = diffMs > 0 && diffMs < 2 * 60_000;
                    const expiryLabel = formatExpiry(app.expiresAt, now);
                    return (
                      <span
                        className="key-last-used"
                        title={new Date(app.expiresAt).toLocaleString()}
                        style={isExpired ? { color: 'var(--danger)' } : isExpiringSoon ? { color: 'var(--warning)' } : undefined}
                      >
                        <Clock size={12} weight="duotone" aria-hidden="true" />
                        {isExpired ? expiryLabel : t('common:time.expiresIn', { time: expiryLabel })}
                      </span>
                    );
                  })()}
                </div>
                <div className="data-row-meta" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {app.redirectUris[0]} · {new Date(app.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="data-row-side">
                <Button size="sm" variant="danger" loading={revoking === app.clientId} onClick={() => void onRevoke(app.clientId)} leftIcon={<Trash size={13} aria-hidden="true" />}>{t("account:keys.revoke")}</Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="auth-banner" style={{ marginTop: 24 }}>
        <ShieldCheck size={14} weight="duotone" aria-hidden="true" />
        <p>
          MCP: <code>Authorization: Bearer &lt;access_token&gt;</code> (scopes <code>mcp</code> / <code>mcp:read</code> / <code>mcp:write</code>) — {t('common:time.tokensAutoRefresh')}
        </p>
      </div>
          </div>
        </div>
      </article>
    </div>
  );
}

