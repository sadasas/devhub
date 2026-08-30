import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, Bug, ArrowsOutSimple, WarningCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import type { IssueSeverity } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { MarkdownBlocks } from '../../lib/markdown';

interface NewIssueModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewIssueModal({ open, onClose }: NewIssueModalProps) {
  const { dispatch } = useProject();
  const { t } = useTranslation(['tracker','project']);
  usePresenceStatus(t('issues.newModal.presenceCreating'), open);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IssueSeverity>('medium');
  const [description, setDescription] = useState('');
  const [reproduction, setReproduction] = useState('');
  const [fullscreenField, setFullscreenField] = useState<'description' | 'reproduction' | null>(null);
  const [preview, setPreview] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setFullscreenField(null);
      setPreview({});
    } else {
      setTitle('');
      setSeverity('medium');
      setDescription('');
      setReproduction('');
    }
  }, [open]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'issue/add',
      issue: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        title: title.trim(),
        severity,
        status: 'open',
        description: description.trim(),
        reproduction: reproduction.trim(),
        linkedTaskId: null,
      },
    });
    setTitle('');
    setSeverity('medium');
    setDescription('');
    setReproduction('');
    onClose();
  }

  return (
    <>
      <Modal
        open={open}
        title={t('issues.newModal.title')}
        onClose={onClose}
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              {t('issues.newModal.cancel')}
            </Button>
            <Button type="submit" form="new-issue-form" disabled={!title.trim()}>
              {t('issues.newModal.submit')}
            </Button>
          </>
        }
      >
        <form id="new-issue-form" className="form-stack" onSubmit={onSubmit} noValidate>
          <Input
            label={t('issues.newModal.titleLabel')}
            required
            autoFocus
            placeholder={t('issues.newModal.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
            {/* Severity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
              <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <WarningCircle size={12} aria-hidden="true" /> {t('issues.newModal.severityLabel')}
              </span>
              <select
                id="new-issue-severity"
                className="select"
                style={{ width: 160 }}
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
              >
                <option value="critical">{t('issues.severity.critical')}</option>
                <option value="high">{t('issues.severity.high')}</option>
                <option value="medium">{t('issues.severity.medium')}</option>
                <option value="low">{t('issues.severity.low')}</option>
              </select>
            </div>

            {/* Description card */}
            <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16, marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={12} aria-hidden="true" /> {t('issues.modal.descriptionLabel')}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {description.trim() && (
                    <span className="md-toggle" role="group" aria-label={t('project:prd.modeAria', { label: t('issues.modal.descriptionLabel') })}>
                      <button
                        type="button"
                        title={t('project:prd.mdTooltip')}
                        className={`md-toggle-btn${preview.description ? '' : ' active'}`}
                        aria-pressed={!preview.description}
                        onClick={() => setPreview((p) => ({ ...p, description: false }))}
                      >
                        {t('project:prd.edit')}
                      </button>
                      <button
                        type="button"
                        title={t('project:prd.mdTooltip')}
                        className={`md-toggle-btn${preview.description ? ' active' : ''}`}
                        aria-pressed={!!preview.description}
                        onClick={() => setPreview((p) => ({ ...p, description: true }))}
                      >
                        {t('project:prd.preview')}
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label={t('tracker:issues.modal.fullscreenAriaDescription')}
                    title={t('tracker:issues.modal.fullscreenAriaDescription')}
                    onClick={() => setFullscreenField('description')}
                  >
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </span>
              </div>
              {preview.description ? (
                <div className="md-preview">
                  {description.trim() ? (
                    <MarkdownBlocks text={description} />
                  ) : (
                    <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
                  )}
                </div>
              ) : (
                <textarea
                  className="textarea"
                  rows={4}
                  placeholder={t('issues.newModal.descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={10000}
                  aria-label={t('issues.modal.descriptionLabel')}
                />
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: description.length > 9000 ? 'var(--status-danger)' : description.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {description.length.toLocaleString()} / {(10000).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Reproduction card */}
            <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Bug size={12} aria-hidden="true" /> {t('issues.newModal.reproductionStepsLabel')}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {reproduction.trim() && (
                    <span className="md-toggle" role="group" aria-label={t('project:prd.modeAria', { label: t('issues.newModal.reproductionStepsLabel') })}>
                      <button
                        type="button"
                        title={t('project:prd.mdTooltip')}
                        className={`md-toggle-btn${preview.reproduction ? '' : ' active'}`}
                        aria-pressed={!preview.reproduction}
                        onClick={() => setPreview((p) => ({ ...p, reproduction: false }))}
                      >
                        {t('project:prd.edit')}
                      </button>
                      <button
                        type="button"
                        title={t('project:prd.mdTooltip')}
                        className={`md-toggle-btn${preview.reproduction ? ' active' : ''}`}
                        aria-pressed={!!preview.reproduction}
                        onClick={() => setPreview((p) => ({ ...p, reproduction: true }))}
                      >
                        {t('project:prd.preview')}
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label={t('tracker:issues.modal.fullscreenAriaReproduction')}
                    title={t('tracker:issues.modal.fullscreenAriaReproduction')}
                    onClick={() => setFullscreenField('reproduction')}
                  >
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </span>
              </div>
              {preview.reproduction ? (
                <div className="md-preview">
                  {reproduction.trim() ? (
                    <MarkdownBlocks text={reproduction} />
                  ) : (
                    <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
                  )}
                </div>
              ) : (
                <textarea
                  className="textarea"
                  rows={4}
                  placeholder={t('issues.newModal.reproductionPlaceholder')}
                  value={reproduction}
                  onChange={(e) => setReproduction(e.target.value)}
                  maxLength={10000}
                  aria-label={t('issues.modal.reproductionStepsLabel')}
                />
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: reproduction.length > 9000 ? 'var(--status-danger)' : reproduction.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {reproduction.length.toLocaleString()} / {(10000).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </form>
      </Modal>
      {fullscreenField === 'description' && (
        <Modal
          open
          title={`${t('issues.modal.descriptionLabel')} — Fullscreen`}
          onClose={() => setFullscreenField(null)}
          width="lg"
          className="modal-fullscreen"
        >
          <div className="field">
            <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
                <textarea
                  className="textarea"
                  style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }}
                  value={description}
                  autoFocus
                  placeholder={t('issues.newModal.descriptionPlaceholder')}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={10000}
                  aria-label={t('issues.modal.descriptionLabel')}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {description.trim() ? (
                    <MarkdownBlocks text={description} />
                  ) : (
                    <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{t('tracker:issues.modal.fullscreenHelper')}</p>
              <span style={{ fontSize: 11, color: description.length > 9000 ? 'var(--status-danger)' : description.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {description.length.toLocaleString()} / {(10000).toLocaleString()}
              </span>
            </div>
          </div>
        </Modal>
      )}
      {fullscreenField === 'reproduction' && (
        <Modal
          open
          title={`${t('issues.newModal.reproductionStepsLabel')} — Fullscreen`}
          onClose={() => setFullscreenField(null)}
          width="lg"
          className="modal-fullscreen"
        >
          <div className="field">
            <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
                <textarea
                  className="textarea"
                  style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }}
                  value={reproduction}
                  autoFocus
                  placeholder={t('issues.newModal.reproductionPlaceholder')}
                  onChange={(e) => setReproduction(e.target.value)}
                  maxLength={10000}
                  aria-label={t('issues.newModal.reproductionStepsLabel')}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {reproduction.trim() ? (
                    <MarkdownBlocks text={reproduction} />
                  ) : (
                    <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{t('tracker:issues.modal.fullscreenHelper')}</p>
              <span style={{ fontSize: 11, color: reproduction.length > 9000 ? 'var(--status-danger)' : reproduction.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {reproduction.length.toLocaleString()} / {(10000).toLocaleString()}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
