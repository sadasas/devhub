import { useEffect, useState } from 'react';
import { BookmarkSimple, Copy, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { ProjectTemplate } from '../../lib/types';
import { formatDate } from '../../lib/utils';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { DataErrorState } from '../../components/DataErrorState';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { InstantiateTemplateModal } from './InstantiateTemplateModal';

interface DeleteTarget {
  id: string;
  name: string;
}

// Owner-only template library: the server lists only the caller's own
// templates, so every row is deletable and there is no team gate here.
export function TemplatesPage() {
  const { t } = useTranslation('extras');
  const [templates, setTemplates] = useState<ProjectTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadErrorRaw, setLoadErrorRaw] = useState<unknown>(null);
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
    setLoadErrorRaw(null);
    api
      .listTemplates()
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, t('templates.errors.load')));
        if (!cancelled) setLoadErrorRaw(err);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, t]);

  function openDelete(tpl: ProjectTemplate) {
    setConfirming(false);
    setDeleteError(null);
    setDeleteTarget({ id: tpl.id, name: tpl.name });
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await api.deleteTemplate(deleteTarget.id);
      setTemplates((prev) => (prev ?? []).filter((tpl) => tpl.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err, t('templates.errors.delete')));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page">
      {/* Flat content card wraps page content; modals stay as sibling portal targets. */}
      <article className="pcard">
        <div className="pcard-body">
          <div className="narrow-center">
          <header className="page-header">
            <div>
              <h1 className="page-title">{t('templates.page.title')}</h1>
              <p className="page-subtitle">{t('templates.page.subtitle')}</p>
            </div>
            {templates !== null && !error && templates.length > 0 && (
              <span className="data-list-count">{t('templates.count', { count: templates.length })}</span>
            )}
          </header>

          {error ? (
            <DataErrorState error={loadErrorRaw ?? error} onRetry={() => setAttempt((a) => a + 1)} retryLabel={t('templates.retry')} />
          ) : templates === null ? (
            <div
              className="data-list"
              role="status"
              aria-live="polite"
              aria-busy="true"
              aria-label="Loading templates"
            >
              <span className="sr-only">Loading templates…</span>
              <div aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="data-row" style={{ height: 56 }}>
                    <div className="data-row-main" style={{ gap: 6 }}>
                      <Skeleton style={{ width: '55%', height: 14 }} />
                      <Skeleton style={{ width: '38%', height: 11, opacity: 0.85 }} />
                      <Skeleton style={{ width: '30%', height: 11, opacity: 0.7 }} />
                    </div>
                    <div className="data-row-side" style={{ gap: 8 }}>
                      <Skeleton style={{ width: 64, height: 28, borderRadius: 8 }} />
                      <Skeleton style={{ width: 110, height: 28, borderRadius: 8 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="page-empty">
              <EmptyState
                icon={<BookmarkSimple size={22} />}
                title={t('templates.empty.title')}
                description={t('templates.empty.desc')}
              />
            </div>
          ) : (
            <div className="data-list">
              {templates.map((tpl) => (
                <div key={tpl.id} className="data-row">
                  <div className="data-row-main">
                    <div className="data-row-title">
                      <span className="row-title-text">{tpl.name}</span>
                    </div>
                    {tpl.description && <div className="data-row-meta">{tpl.description}</div>}
                    <div className="data-row-meta">
                      <span>{t('templates.row.created', { date: formatDate(tpl.createdAt) })}</span>
                    </div>
                  </div>
                  <div className="data-row-side" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                    <Button
                      variant="danger"
                      size="sm"
                      leftIcon={<Trash size={13} aria-hidden="true" />}
                      onClick={() => openDelete(tpl)}
                      aria-label={`${t('templates.delete')}: ${tpl.name}`}
                    >
                      {t('templates.delete')}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Copy size={13} aria-hidden="true" />}
                      onClick={() => setUseTarget(tpl)}
                    >
                      {t('templates.use')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </article>

      <InstantiateTemplateModal open={useTarget !== null} template={useTarget} onClose={() => setUseTarget(null)} />

      <Modal
        open={deleteTarget !== null}
        title={t('templates.deleteTitle')}
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
              {t('templates.cancel')}
            </Button>
            {confirming ? (
              <Button
                variant="danger"
                leftIcon={<Trash size={13} aria-hidden="true" />}
                loading={deleting}
                onClick={() => void onDelete()}
              >
                {t('templates.confirmDelete')}
              </Button>
            ) : (
              <Button
                variant="danger"
                leftIcon={<Trash size={13} aria-hidden="true" />}
                onClick={() => setConfirming(true)}
              >
                {t('templates.delete')}
              </Button>
            )}
          </>
        }
      >
        <div className="form-stack">
          <p>{t('templates.deleteDesc', { name: deleteTarget?.name ?? '' })}</p>
          {deleteError && <InlineError>{deleteError}</InlineError>}
        </div>
      </Modal>
    </div>
  );
}
