import { useEffect, useRef, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { formatRelative, shortId } from '../../lib/utils';
import { MILESTONE_STATUS, TASK_STATUS } from '../../lib/labels';
import type { State, Milestone, MilestoneStatus } from '../../lib/types';
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
import { Textarea } from '../../components/Textarea';

interface MilestoneModalProps {
  milestoneId: string | null;
  onClose: () => void;
}

export function MilestoneModal({ milestoneId, onClose }: MilestoneModalProps) {
  const { t } = useTranslation('project');
  const { state, dispatch, canEdit, projectId } = useProject();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editSnapshot = useRef<State | null>(null);

  useEffect(() => {
    setEditing(false);
    setConfirmOpen(false);
  }, [milestoneId]);

  const milestone = milestoneId
    ? state?.milestones.find((m) => m.id === milestoneId)
    : undefined;
  usePresenceStatus('Editing milestone', milestone != null);
  if (!state || !milestone) return null;

  const milestoneTasks = state.tasks.filter((t) => t.milestoneId === milestone.id);

  const update = (patch: UpdatePatch<Milestone>) => {
    dispatch({ type: 'milestone/update', id: milestone.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'milestone/remove', id: milestone.id });
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

  return (
    <>
    <Modal
      open={milestoneId !== null}
      title={editing ? t('releases.modal.editTitle') : t('releases.modal.viewTitle')}
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
              {t('releases.modal.delete')}
            </Button>
          )}
          <span className="flex-1" />
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEditing}>
                {t('releases.modal.cancel')}
              </Button>
              <Button variant="primary" onClick={finishEditing}>
                {t('releases.modal.done')}
              </Button>
            </>
          ) : (
            canEdit && (
              <Button variant="primary" onClick={startEditing}>
                {t('releases.modal.edit')}
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
              label={t('releases.modal.nameLabel')}
              value={milestone.name}
              onChange={(e) => update({ name: e.target.value })}
            />
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="milestone-version">
                  {t('releases.modal.versionLabel')}
                </label>
                <input
                  id="milestone-version"
                  className="input"
                  placeholder={t('releases.modal.versionPlaceholder')}
                  inputMode="decimal"
                  value={milestone.version ?? ''}
                  onChange={(e) => update({ version: e.target.value.replace(/[^0-9.]/g, '').trim() || null })}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="milestone-target">
                  {t('releases.modal.targetDateLabel')}
                </label>
                <input
                  id="milestone-target"
                  className="input"
                  type="date"
                  value={milestone.targetDate?.slice(0, 10) ?? ''}
                  onChange={(e) => update({ targetDate: e.target.value || null })}
                />
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="milestone-status">
                {t('releases.modal.statusLabel')}
              </label>
              <select
                id="milestone-status"
                className="select"
                value={milestone.status}
                onChange={(e) => update({ status: e.target.value as MilestoneStatus })}
              >
                <option value="planned">{t('releases.optionStatus.planned')}</option>
                <option value="inProgress">{t('releases.optionStatus.inProgress')}</option>
                <option value="released">{t('releases.optionStatus.released')}</option>
              </select>
            </div>
            <Textarea
              label={t('releases.modal.changelogLabel')}
              rows={4}
              value={milestone.changelog}
              onChange={(e) => update({ changelog: e.target.value })}
            />
            <p className="field-helper">{t('releases.modal.updated', { time: formatRelative(milestone.updatedAt) })}</p>
          </>
        ) : (
          <>
            <h3 className="detail-title">{milestone.name}</h3>
            <DetailList>
              <DetailRow label={t('releases.modal.statusLabel')}>
                <Badge tone={MILESTONE_STATUS[milestone.status].tone}>
                  {t(`releases.statusBadge.${milestone.status}`)}
                </Badge>
              </DetailRow>
              <DetailRow label={t('releases.modal.versionLabel')}>
                <span className="font-mono">
                  {milestone.version ? `v${milestone.version.replace(/^v/i, '')}` : <DetailEmpty />}
                </span>
              </DetailRow>
              <DetailRow label={t('releases.modal.targetDateLabel')}>
                <span className="font-mono">
                  {milestone.targetDate ? milestone.targetDate.slice(0, 10) : <DetailEmpty />}
                </span>
              </DetailRow>
              <DetailRow label={t('releases.modal.changelogLabel')}>
                {milestone.changelog.trim() ? milestone.changelog : <DetailEmpty>{t('releases.modal.noChangelog')}</DetailEmpty>}
              </DetailRow>
            </DetailList>
            <h4 className="detail-subtitle">{t('releases.modal.activity')}</h4>
            <ActivityList projectId={projectId} entity="milestones" entityId={milestone.id} />
            <h4 className="detail-subtitle">
              {t('releases.modal.tasksInRelease', { count: milestoneTasks.length })}
            </h4>
            {milestoneTasks.length === 0 ? (
              <p className="field-helper">{t('releases.modal.noTasksAssigned')}</p>
            ) : (
              <ul className="release-task-list">
                {milestoneTasks.map((task) => (
                  <li key={task.id} className="release-task-row">
                    <span className="release-task-title">{task.title}</span>
                    <span className="release-task-side">
                      <Badge tone={TASK_STATUS[task.status].tone}>
                        {t(`releases.taskStatus.${task.status}`)}
                      </Badge>
                      <span className="data-row-meta font-mono">#{shortId(task.id)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="field-helper">{t('releases.modal.updated', { time: formatRelative(milestone.updatedAt) })}</p>
          </>
        )}
      </div>
    </Modal>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title={t('releases.modal.deleteConfirmTitle')}
      description={t('releases.modal.deleteConfirmBody')}
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    </>
  );
}