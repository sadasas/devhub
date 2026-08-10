import { useEffect, useState } from 'react';
import { Key, Plus } from '@phosphor-icons/react';
import { ApiError, api } from '../../lib/api';
import type { McpKey, McpKeyCreated } from '../../lib/types';
import { formatDate, formatRelative } from '../../lib/utils';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { NewKeyModal } from './NewKeyModal';

interface RevokeTarget {
  id: string;
  name: string;
  prefix: string;
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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">API keys</h1>
          <p className="page-subtitle">Keys for AI coding agents to read and update your projects over MCP.</p>
        </div>
        <Button leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setNewOpen(true)}>
          New key
        </Button>
      </header>

      {error ? (
        <div className="form-stack">
          <p className="field-error" role="alert">
            {error}
          </p>
          <Button variant="secondary" size="sm" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </Button>
        </div>
      ) : keys === null ? (
        <div className="data-list" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="data-row">
              <div className="data-row-main">
                <Skeleton className="skeleton-row" />
                <Skeleton className="skeleton-row skeleton-row-sm" />
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
              <Button
                leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />}
                onClick={() => setNewOpen(true)}
              >
                New key
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="data-list-header">
            <span className="data-list-count">
              {keys.length} key{keys.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="data-list">
            {keys.map((k) => {
              const active = !k.revokedAt;
              return (
                <div key={k.id} className="data-row">
                  <div className="data-row-main">
                    <div className="data-row-title">
                      <span className="row-title-text">{k.name || 'Untitled key'}</span>
                      {!active && (
                        <Badge tone="danger" dot>
                          Revoked
                        </Badge>
                      )}
                    </div>
                    <div className="data-row-meta">{k.prefix}…</div>
                    <div className="data-row-meta">
                      <span>Created {formatDate(k.createdAt)}</span>
                      <span>Last used {k.lastUsedAt ? formatRelative(k.lastUsedAt) : 'never'}</span>
                    </div>
                  </div>
                  <div className="data-row-side">
                    {active && (
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => openRevoke(k)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <NewKeyModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={onCreated} />

      <Modal
        open={revokeTarget !== null}
        title="Revoke key"
        onClose={() => setRevokeTarget(null)}
        width="sm"
        footer={
          <>
            {confirming ? (
              <Button variant="danger" loading={revoking} onClick={() => void onRevoke()}>
                Confirm revoke
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Revoke
              </Button>
            )}
            <Button variant="ghost" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
          </>
        }
      >
        <div className="form-stack">
          <p>
            “{revokeTarget?.name || 'Untitled key'}” ({revokeTarget?.prefix}…) will stop working
            immediately. Agents using it get a 401 on their next call.
          </p>
          {revokeError && (
            <p className="field-error" role="alert">
              {revokeError}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
