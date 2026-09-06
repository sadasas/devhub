import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Trash, Clock, Bug, FileText, CheckCircle } from '@phosphor-icons/react';
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
import { PropRow, useHotProp } from '../../components/PropRow';
import { DetailShell } from '../../components/DetailShell';
import { DetailEmpty } from '../../components/DetailList';
import { InlineError } from '../../components/InlineError';
import { MarkdownField } from '../../components/MarkdownField';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Modal } from '../../components/Modal';
import { MarkdownBlocks } from '../../lib/markdown';
import { LIMITS } from '../../lib/limits';

type FullscreenField = 'description' | 'reproduction' | null;

const SEVERITY_OPTIONS: IssueSeverity[] = ['critical', 'high', 'medium', 'low'];
const STATUS_OPTIONS: IssueStatus[] = ['open', 'reproduced', 'fixing', 'resolved', 'wontfix'];

interface IssueModalProps {
  issueId: string | null;
  onClose: () => void;
}

export function IssueModal({ issueId, onClose }: IssueModalProps) {
  const { state, dispatch, canEdit, projectId, saving, lastSavedAt } = useProject();
  const { hotProp, setHotProp } = useHotProp();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fullscreenField, setFullscreenField] = useState<FullscreenField>(null);
  const { t } = useTranslation(['tracker', 'project']);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setHotProp(null);
    setConfirmOpen(false);
    setFullscreenField(null);
  }, [issueId]);

  // Judul autogrow tanpa batas — yang scroll .composer-scroll, bukan textarea.
  useLayoutEffect(() => {
    const ta = titleRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  });

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
    ? state.tasks.find((taskItem) => taskItem.id === issue.linkedTaskId)
    : undefined;

  const titleEmpty = issue.title.trim() === '';

  return (
    <DetailShell
      title={t('issues.modal.viewTitle')}
      onClose={fullscreenField ? () => setFullscreenField(null) : onClose}
      footer={
        canEdit ? (
          <>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t('issues.modal.delete')}
            </Button>
            {(saving || lastSavedAt) && (
              <span className="save-state" role="status">
                {saving ? (
                  t('board.taskModal.autosaveSaving')
                ) : (
                  <>
                    <CheckCircle size={13} weight="bold" aria-hidden="true" />
                    {t('board.taskModal.autosaveSaved')}
                  </>
                )}
              </span>
            )}
          </>
        ) : undefined
      }
      sidebarHead={t('board.taskModal.propertiesLabel')}
      sidebar={(
        <>
          <PropRow
            propKey="severity"
            label={t('issues.modal.severityLabel')}
            hot={hotProp === 'severity'}
            setHot={setHotProp}
            canEdit={canEdit}
            view={(
              <span
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
                {ISSUE_SEVERITY[issue.severity].label}
              </span>
            )}
            control={(
              <SearchableSelect
                defaultOpen
                searchable={false}
                id="issue-severity"
                label=""
                ariaLabel={t('issues.modal.severityLabel')}
                value={issue.severity}
                allowEmpty={false}
                options={SEVERITY_OPTIONS.map((s) => ({ value: s, label: t(`issues.severity.${s}`) }))}
                onChange={(v) => { if (v) { update({ severity: v as IssueSeverity }); setHotProp(null); } }}
              />
            )}
          />
          <PropRow
            propKey="status"
            label={t('issues.modal.statusLabel')}
            hot={hotProp === 'status'}
            setHot={setHotProp}
            canEdit={canEdit}
            view={(
              <span
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
                {ISSUE_STATUS[issue.status].label}
              </span>
            )}
            control={(
              <SearchableSelect
                defaultOpen
                searchable={false}
                id="issue-status"
                label=""
                ariaLabel={t('issues.modal.statusLabel')}
                value={issue.status}
                allowEmpty={false}
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`issues.status.${s}`) }))}
                onChange={(v) => { if (v) { update({ status: v as IssueStatus }); setHotProp(null); } }}
              />
            )}
          />
          <PropRow
            propKey="linkedTask"
            label={t('issues.modal.linkedTaskLabel')}
            hot={hotProp === 'linkedTask'}
            setHot={setHotProp}
            canEdit={canEdit}
            view={linkedTask ? (
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  overflowWrap: 'anywhere',
                  maxWidth: '100%',
                }}
              >
                {linkedTask.title}
              </span>
            ) : issue.linkedTaskId ? (
              <span style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                {t('issues.modal.taskDeleted')}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
            )}
            control={(
              <SearchableSelect
                defaultOpen
                id="issue-linked-task"
                label=""
                ariaLabel={t('issues.modal.linkedTaskLabel')}
                value={issue.linkedTaskId ?? null}
                options={state.tasks.map((taskItem) => ({ value: taskItem.id, label: taskItem.title }))}
                onChange={(v) => { update({ linkedTaskId: v }); setHotProp(null); }}
                triggerEmptyLabel={t('issues.modal.linkedTaskLabel')}
              />
            )}
          />
        </>
      )}
      after={(
        <>
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
                      maxLength={LIMITS.ISSUE_DESCRIPTION}
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
                    {issue.description.length.toLocaleString()} / {(LIMITS.ISSUE_DESCRIPTION).toLocaleString()}
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
                      maxLength={LIMITS.ISSUE_REPRODUCTION}
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
                    {issue.reproduction.length.toLocaleString()} / {(LIMITS.ISSUE_REPRODUCTION).toLocaleString()}
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
      )}
    >
      {canEdit ? (
        <textarea
          ref={titleRef}
          className="composer-title"
          rows={1}
          value={issue.title}
          autoFocus
          maxLength={LIMITS.ISSUE_TITLE}
          onChange={(e) => update({ title: e.target.value })}
          aria-label={t('issues.modal.titleLabel')}
          placeholder={t('issues.newModal.titlePlaceholder')}
        />
      ) : (
        <h3
          className="detail-title"
          style={{ padding: '4px 6px', margin: '-4px -6px' }}
        >
          {issue.title || <DetailEmpty>{t('issues.modal.untitledIssue')}</DetailEmpty>}
        </h3>
      )}
      <div className="detail-created" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
        <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Clock size={12} aria-hidden="true" /> {t('issues.modal.createdTimeLabel')}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {formatDate(issue.createdAt)}{' '}
          {new Date(issue.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {titleEmpty && (
        <InlineError>{t('issues.modal.titleRequired')}</InlineError>
      )}
      {canEdit ? (
        <MarkdownField
          label={t('issues.modal.descriptionLabel')}
          icon={FileText}
          value={issue.description}
          onChange={(v) => update({ description: v })}
          placeholder={t('issues.newModal.descriptionPlaceholder')}
          maxLength={LIMITS.ISSUE_DESCRIPTION}
          rows={4}
          variant="bare"
          previewToggle
        />
      ) : (
        <div className="md-bare">
          <div className="md-bare-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FileText size={12} aria-hidden="true" /> {t('issues.modal.descriptionLabel')}
            </span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: issue.description.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', overflowWrap: 'anywhere' }}>
            {issue.description.trim() ? (
              <MarkdownBlocks text={issue.description} />
            ) : (
              t('issues.modal.noDescription')
            )}
          </div>
        </div>
      )}
      {canEdit ? (
        <MarkdownField
          label={t('issues.modal.reproductionStepsLabel')}
          icon={Bug}
          value={issue.reproduction}
          onChange={(v) => update({ reproduction: v })}
          placeholder={t('issues.newModal.reproductionPlaceholder')}
          maxLength={LIMITS.ISSUE_REPRODUCTION}
          rows={4}
          variant="bare"
          previewToggle
        />
      ) : (
        <div className="md-bare">
          <div className="md-bare-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Bug size={12} aria-hidden="true" /> {t('issues.modal.reproductionStepsLabel')}
            </span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: issue.reproduction.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', overflowWrap: 'anywhere' }}>
            {issue.reproduction.trim() ? (
              <MarkdownBlocks text={issue.reproduction} />
            ) : (
              t('issues.modal.noReproduction')
            )}
          </div>
        </div>
      )}
      <h4 className="detail-subtitle">{t('issues.modal.activity')}</h4>
      <ActivityList projectId={projectId} entity="issues" entityId={issue.id} />
      <p className="field-helper">{t('issues.modal.updated', { time: formatRelative(issue.updatedAt) })}</p>
    </DetailShell>
  );
}
