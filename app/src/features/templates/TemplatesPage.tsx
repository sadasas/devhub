import { useEffect, useState } from 'react';
import { ArrowClockwise, BookmarkSimple, Copy, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
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
  const { t } = useTranslation('extras');
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
        if (!cancelled) setError(getErrorMessage(err, t('templates.errors.load')));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, t]);

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
      setDeleteError(getErrorMessage(err, t('templates.errors.delete')));
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
          <h1 className="page-title">{t('templates.page.title')}</h1>
          <p className="page-subtitle">
            {t('templates.page.subtitle')}
          </p>
        </div>
      </header>

      {error ? (
        <div className="form-stack">
          <InlineError>{error}</InlineError>
          <Button variant="secondary" size="sm" leftIcon={<ArrowClockwise size={13} aria-hidden="true" />} onClick={() => setAttempt((a) => a + 1)}>
            {t('templates.retry')}
          </Button>
        </div>
      ) : templates === null ? (
        <div className="data-list" role="status" aria-live="polite" aria-busy="true" aria-label="Loading templates">
          <span className="sr-only">Loading templates…</span>
          <div aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="data-row" style={{ height: 56 }}>
                <div className="data-row-main" style={{ gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Skeleton style={{ width: '55%', height: 14 }} />
                    <Skeleton style={{ width: 48, height: 11, borderRadius: 999, opacity: 0.6 }} />
                  </div>
                  <Skeleton style={{ width: '38%', height: 11, opacity: 0.85 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Skeleton style={{ width: 64, height: 11, borderRadius: 999 }} />
                    <Skeleton style={{ width: 44, height: 11 }} />
                  </div>
                </div>
                <div className="data-row-side" style={{ gap: 8 }}>
                  <Skeleton style={{ width: 64, height: 28, borderRadius: 8 }} />
                  <Skeleton style={{ width: 48, height: 28, borderRadius: 8, opacity: 0.6 }} />
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
        <>
          <div className="data-list-header">
            <span className="data-list-count">
              {t('templates.count', { count: templates.length })}
            </span>
          </div>
          <div className="data-list">
            {templates.map((tpl) => (
              <div key={tpl.id} className="data-row">
                <div className="data-row-main">
                  <div className="data-row-title">
                    <span className="row-title-text">{tpl.name}</span>
                  </div>
                  {tpl.description && <div className="data-row-meta">{tpl.description}</div>}
                  <div className="data-row-meta">
                    <span>{tpl.teamName}</span>
                    <span>{t('templates.row.created', { date: formatDate(tpl.createdAt) })}</span>
                  </div>
                </div>
                <div className="data-row-side">
                  <Button
                    size="sm"
                    leftIcon={<Copy size={13} aria-hidden="true" />}
                    onClick={() => setUseTarget(tpl)}
                  >
                    {t('templates.use')}
                  </Button>
                  {isAdmin(tpl.teamId) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => openDelete(tpl)}
                    >
                      {t('templates.delete')}
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
              <Button variant="danger" leftIcon={<Trash size={13} aria-hidden="true" />} loading={deleting} onClick={() => void onDelete()}>
                {t('templates.confirmDelete')}
              </Button>
            ) : (
              <Button variant="danger" leftIcon={<Trash size={13} aria-hidden="true" />} onClick={() => setConfirming(true)}>
                {t('templates.delete')}
              </Button>
            )}
          </>
        }
      >
        <div className="form-stack">
          <p>
            {t('templates.deleteDesc', { name: deleteTarget?.name ?? '' })}
          </p>
          {deleteError && <InlineError>{deleteError}</InlineError>}
        </div>
      </Modal>
    </div>
  );
}
