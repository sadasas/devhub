import { useEffect, useState } from 'react';
import { Trash, Tag, Clock, FileText, ArrowsOutSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TECH_CATEGORY, TECH_STATUS } from '../../lib/labels';
import { formatDate, formatRelative } from '../../lib/utils';
import type { TechEntry, TechEntryCategory, TechStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { ActivityList } from '../../components/ActivityList';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty } from '../../components/DetailList';
import { Modal } from '../../components/Modal';
import { MarkdownBlocks } from '../../lib/markdown';

type ActiveField = 'name' | 'version' | 'category' | 'status' | 'notes' | null;

interface TechModalProps {
  entryId: string | null;
  onClose: () => void;
}

export function TechModal({ entryId, onClose }: TechModalProps) {
  const { t } = useTranslation(['project','tracker']);
  const { state, dispatch, canEdit, projectId } = useProject();
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fullscreenField, setFullscreenField] = useState<ActiveField>(null);
  const { t: tTracker } = useTranslation('tracker');

  useEffect(() => {
    setActiveField(null);
    setConfirmOpen(false);
    setFullscreenField(null);
  }, [entryId]);

  const entry = entryId ? state?.techEntries.find((x) => x.id === entryId) : undefined;
  usePresenceStatus('Editing tech entry', entry != null);
  if (!state || !entry) return null;

  const update = (patch: UpdatePatch<TechEntry>) => {
    dispatch({ type: 'tech/update', id: entry.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'tech/remove', id: entry.id });
    onClose();
  };

  return (
    <>
      <Modal
        open={entryId !== null}
        title={t('stack.techModal.viewTitle')}
        onClose={fullscreenField ? () => setFullscreenField(null) : onClose}
        width="lg"
        footer={
          canEdit ? (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t('stack.techModal.delete')}
            </Button>
          ) : undefined
        }
      >
        <div className="form-stack">
          <>
            {activeField === 'name' && canEdit ? (
              <input
                className="input"
                value={entry.name}
                autoFocus
                onChange={(e) => update({ name: e.target.value })}
                onBlur={() => setActiveField(null)}
                onKeyDown={(e) => { if (e.key === 'Enter') setActiveField(null); if (e.key === 'Escape') setActiveField(null); }}
                aria-label={t('stack.techModal.nameLabel')}
                maxLength={200}
              />
            ) : (
              <h3
                className="detail-title"
                onClick={() => canEdit && setActiveField('name')}
                style={{ cursor: canEdit ? 'text' : undefined, padding: '4px 6px', margin: '-4px -6px', borderRadius: 6 }}
                onMouseEnter={(e) => { if (canEdit) (e.currentTarget as HTMLElement).style.background = 'var(--bg-inset)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                title={canEdit ? t('issues.modal.clickToEdit') : undefined}
                role={canEdit ? 'button' : undefined}
                tabIndex={canEdit ? 0 : undefined}
                onKeyDown={(e) => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActiveField('name'); } }}
              >
                {entry.name || <DetailEmpty>{t('stack.techModal.noNotes')}</DetailEmpty>}
              </h3>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Clock size={12} aria-hidden="true" /> {tTracker('issues.modal.createdTimeLabel')}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{formatDate(entry.createdAt)} {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Tag size={12} aria-hidden="true" /> {t('stack.techModal.categoryLabel')}
                </span>
                {activeField === 'category' && canEdit ? (
                  <select className="select" style={{ width: 160 }} value={entry.category} autoFocus onChange={(e) => { update({ category: e.target.value as TechEntryCategory }); setActiveField(null); }} onBlur={() => setActiveField(null)}>
                    <option value="frontend">{t('stack.optionCategory.frontend')}</option>
                    <option value="backend">{t('stack.optionCategory.backend')}</option>
                    <option value="database">{t('stack.optionCategory.database')}</option>
                    <option value="tooling">{t('stack.optionCategory.tooling')}</option>
                  </select>
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('category')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: TECH_CATEGORY[entry.category].tone === 'info' ? 'var(--status-info-dim)' : TECH_CATEGORY[entry.category].tone === 'accent' ? 'var(--accent-dim)' : TECH_CATEGORY[entry.category].tone === 'warn' ? 'var(--status-warn-dim)' : 'var(--bg-inset)', border: 'none', cursor: canEdit ? 'pointer' : 'default', fontSize: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: TECH_CATEGORY[entry.category].tone === 'info' ? 'var(--status-info)' : TECH_CATEGORY[entry.category].tone === 'accent' ? 'var(--accent)' : TECH_CATEGORY[entry.category].tone === 'warn' ? 'var(--status-warn)' : 'var(--text-muted)', flexShrink: 0 }} />
                    {t(`stack.category.${entry.category}`)}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Tag size={12} aria-hidden="true" /> {t('stack.techModal.statusLabel')}
                </span>
                {activeField === 'status' && canEdit ? (
                  <select className="select" style={{ width: 160 }} value={entry.status} autoFocus onChange={(e) => { update({ status: e.target.value as TechStatus }); setActiveField(null); }} onBlur={() => setActiveField(null)}>
                    <option value="current">{t('stack.optionStatus.current')}</option>
                    <option value="updateAvailable">{t('stack.optionStatus.updateAvailable')}</option>
                    <option value="majorUpgrade">{t('stack.optionStatus.majorUpgrade')}</option>
                  </select>
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('status')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: entry.status === 'current' ? 'var(--status-success-dim)' : entry.status === 'majorUpgrade' ? 'var(--status-danger-dim)' : 'var(--status-warn-dim)', border: 'none', cursor: canEdit ? 'pointer' : 'default', fontSize: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: TECH_STATUS[entry.status].tone === 'success' ? 'var(--status-success)' : TECH_STATUS[entry.status].tone === 'danger' ? 'var(--status-danger)' : 'var(--status-warn)', flexShrink: 0 }} />
                    {t(`stack.statusBadge.${entry.status}`)}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Tag size={12} aria-hidden="true" /> {t('stack.techModal.versionLabel')}
                </span>
                {activeField === 'version' && canEdit ? (
                  <input className="input" style={{ width: 160 }} value={entry.version} autoFocus onChange={(e) => update({ version: e.target.value.replace(/[^0-9.]/g, '') })} onBlur={() => setActiveField(null)} placeholder={t('stack.techModal.versionPlaceholder')} maxLength={100} inputMode="decimal" pattern="[0-9.]*" />
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('version')} style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', fontSize: 13, color: entry.version ? 'var(--text-secondary)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {entry.version || '—'}
                  </button>
                )}
              </div>

              <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16, marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={12} aria-hidden="true" /> {t('stack.techModal.notesLabel')}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('tracker:issues.modal.fullscreenAriaDescription')} title={t('tracker:issues.modal.fullscreenAriaDescription')} onClick={() => setFullscreenField('notes')}>
                      <ArrowsOutSimple size={14} aria-hidden="true" />
                    </button>
                  </span>
                </div>
                {activeField === 'notes' && canEdit ? (
                  <textarea
                    className="textarea"
                    value={entry.notes}
                    autoFocus
                    rows={4}
                    placeholder={t('stack.newTechModal.notesPlaceholder')}
                    onChange={(e) => update({ notes: e.target.value })}
                    onBlur={() => setActiveField(null)}
                    aria-label={t('stack.techModal.notesLabel')}
                    maxLength={5000}
                  />
                ) : (
                  <div
                    onClick={() => canEdit && setActiveField('notes')}
                    role={canEdit ? 'button' : undefined}
                    tabIndex={canEdit ? 0 : undefined}
                    onKeyDown={(e) => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActiveField('notes'); } }}
                    aria-label={canEdit ? 'Edit ' + t('stack.techModal.notesLabel') : undefined}
                    style={{ cursor: canEdit ? 'text' : undefined, fontSize: 13, lineHeight: 1.6, color: entry.notes.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', minHeight: 40, overflowWrap: 'anywhere' }}
                  >
                    {entry.notes.trim() ? <MarkdownBlocks text={entry.notes} /> : t('stack.techModal.noNotes')}
                  </div>
                )}
                {activeField === 'notes' && canEdit && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: entry.notes.length > 4500 ? 'var(--status-danger)' : entry.notes.length > 4000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {entry.notes.length.toLocaleString()} / {(5000).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <h4 className="detail-subtitle">{t('stack.techModal.activity')}</h4>
            <ActivityList projectId={projectId} entity="techEntries" entityId={entry.id} />
            <p className="field-helper">{t('stack.techModal.updated', { time: formatRelative(entry.updatedAt) })}</p>
          </>
        </div>
      </Modal>
      {fullscreenField === 'notes' && (
        <Modal open title={`${t('stack.techModal.notesLabel')} — Fullscreen`} onClose={() => setFullscreenField(null)} width="lg" className="modal-fullscreen">
          <div className="field">
            <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
                <textarea className="textarea" style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }} value={entry.notes} autoFocus={canEdit} readOnly={!canEdit} onChange={(e) => canEdit && update({ notes: e.target.value })} maxLength={5000} aria-label={t('stack.techModal.notesLabel')} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {entry.notes.trim() ? <MarkdownBlocks text={entry.notes} /> : <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{canEdit ? t('tracker:issues.modal.fullscreenHelper') : t('tracker:issues.modal.fullscreenHelperReadOnly')}</p>
              <span style={{ fontSize: 11, color: entry.notes.length > 4500 ? 'var(--status-danger)' : entry.notes.length > 4000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{entry.notes.length.toLocaleString()} / {(5000).toLocaleString()}</span>
            </div>
          </div>
        </Modal>
      )}
      <ConfirmDeleteDialog
        open={confirmOpen}
        title={t('stack.techModal.deleteConfirmTitle')}
        description={t('stack.techModal.deleteConfirmBody')}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </>
  );
}
