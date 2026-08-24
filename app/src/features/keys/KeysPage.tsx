import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Check, CircleNotch, Clock, Copy, Key, Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { McpKey, McpKeyCreated } from '../../lib/types';
import { formatDate, formatRelative } from '../../lib/utils';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { NewKeyModal } from './NewKeyModal';

// Mirror server cap (audit 2026-08b, KEYS-1): maksimal 10 key aktif per user
const MAX_KEYS = 10;
// Harus sama dengan default perPage server (pola GitHub settings/tokens)
const PER_PAGE = 5;

interface RevokeTarget {
  id: string;
  name: string;
  prefix: string;
}

function KeyCopyButton({
  label,
  title,
  copied,
  loading,
  onCopy,
}: {
  label: string;
  title: string;
  copied: boolean;
  loading: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      className="key-copy-btn"
      aria-label={label}
      title={copied ? 'Copied' : title}
      disabled={loading}
      onClick={onCopy}
    >
      {loading ? (
        <CircleNotch className="btn-spinner" size={12} weight="bold" aria-hidden="true" />
      ) : copied ? (
        <Check size={12} weight="bold" aria-hidden="true" />
      ) : (
        <Copy size={12} aria-hidden="true" />
      )}
    </button>
  );
}

export function KeysPage() {
  const { t } = useTranslation('account');
  const [keys, setKeys] = useState<McpKey[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [copyLoadingId, setCopyLoadingId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<{ id: string; message: string } | null>(null);
  const { copied, copy } = useCopyFeedback();

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .listKeys({ page })
      .then((res) => {
        if (cancelled) return;
        // Halaman kosong (mis. key terakhir di halaman itu di-revoke) → mundur
        if (res.keys.length === 0 && page > 1) {
          setPage(Math.max(1, Math.ceil(res.total / res.perPage)));
          return;
        }
        setKeys(res.keys);
        setTotal(res.total);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, t('keys.error.load')));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, page, t]);

  function onCreated(key: McpKeyCreated) {
    if (page === 1) {
      setKeys((prev) => [key, ...(prev ?? [])].slice(0, PER_PAGE));
      setTotal((t) => t + 1);
    } else {
      // Key baru selalu landa di halaman pertama (urutan created_at DESC)
      setPage(1);
    }
  }

  function openRevoke(key: McpKey) {
    setConfirming(false);
    setRevokeError(null);
    setRevokeTarget({ id: key.id, name: key.name, prefix: key.prefix });
  }

  async function onRevoke() {
    if (!revokeTarget) return;
    setRevokeError(null);
    setRevoking(true);
    try {
      await api.revokeKey(revokeTarget.id);
      // List hanya menampilkan key aktif: revoked langsung hilang dari daftar
      const remaining = (keys ?? []).filter((k) => k.id !== revokeTarget.id);
      if (remaining.length === 0 && page > 1) {
        setPage((p) => p - 1);
      } else {
        setKeys(remaining);
        setTotal((t) => Math.max(0, t - 1));
      }
      setRevokeTarget(null);
    } catch (err) {
      setRevokeError(getErrorMessage(err, t('keys.error.revoke')));
    } finally {
      setRevoking(false);
    }
  }

  async function onCopyKey(key: McpKey) {
    setCopyLoadingId(key.id);
    setCopyError(null);
    try {
      // Reveal & copy full key bila tersimpan terenkripsi; key lama hanya prefix
      const text = key.revealable ? await api.revealKey(key.id) : key.prefix;
      const ok = await copy(text);
      if (ok) setCopiedKeyId(key.id);
    } catch (err) {
      setCopyError({
        id: key.id,
        message: getErrorMessage(err, t('keys.error.copy')),
      });
    } finally {
      setCopyLoadingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('keys.title')}</h1>
          <p className="page-subtitle">
            {t('keys.subtitle')}
          </p>
        </div>
        <Button leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setNewOpen(true)}>
          {t('keys.newKey')}
        </Button>
      </header>

      {error ? (
        <div className="form-stack">
          <InlineError>{error}</InlineError>
          <Button variant="secondary" size="sm" onClick={() => setAttempt((a) => a + 1)}>
            {t('common:action.tryAgain')}
          </Button>
        </div>
      ) : keys === null ? (
        <div className="data-list" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="data-row">
              <div className="data-row-main">
                <div className="data-row-title">
                  <Skeleton className="skeleton-row" style={{ width: '45%' }} />
                </div>
                <div className="data-row-meta">
                  <Skeleton className="skeleton-row-xs" />
                </div>
                <div className="data-row-meta">
                  <Skeleton className="skeleton-row-sm" />
                </div>
              </div>
              <div className="data-row-side">
                <Skeleton className="skeleton-row-sm" style={{ width: 56 }} />
              </div>
            </div>
          ))}
        </div>
      ) : keys.length === 0 ? (
        <>
          <div className="page-empty">
            <EmptyState
              icon={<Key size={22} />}
              title={t('keys.empty.title')}
              description={t('keys.empty.description')}
              action={
                <>
                  <Button
                    leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />}
                    onClick={() => setNewOpen(true)}
                  >
                    {t('keys.newKey')}
                  </Button>
                  <Link className="btn btn-ghost btn-md" to="/docs/mcp">
                    {t('keys.empty.readGuide')}
                  </Link>
                </>
              }
            />
          </div>
          <KeysGuide />
        </>
      ) : (
        <>
          <div className="data-list-header">
            <span className="data-list-count">
              {t('keys.count', { count: total, max: MAX_KEYS, total })}
            </span>
            {totalPages > 1 && (
              <nav className="pager" aria-label={t('keys.paginationAria')}>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t('keys.pager.previous')}
                </Button>
                <span className="pager-status">
                  {t('keys.pager.status', { page, total: totalPages })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('keys.pager.next')}
                </Button>
              </nav>
            )}
          </div>
          <div className="data-list">
            {keys.map((k) => {
              const keyCopied = copied && copiedKeyId === k.id;
              const copyLoading = copyLoadingId === k.id;
              const rowCopyError = copyError?.id === k.id ? copyError.message : null;
              return (
                <div key={k.id} className="data-row">
                  <div className="data-row-main">
                    <div className="data-row-title">
                      <span className="row-title-text">{k.name || t('keys.untitled')}</span>
                      <span className="key-status-dot" title={t('keys.status.active')} aria-label={t('keys.status.activeKeyAria')} />
                    </div>
                    <div className="data-row-meta">
                      <span className="key-prefix">
                        <code>{k.prefix}…</code>
                        <KeyCopyButton
                          label={k.revealable ? t('keys.copyButton.keyLabel', { prefix: k.prefix }) : t('keys.copyButton.prefixLabel', { prefix: k.prefix })}
                          title={
                            k.revealable
                              ? t('keys.copyButton.revealTitle')
                              : t('keys.copyButton.prefixTitle')
                          }
                          copied={keyCopied}
                          loading={copyLoading}
                          onCopy={() => void onCopyKey(k)}
                        />
                      </span>
                    </div>
                    <div className="data-row-meta">
                      <span>{t('keys.created', { date: formatDate(k.createdAt) })}</span>
                      <span className="key-last-used">
                        <Clock size={12} weight="duotone" aria-hidden="true" />
                        {k.lastUsedAt ? formatRelative(k.lastUsedAt) : <em>{t('keys.never')}</em>}
                      </span>
                    </div>
                    {rowCopyError && <div className="data-row-meta text-danger">{rowCopyError}</div>}
                  </div>
                  <div className="data-row-side">
                    <Button size="sm" variant="ghost" onClick={() => openRevoke(k)}>
                      {t('keys.revoke')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="field-helper keys-inline-hint">
            {t('keys.inlineHint')}{' '}
            <Link to="/docs/mcp">{t('keys.mcpGuideLink')}</Link>.
          </p>
        </>
      )}

      <NewKeyModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={onCreated}
        activeCount={total}
      />

      <Modal
        open={revokeTarget !== null}
        title={t('keys.revokeModal.title')}
        onClose={() => setRevokeTarget(null)}
        width="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirming(false);
                setRevokeTarget(null);
              }}
            >
              {t('common:action.cancel')}
            </Button>
            {confirming ? (
              <Button variant="danger" loading={revoking} onClick={() => void onRevoke()}>
                {t('keys.revokeModal.confirm')}
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                {t('keys.revoke')}
              </Button>
            )}
          </>
        }
      >
        <div className="form-stack">
          <p>
            {t('keys.revokeModal.body', {
              name: revokeTarget?.name || t('keys.untitled'),
              prefix: `${revokeTarget?.prefix}…`,
            })}
          </p>
          {revokeError && <InlineError>{revokeError}</InlineError>}
        </div>
      </Modal>
    </div>
  );
}

