import { useEffect, useState } from 'react';
import { BookmarkSimple, Copy } from '@phosphor-icons/react';
import { ApiError, api } from '../../lib/api';
import type { ProjectTemplate } from '../../lib/types';
import { formatDate } from '../../lib/utils';
import { useTeams } from '../../state/teams-context';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { InstantiateTemplateModal } from './InstantiateTemplateModal';

interface DeleteTarget {
  id: string;
  name: string;
}

export function TemplatesPage() {
  const { teams } = useTeams();
  const [templates, setTemplates] = useState<ProjectTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [useTarget, setUseTarget] = useState<ProjectTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTemplates(null);
    setError(null);
    api
      .listTemplates()
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load templates.');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function openDelete(t: ProjectTemplate) {
    setConfirming(false);
    setDeleteError(null);
    setDeleteTarget({ id: t.id, name: t.name });
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await api.deleteTemplate(deleteTarget.id);
      setTemplates((prev) => (prev ?? []).filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete template.');
    } finally {
      setDeleting(false);
    }
  }

  const isAdmin = (teamId: string): boolean => {
    const team = teams?.find((t) => t.id === teamId);
    return team?.role === 'owner' || team?.role === 'admin';
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Project templates</h1>
          <p className="page-subtitle">
            Reusable project blueprints — save a project as a template, then instantiate it whenever
            you need a fresh copy.
          </p>
        </div>
      </header>

      {error ? (
        <div className="form-stack">
          <InlineError>{error}</InlineError>
          <Button variant="secondary" size="sm" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </Button>
        </div>
      ) : templates === null ? (
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
      ) : templates.length === 0 ? (
        <div className="page-empty">
          <EmptyState
            icon={<BookmarkSimple size={22} />}
            title="No templates yet"
            description="Open any project and use “Save as template” to turn it into a reusable blueprint."
          />
        </div>
      ) : (
        <>
          <div className="data-list-header">
            <span className="data-list-count">
              {templates.length} template{templates.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="data-list">
            {templates.map((t) => (
              <div key={t.id} className="data-row">
                <div className="data-row-main">
                  <div className="data-row-title">
                    <span className="row-title-text">{t.name}</span>
                  </div>
                  {t.description && <div className="data-row-meta">{t.description}</div>}
                  <div className="data-row-meta">
                    <span>{t.teamName}</span>
                    <span>Created {formatDate(t.createdAt)}</span>
                  </div>
                </div>
                <div className="data-row-side">
                  <Button
                    size="sm"
                    leftIcon={<Copy size={13} aria-hidden="true" />}
                    onClick={() => setUseTarget(t)}
                  >
                    Use template
                  </Button>
                  {isAdmin(t.teamId) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => openDelete(t)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <InstantiateTemplateModal open={useTarget !== null} template={useTarget} onClose={() => setUseTarget(null)} />

      <Modal
        open={deleteTarget !== null}
        title="Delete template"
        onClose={() => setDeleteTarget(null)}
        width="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirming(false);
                setDeleteTarget(null);
              }}
            >
              Cancel
            </Button>
            {confirming ? (
              <Button variant="danger" loading={deleting} onClick={() => void onDelete()}>
                Confirm delete
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            )}
          </>
        }
      >
        <div className="form-stack">
          <p>
            “{deleteTarget?.name}” will be removed. Projects already created from it are not affected.
          </p>
          {deleteError && <InlineError>{deleteError}</InlineError>}
        </div>
      </Modal>
    </div>
  );
}
