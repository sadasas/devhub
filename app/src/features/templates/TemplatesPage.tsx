import { useEffect, useState } from 'react';
import { BookmarkSimple, Copy, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { ProjectTemplate } from '../../lib/types';
import { formatDate } from '../../lib/utils';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { DataErrorState } from '../../components/DataErrorState';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { Skeleton } from '../../components/Skeleton';
import { RowMenu } from '../../components/RowMenu';
import { InstantiateTemplateModal } from './InstantiateTemplateModal';

interface DeleteTarget {
  id: string;
  name: string;
}

// Owner-only template library: the server lists only the caller's own
// templates, so every row is deletable and there is no team gate here.

/** Header ringkas ≤640px: aksi icon diganti kebab ⋮ + popup panel — pola IssuesPage. */
function useIsTemplatesNarrow(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 640px)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = (): void => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);
  return matches;
}
export function TemplatesPage() {
  const { t } = useTranslation('extras');
  const [templates, setTemplates] = useState<ProjectTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadErrorRaw, setLoadErrorRaw] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [useTarget, setUseTarget] = useState<ProjectTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isNarrow = useIsTemplatesNarrow();

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
    <div className="page templates-page">
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
              aria-label={t('templates.loading')}
            >
              <span className="sr-only">{t('templates.loadingText')}</span>
              <div aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="data-row">
                    <div className="data-row-main">
                      <Skeleton className="template-skeleton-title" />
                      <Skeleton className="template-skeleton-meta" />
                      <Skeleton className="template-skeleton-meta-sm" />
                    </div>
                    <div className="data-row-side">
                      <Skeleton className="template-skeleton-kebab" />
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
                  <div className="data-row-top">
                    <div className="data-row-title">
                      <span className="row-title-text">{tpl.name}</span>
                    </div>
                    <span className="data-row-props">
                      {!isNarrow ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="btn-icon"
                            onClick={() => setUseTarget(tpl)}
                            aria-label={t('templates.use')}
                            title={t('templates.use')}
                          >
                            <Copy size={14} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="btn-icon btn-danger"
                            onClick={() => openDelete(tpl)}
                            aria-label={`${t('templates.delete')}: ${tpl.name}`}
                            title={`${t('templates.delete')}: ${tpl.name}`}
                          >
                            <Trash size={14} aria-hidden="true" />
                          </Button>
                        </>
                      ) : (
                        <RowMenu
                          triggerLabel={`More actions for ${tpl.name}`}
                          menuLabel={`More actions for ${tpl.name}`}
                          menuId={`template-rowmenu-${tpl.id}`}
                          actions={[
                            {
                              key: 'use',
                              label: t('templates.use'),
                              icon: <Copy size={14} aria-hidden="true" />,
                              onSelect: () => setUseTarget(tpl),
                            },
                            {
                              key: 'delete',
                              label: `${t('templates.delete')}: ${tpl.name}`,
                              icon: <Trash size={14} aria-hidden="true" />,
                              danger: true,
                              onSelect: () => openDelete(tpl),
                            },
                          ]}
                        />
                      )}
                    </span>
                  </div>
                  {tpl.description && <div className="data-row-meta">{tpl.description}</div>}
                  <div className="data-row-meta">
                    <span>{t('templates.row.created', { date: formatDate(tpl.createdAt) })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </article>

      <InstantiateTemplateModal open={useTarget !== null} template={useTarget} onClose={() => setUseTarget(null)} />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title={t('templates.deleteTitle')}
        description={t('templates.deleteDesc', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('templates.confirmDelete')}
        busy={deleting}
        error={deleteError}
        onConfirm={() => void onDelete()}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      />
    </div>
  );
}
