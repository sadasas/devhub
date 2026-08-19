import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Check, CircleNotch, Clock, Copy, Key, Plus } from '@phosphor-icons/react';
import { ApiError, api } from '../../lib/api';
import type { McpKey, McpKeyCreated } from '../../lib/types';
import { formatDate, formatRelative } from '../../lib/utils';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { NewKeyModal } from './NewKeyModal';

// Mirror server cap (audit 2026-08b, KEYS-1): maksimal 10 key aktif per user
const MAX_KEYS = 10;

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
  const [keys, setKeys] = useState<McpKey[] | null>(null);
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
    setKeys(null);
    setError(null);
    api
      .listKeys()
      .then((list) => {
        if (!cancelled) setKeys(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load API keys.');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function onCreated(key: McpKeyCreated) {
    setKeys((prev) => [key, ...(prev ?? [])]);
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
      setKeys((prev) =>
        (prev ?? []).map((k) =>
          k.id === revokeTarget.id ? { ...k, revokedAt: new Date().toISOString() } : k,
        ),
      );
      setRevokeTarget(null);
    } catch (err) {
      setRevokeError(err instanceof ApiError ? err.message : 'Failed to revoke key.');
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
        message: err instanceof ApiError ? err.message : 'Failed to copy key.',
      });
    } finally {
      setCopyLoadingId(null);
    }
  }

  const activeCount = keys?.filter((k) => !k.revokedAt).length ?? 0;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">API keys</h1>
          <p className="page-subtitle">
            Keys for AI coding agents to read and update your projects over MCP. The full key is
            shown only once when you create it.
          </p>
        </div>
        <Button leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setNewOpen(true)}>
          New key
        </Button>
      </header>

      {error ? (
        <div className="form-stack">
          <InlineError>{error}</InlineError>
          <Button variant="secondary" size="sm" onClick={() => setAttempt((a) => a + 1)}>
            Try again
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
        <div className="page-empty">
          <EmptyState
            icon={<Key size={22} />}
            title="No API keys yet"
            description="Create a key to let AI coding agents read and update your projects over MCP."
            action={
              <>
                <Button
                  leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />}
                  onClick={() => setNewOpen(true)}
                >
                  New key
                </Button>
                <Link className="btn btn-ghost btn-md" to="/docs/mcp">
                  Read the MCP guide
                </Link>
              </>
            }
          />
        </div>
      ) : (
        <>
          <div className="data-list-header">
            <span className="data-list-count">
              {keys.length} key{keys.length === 1 ? '' : 's'}
              {activeCount < MAX_KEYS ? ` · ${activeCount} of ${MAX_KEYS} active` : ''}
            </span>
          </div>
          <div className="data-list">
            {keys.map((k) => {
              const active = !k.revokedAt;
              const keyCopied = copied && copiedKeyId === k.id;
              const copyLoading = copyLoadingId === k.id;
              const rowCopyError = copyError?.id === k.id ? copyError.message : null;
              return (
                <div key={k.id} className="data-row">
                  <div className="data-row-main">
                    <div className="data-row-title">
                      <span className="row-title-text">{k.name || 'Untitled key'}</span>
                      {active ? (
                        <span
                          className="key-status-dot"
                          title="Active"
                          aria-label="Active key"
                        />
                      ) : (
                        <Badge tone="danger" dot>
                          Revoked
                        </Badge>
                      )}
                    </div>
                    <div className="data-row-meta">
                      <span className="key-prefix">
                        <code>{k.prefix}…</code>
                        <KeyCopyButton
                          label={k.revealable ? `Copy key ${k.prefix}` : `Copy key prefix ${k.prefix}`}
                          title={
                            k.revealable
                              ? 'Reveal & copy the full key'
                              : 'Copy prefix (key created before encryption support)'
                          }
                          copied={keyCopied}
                          loading={copyLoading}
                          onCopy={() => void onCopyKey(k)}
                        />
                      </span>
                    </div>
                    <div className="data-row-meta">
                      <span>Created {formatDate(k.createdAt)}</span>
                      <span className="key-last-used">
                        <Clock size={12} weight="duotone" aria-hidden="true" />
                        {k.lastUsedAt ? formatRelative(k.lastUsedAt) : <em>Never</em>}
                      </span>
                      {!active && k.revokedAt && <span>Revoked {formatDate(k.revokedAt)}</span>}
                    </div>
                    {rowCopyError && <div className="data-row-meta text-danger">{rowCopyError}</div>}
                  </div>
                  <div className="data-row-side">
                    {active && (
                      <Button size="sm" variant="ghost" onClick={() => openRevoke(k)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <KeysGuide />
        </>
      )}

      <NewKeyModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={onCreated}
        activeCount={activeCount}
      />

      <Modal
        open={revokeTarget !== null}
        title="Revoke key"
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
              Cancel
            </Button>
            {confirming ? (
              <Button variant="danger" loading={revoking} onClick={() => void onRevoke()}>
                Confirm revoke
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Revoke
              </Button>
            )}
          </>
        }
      >
        <div className="form-stack">
          <p>
            “{revokeTarget?.name || 'Untitled key'}” ({revokeTarget?.prefix}…) will stop working
            immediately. Agents using it get a 401 on their next call.
          </p>
          {revokeError && <InlineError>{revokeError}</InlineError>}
        </div>
      </Modal>
    </div>
  );
}

function KeysGuide() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const curlSnippet = `curl -X POST ${origin}/mcp \\
  -H "Authorization: Bearer $DEVHUB_MCP_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
  const envSnippet = `DEVHUB_MCP_KEY="devhub_<your-key>"`;

  return (
    <section className="keys-guide" aria-label="Using your keys">
      <h2 className="keys-guide-title">Using your keys</h2>

      <div className="auth-banner">
        <Key size={14} weight="duotone" aria-hidden="true" />
        <p>
          Authenticate MCP requests with your key in the <code>Authorization</code> header:{' '}
          <code>Authorization: Bearer $DEVHUB_MCP_KEY</code>
        </p>
      </div>

      <div className="keys-guide-grid">
        <CodeBlock
          title="Quick start"
          description="Test your key against the MCP server:"
          code={curlSnippet}
        />
        <CodeBlock
          title="Environment variable"
          description="Set your key in your environment, then point opencode.json at it:"
          code={envSnippet}
        />
      </div>

      <Link className="keys-guide-link" to="/docs/mcp">
        Full MCP integration guide →
      </Link>
    </section>
  );
}

function CodeBlock({
  title,
  description,
  code,
}: {
  title: string;
  description: string;
  code: string;
}) {
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
          aria-label={`Copy ${title.toLowerCase()}`}
          title={copied ? 'Copied' : 'Copy'}
          onClick={() => void copy(code)}
        >
          {copied ? <Check size={13} weight="bold" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}