function KeysGuide() {
  const { t } = useTranslation('account');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const curlSnippet = `curl -X POST ${origin}/mcp \\
  -H "Authorization: Bearer $DEVHUB_MCP_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
  const envSnippet = `DEVHUB_MCP_KEY="devhub_<your-key>"`;

  return (
    <section className="keys-guide" aria-label={t('keys.guide.title')}>
      <h2 className="keys-guide-title">{t('keys.guide.title')}</h2>

      <div className="auth-banner">
        <Key size={14} weight="duotone" aria-hidden="true" />
        <p>
          {t('keys.guide.bannerPrefix')} <code>Authorization</code>{' '}
          {t('keys.guide.bannerSuffix')} <code>Authorization: Bearer $DEVHUB_MCP_KEY</code>
        </p>
      </div>

      <div className="keys-guide-grid">
        <CodeBlock
          title={t('keys.guide.quickStartTitle')}
          description={t('keys.guide.quickStartDesc')}
          copyAria={t('keys.guide.quickStartCopyAria')}
          code={curlSnippet}
        />
        <CodeBlock
          title={t('keys.guide.envVarTitle')}
          description={t('keys.guide.envVarDesc')}
          copyAria={t('keys.guide.envVarCopyAria')}
          code={envSnippet}
        />
      </div>

      <Link className="keys-guide-link" to="/docs/mcp">
        {t('keys.fullGuide')}
      </Link>
    </section>
  );
}

function CodeBlock({
  title,
  description,
  copyAria,
  code,
}: {
  title: string;
  description: string;
  copyAria: string;
  code: string;
}) {
  const { t } = useTranslation('account');
  const { copied, copy } = useCopyFeedback();
  return (
    <div className="keys-guide-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="code-block">
        <pre>
          <code>{code}</code>
        </pre>
        <button
          type="button"
          className="code-copy-btn"
          aria-label={copyAria}
          title={copied ? t('keys.copied') : t('keys.copy')}
          onClick={() => void copy(code)}
        >
          {copied ? <Check size={13} weight="bold" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
