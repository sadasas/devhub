import { useEffect, useState } from 'react';
import { Trash, WarningCircle, Flag, Clock, LinkSimple, Bug, FileText, ArrowsOutSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { ISSUE_SEVERITY, ISSUE_STATUS } from '../../lib/labels';
import { formatDate, formatRelative } from '../../lib/utils';
import type { Issue, IssueSeverity, IssueStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { ActivityList } from '../../components/ActivityList';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty } from '../../components/DetailList';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { MarkdownBlocks } from '../../lib/markdown';

type ActiveField = 'title' | 'severity' | 'status' | 'linkedTask' | 'description' | 'reproduction' | null;

interface IssueModalProps {
  issueId: string | null;
  onClose: () => void;
}

export function IssueModal({ issueId, onClose }: IssueModalProps) {
  const { state, dispatch, canEdit, projectId } = useProject();
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fullscreenField, setFullscreenField] = useState<ActiveField>(null);
  const { t } = useTranslation(['tracker','project']);

  useEffect(() => {
    setActiveField(null);
    setConfirmOpen(false);
    setFullscreenField(null);
  }, [issueId]);

  const issue = issueId ? state?.issues.find((i) => i.id === issueId) : undefined;
  usePresenceStatus(t('issues.modal.presenceEditing'), issue != null);
  if (!state || !issue) return null;

  const update = (patch: UpdatePatch<Issue>) => {
    dispatch({ type: 'issue/update', id: issue.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'issue/remove', id: issue.id });
    onClose();
  };

  const linkedTask = issue.linkedTaskId
    ? state.tasks.find((t) => t.id === issue.linkedTaskId)
    : undefined;

  const titleEmpty = issue.title.trim() === '';

  return (
    <>
      <Modal
        open={issueId !== null}
        title={t('issues.modal.viewTitle')}
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
              {t('issues.modal.delete')}
            </Button>
          ) : undefined
        }
      >
        <div className="form-stack">
          <>
            {/* Title inline */}
            {activeField === 'title' && canEdit ? (
              <input
                className="input"
                value={issue.title}
                autoFocus
                onChange={(e) => update({ title: e.target.value })}
                onBlur={() => setActiveField(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setActiveField(null);
                  if (e.key === 'Escape') setActiveField(null);
                }}
                aria-label={t('issues.modal.titleLabel')}
                placeholder={t('issues.newModal.titlePlaceholder')}
              />
            ) : (
              <h3
                className="detail-title"
                onClick={() => canEdit && setActiveField('title')}
                style={{
                  cursor: canEdit ? 'text' : undefined,
                  padding: '4px 6px',
                  margin: '-4px -6px',
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => {
                  if (canEdit) (e.currentTarget as HTMLElement).style.background = 'var(--bg-inset)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
                title={canEdit ? t('issues.modal.clickToEdit') : undefined}
                aria-label={canEdit ? `${t('issues.modal.clickToEdit')} ${t('issues.modal.titleLabel')}` : undefined}
                role={canEdit ? 'button' : undefined}
                tabIndex={canEdit ? 0 : undefined}
                onKeyDown={(e) => {
                  if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setActiveField('title');
                  }
                }}
              >
                {issue.title || <DetailEmpty>{t('issues.modal.untitledIssue')}</DetailEmpty>}
              </h3>
            )}
            {titleEmpty && activeField !== 'title' && (
              <InlineError>{t('issues.modal.titleRequired')}</InlineError>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 0' }}>
              {/* Created time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span
                  style={{
                    width: 110,
                    color: 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <Clock size={12} aria-hidden="true" /> {t('issues.modal.createdTimeLabel')}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {formatDate(issue.createdAt)}{' '}
                  {new Date(issue.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Severity - pill dot */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span
                  style={{
                    width: 110,
                    color: 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <WarningCircle size={12} aria-hidden="true" /> {t('issues.modal.severityLabel')}
                </span>
                {activeField === 'severity' && canEdit ? (
                  <select
                    className="select"
                    style={{ width: 160 }}
                    value={issue.severity}
                    autoFocus
                    onChange={(e) => {
                      update({ severity: e.target.value as IssueSeverity });
                      setActiveField(null);
                    }}
                    onBlur={() => setActiveField(null)}
                    aria-label={t('issues.modal.severityLabel')}
                  >
                    <option value="critical">{t('issues.severity.critical')}</option>
                    <option value="high">{t('issues.severity.high')}</option>
                    <option value="medium">{t('issues.severity.medium')}</option>
                    <option value="low">{t('issues.severity.low')}</option>
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => canEdit && setActiveField('severity')}
                    aria-label={canEdit ? t('issues.modal.changeAria', { label: t('issues.modal.severityLabel') }) : undefined}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background:
                        issue.severity === 'critical'
                          ? 'var(--status-danger-dim)'
                          : issue.severity === 'high'
                            ? 'var(--status-warn-dim)'
                            : issue.severity === 'medium'
                              ? 'var(--status-info-dim)'
                              : 'var(--bg-inset)',
                      border: issue.severity === 'low' ? '1px solid var(--border-hairline)' : 'none',
                      cursor: canEdit ? 'pointer' : 'default',
                      fontSize: 12,
                      color:
                        issue.severity === 'critical'
                          ? 'var(--status-danger)'
                          : issue.severity === 'high'
                            ? 'var(--status-warn)'
                            : issue.severity === 'medium'
                              ? 'var(--status-info)'
                              : 'var(--text-secondary)',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background:
                          issue.severity === 'critical'
                            ? 'var(--status-danger)'
                            : issue.severity === 'high'
                              ? 'var(--status-warn)'
                              : issue.severity === 'medium'
                                ? 'var(--status-info)'
                                : 'var(--text-muted)',
                        flexShrink: 0,
                      }}
                    />
                    {ISSUE_SEVERITY[issue.severity].label}
                  </button>
                )}
              </div>

              {/* Status - dot + pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span
                  style={{
                    width: 110,
                    color: 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <Flag size={12} aria-hidden="true" /> {t('issues.modal.statusLabel')}
                </span>
                {activeField === 'status' && canEdit ? (
                  <select
                    className="select"
                    style={{ width: 160 }}
                    value={issue.status}
                    autoFocus
                    onChange={(e) => {
                      update({ status: e.target.value as IssueStatus });
                      setActiveField(null);
                    }}
                    onBlur={() => setActiveField(null)}
                    aria-label={t('issues.modal.statusLabel')}
                  >
                    <option value="open">{t('issues.status.open')}</option>
                    <option value="reproduced">{t('issues.status.reproduced')}</option>
                    <option value="fixing">{t('issues.status.fixing')}</option>
                    <option value="resolved">{t('issues.status.resolved')}</option>
                    <option value="wontfix">{t('issues.status.wontfix')}</option>
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => canEdit && setActiveField('status')}
                    aria-label={canEdit ? t('issues.modal.changeAria', { label: t('issues.modal.statusLabel') }) : undefined}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background:
                        issue.status === 'resolved'
                          ? 'var(--status-success-dim)'
                          : issue.status === 'fixing'
                            ? 'var(--accent-dim)'
                            : issue.status === 'reproduced'
                              ? 'var(--status-warn-dim)'
                              : issue.status === 'open'
                                ? 'var(--status-info-dim)'
                                : 'var(--bg-inset)',
                      border: issue.status === 'wontfix' ? '1px solid var(--border-hairline)' : 'none',
                      cursor: canEdit ? 'pointer' : 'default',
                      fontSize: 12,
                      color:
                        issue.status === 'resolved'
                          ? 'var(--status-success)'
                          : issue.status === 'fixing'
                            ? 'var(--accent)'
                            : issue.status === 'reproduced'
                              ? 'var(--status-warn)'
                              : issue.status === 'open'
                                ? 'var(--status-info)'
                                : 'var(--text-secondary)',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background:
                          ISSUE_STATUS[issue.status].tone === 'success'
                            ? 'var(--status-success)'
                            : ISSUE_STATUS[issue.status].tone === 'accent'
                              ? 'var(--accent)'
                              : ISSUE_STATUS[issue.status].tone === 'warn'
                                ? 'var(--status-warn)'
                                : ISSUE_STATUS[issue.status].tone === 'info'
                                  ? 'var(--status-info)'
                                  : 'var(--text-muted)',
                        flexShrink: 0,
                      }}
                    />
                    {ISSUE_STATUS[issue.status].label}
                  </button>
                )}
              </div>

              {/* Description - card */}
              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 8,
                  padding: 16,
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={12} aria-hidden="true" /> {t('issues.modal.descriptionLabel')}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label={t('tracker:issues.modal.fullscreenAriaDescription')}
                    title={t('tracker:issues.modal.fullscreenAriaDescription')}
                    onClick={() => setFullscreenField('description')}
                  >
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </div>
                {activeField === 'description' && canEdit ? (
                  <>
                    <textarea
                      className="textarea"
                      value={issue.description}
                      autoFocus
                      rows={4}
                      placeholder={t('issues.newModal.descriptionPlaceholder')}
                      onChange={(e) => update({ description: e.target.value })}
                      onBlur={() => setActiveField(null)}
                      aria-label={t('issues.modal.descriptionLabel')}
                      maxLength={10000}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: issue.description.length > 9000 ? 'var(--status-danger)' : issue.description.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {issue.description.length.toLocaleString()} / {(10000).toLocaleString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div
                    onClick={() => canEdit && setActiveField('description')}
                    role={canEdit ? 'button' : undefined}
                    tabIndex={canEdit ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setActiveField('description');
                      }
                    }}
                    aria-label={canEdit ? `Edit ${t('issues.modal.descriptionLabel')}` : undefined}
                    style={{
                      cursor: canEdit ? 'text' : undefined,
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: issue.description.trim() ? 'var(--text-secondary)' : 'var(--text-muted)',
                      minHeight: 40,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {issue.description.trim() ? (
                      <MarkdownBlocks text={issue.description} />
                    ) : (
                      t('issues.modal.noDescription')
                    )}
                  </div>
                )}
              </div>

              {/* Reproduction steps - card */}
              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Bug size={12} aria-hidden="true" /> {t('issues.modal.reproductionStepsLabel')}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label={t('tracker:issues.modal.fullscreenAriaReproduction')}
                    title={t('tracker:issues.modal.fullscreenAriaReproduction')}
                    onClick={() => setFullscreenField('reproduction')}
                  >
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </div>
                {activeField === 'reproduction' && canEdit ? (
                  <>
                    <textarea
                      className="textarea"
                      value={issue.reproduction}
                      autoFocus
                      rows={4}
                      placeholder={t('issues.newModal.reproductionPlaceholder')}
                      onChange={(e) => update({ reproduction: e.target.value })}
                      onBlur={() => setActiveField(null)}
                      aria-label={t('issues.modal.reproductionStepsLabel')}
                      maxLength={10000}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: issue.reproduction.length > 9000 ? 'var(--status-danger)' : issue.reproduction.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {issue.reproduction.length.toLocaleString()} / {(10000).toLocaleString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div
                    onClick={() => canEdit && setActiveField('reproduction')}
                    role={canEdit ? 'button' : undefined}
                    tabIndex={canEdit ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setActiveField('reproduction');
                      }
                    }}
                    aria-label={canEdit ? `Edit ${t('issues.modal.reproductionStepsLabel')}` : undefined}
                    style={{
                      cursor: canEdit ? 'text' : undefined,
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: issue.reproduction.trim() ? 'var(--text-secondary)' : 'var(--text-muted)',
                      minHeight: 40,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {issue.reproduction.trim() ? (
                      <MarkdownBlocks text={issue.reproduction} />
                    ) : (
                      t('issues.modal.noReproduction')
                    )}
                  </div>
                )}
              </div>

              {/* Linked task - pill + SearchableSelect */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span
                  style={{
                    width: 110,
                    color: 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <LinkSimple size={12} aria-hidden="true" /> {t('issues.modal.linkedTaskLabel')}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, alignItems: 'center' }}>
                  {linkedTask ? (
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'var(--bg-inset)',
                        border: '1px solid var(--border-hairline)',
                        fontSize: 11,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: 'var(--text-secondary)',
                        overflowWrap: 'anywhere',
                        maxWidth: '100%',
                      }}
                    >
                      <LinkSimple size={10} aria-hidden="true" />
                      <span
                        style={{
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        {linkedTask.title}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => update({ linkedTaskId: null })}
                          aria-label={t('issues.modal.unlinkTaskAria')}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            padding: '0 2px',
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ) : issue.linkedTaskId ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                      {t('issues.modal.taskDeleted')}{' '}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => update({ linkedTaskId: null })}
                      >
                        {t('issues.modal.removeLink')}
                      </button>
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                  )}
                  {canEdit &&
                    (activeField === 'linkedTask' ? (
                      <SearchableSelect
                        id="issue-linked-task-inline"
                        label={t('issues.modal.linkedTaskLabel')}
                        value={issue.linkedTaskId ?? null}
                        options={state.tasks.map((t) => ({ value: t.id, label: t.title }))}
                        onChange={(v) => {
                          update({ linkedTaskId: v });
                          setActiveField(null);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setActiveField('linkedTask')}
                        aria-label={linkedTask ? t('issues.modal.changeAria', { label: t('issues.modal.linkedTaskLabel') }) : t('issues.modal.add')}
                      >
                        {linkedTask ? t('issues.modal.change') : t('issues.modal.add')}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <h4 className="detail-subtitle">{t('issues.modal.activity')}</h4>
            <ActivityList projectId={projectId} entity="issues" entityId={issue.id} />
            <p className="field-helper">{t('issues.modal.updated', { time: formatRelative(issue.updatedAt) })}</p>
          </>
        </div>
      </Modal>
      {fullscreenField === 'description' && (
        <Modal
          open
          title={t('tracker:issues.modal.fullscreenTitle', { label: t('issues.modal.descriptionLabel') })}
          onClose={() => setFullscreenField(null)}
          width="lg"
          className="modal-fullscreen"
        >
          <div className="field">
            <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
                <textarea
                  id="issue-desc-fullscreen"
                  className="textarea"
                  style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }}
                  value={issue.description}
                  autoFocus={canEdit}
                  readOnly={!canEdit}
                  placeholder={t('issues.newModal.descriptionPlaceholder')}
                  onChange={(e) => canEdit && update({ description: e.target.value })}
                  aria-label={t('issues.modal.descriptionLabel')}
                  maxLength={10000}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {issue.description.trim() ? (
                    <MarkdownBlocks text={issue.description} />
                  ) : (
                    <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{canEdit ? t('tracker:issues.modal.fullscreenHelper') : t('tracker:issues.modal.fullscreenHelperReadOnly')}</p>
              <span style={{ fontSize: 11, color: issue.description.length > 9000 ? 'var(--status-danger)' : issue.description.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {issue.description.length.toLocaleString()} / {(10000).toLocaleString()}
              </span>
            </div>
          </div>
        </Modal>
      )}
      {fullscreenField === 'reproduction' && (
        <Modal
          open
          title={t('tracker:issues.modal.fullscreenTitle', { label: t('issues.modal.reproductionStepsLabel') })}
          onClose={() => setFullscreenField(null)}
          width="lg"
          className="modal-fullscreen"
        >
          <div className="field">
            <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
                <textarea
                  id="issue-repro-fullscreen"
                  className="textarea"
                  style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }}
                  value={issue.reproduction}
                  autoFocus={canEdit}
                  readOnly={!canEdit}
                  placeholder={t('issues.newModal.reproductionPlaceholder')}
                  onChange={(e) => canEdit && update({ reproduction: e.target.value })}
                  aria-label={t('issues.modal.reproductionStepsLabel')}
                  maxLength={10000}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {issue.reproduction.trim() ? (
                    <MarkdownBlocks text={issue.reproduction} />
                  ) : (
                    <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{canEdit ? t('tracker:issues.modal.fullscreenHelper') : t('tracker:issues.modal.fullscreenHelperReadOnly')}</p>
              <span style={{ fontSize: 11, color: issue.reproduction.length > 9000 ? 'var(--status-danger)' : issue.reproduction.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {issue.reproduction.length.toLocaleString()} / {(10000).toLocaleString()}
              </span>
            </div>
          </div>
        </Modal>
      )}
      <ConfirmDeleteDialog
        open={confirmOpen}
        title={t('issues.modal.deleteConfirmTitle')}
        description={t('issues.modal.deleteConfirmBody')}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </>
  );
}
