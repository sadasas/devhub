import { useEffect, useRef, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { ISSUE_SEVERITY, ISSUE_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { State, Issue, IssueSeverity, IssueStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Badge } from '../../components/Badge';
import { ActivityList } from '../../components/ActivityList';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty, DetailList, DetailRow } from '../../components/DetailList';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Textarea } from '../../components/Textarea';

interface IssueModalProps {
  issueId: string | null;
  onClose: () => void;
}

export function IssueModal({ issueId, onClose }: IssueModalProps) {
  const { state, dispatch, canEdit, projectId } = useProject();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editSnapshot = useRef<State | null>(null);
  const { t } = useTranslation('tracker');

  useEffect(() => {
    setEditing(false);
    setConfirmOpen(false);
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

  const startEditing = () => {
    editSnapshot.current = structuredClone(state);
    setEditing(true);
  };

  const cancelEditing = () => {
    if (editSnapshot.current) {
      dispatch({ type: 'replace', state: editSnapshot.current });
      editSnapshot.current = null;
    }
    setEditing(false);
  };

  const finishEditing = () => {
    editSnapshot.current = null;
    setEditing(false);
    onClose();
  };

  const linkedTask = issue.linkedTaskId
    ? state.tasks.find((t) => t.id === issue.linkedTaskId)
    : undefined;

  return (
    <>
    <Modal
      open={issueId !== null}
      title={editing ? t('issues.modal.editTitle') : t('issues.modal.viewTitle')}
      onClose={onClose}
      width="md"
      footer={
        <>
          {canEdit && !editing && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t('issues.modal.delete')}
            </Button>
          )}
          <span className="flex-1" />
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEditing}>
                {t('issues.modal.cancel')}
              </Button>
              <Button variant="primary" onClick={finishEditing}>
                {t('issues.modal.done')}
              </Button>
            </>
          ) : (
            canEdit && (
              <Button variant="primary" onClick={startEditing}>
                {t('issues.modal.edit')}
              </Button>
            )
          )}
        </>
      }
    >
      <div className="form-stack">
        {editing ? (
          <>
            <Input
              label={t('issues.modal.titleLabel')}
              value={issue.title}
              onChange={(e) => update({ title: e.target.value })}
            />
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="issue-severity">
                  {t('issues.modal.severityLabel')}
                </label>
                <select
                  id="issue-severity"
                  className="select"
                  value={issue.severity}
                  onChange={(e) => update({ severity: e.target.value as IssueSeverity })}
                >
                  <option value="critical">{t('issues.severity.critical')}</option>
                  <option value="high">{t('issues.severity.high')}</option>
                  <option value="medium">{t('issues.severity.medium')}</option>
                  <option value="low">{t('issues.severity.low')}</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="issue-status">
                  {t('issues.modal.statusLabel')}
                </label>
                <select
                  id="issue-status"
                  className="select"
                  value={issue.status}
                  onChange={(e) => update({ status: e.target.value as IssueStatus })}
                >
                  <option value="open">{t('issues.status.open')}</option>
                  <option value="reproduced">{t('issues.status.reproduced')}</option>
                  <option value="fixing">{t('issues.status.fixing')}</option>
                  <option value="resolved">{t('issues.status.resolved')}</option>
                  <option value="wontfix">{t('issues.status.wontfix')}</option>
                </select>
              </div>
            </div>
            <div className="field">
              <SearchableSelect
                id="issue-linked-task"
                label={t('issues.modal.linkedTaskLabel')}
                value={issue.linkedTaskId}
                options={state.tasks.map((t) => ({ value: t.id, label: t.title }))}
                onChange={(v) => update({ linkedTaskId: v })}
              />
            </div>
            <Textarea
              label={t('issues.modal.descriptionLabel')}
              rows={3}
              value={issue.description}
              onChange={(e) => update({ description: e.target.value })}
            />
            <Textarea
              label={t('issues.modal.reproductionStepsLabel')}
              rows={4}
              value={issue.reproduction}
              onChange={(e) => update({ reproduction: e.target.value })}
            />
            <p className="field-helper">{t('issues.modal.updated', { time: formatRelative(issue.updatedAt) })}</p>
          </>
        ) : (
          <>
            <h3 className="detail-title">{issue.title}</h3>
            <DetailList>
              <DetailRow label={t('issues.modal.severityLabel')}>
                <Badge tone={ISSUE_SEVERITY[issue.severity].tone}>
                  {t(`issues.severity.${issue.severity}`)}
                </Badge>
              </DetailRow>
              <DetailRow label={t('issues.modal.statusLabel')}>
                <Badge tone={ISSUE_STATUS[issue.status].tone}>{t(`issues.status.${issue.status}`)}</Badge>
              </DetailRow>
              <DetailRow label={t('issues.modal.linkedTaskLabel')}>
                {linkedTask ? linkedTask.title : <DetailEmpty />}
              </DetailRow>
              <DetailRow label={t('issues.modal.descriptionLabel')}>
                {issue.description.trim() ? issue.description : <DetailEmpty>{t('issues.modal.noDescription')}</DetailEmpty>}
              </DetailRow>
              <DetailRow label={t('issues.modal.reproductionRow')}>
                {issue.reproduction.trim() ? (
                  issue.reproduction
                ) : (
                  <DetailEmpty>{t('issues.modal.noReproduction')}</DetailEmpty>
                )}
              </DetailRow>
            </DetailList>
            <h4 className="detail-subtitle">{t('issues.modal.activity')}</h4>
            <ActivityList projectId={projectId} entity="issues" entityId={issue.id} />
            <p className="field-helper">{t('issues.modal.updated', { time: formatRelative(issue.updatedAt) })}</p>
          </>
        )}
      </div>
    </Modal>
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