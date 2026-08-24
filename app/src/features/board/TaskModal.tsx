import { useEffect, useRef, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import {
  TASK_PRIORITY,
  TASK_PRIORITY_ORDER,
  TASK_STATUS,
  TEST_CASE_STATUS,
} from '../../lib/labels';
import { formatDate, formatRelative, isTaskCompletable, linkedTestCases, parseLabels } from '../../lib/utils';
import { api } from '../../lib/api';
import { taskDueChip } from '../../lib/due-dates';
import { startAfterDue, startLabel } from '../../lib/start-dates';
import type { State, Task, TaskPriority, TaskStatus, TeamMember, TestCaseStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject, wouldCreateCycle } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Badge } from '../../components/Badge';
import { ActivityList } from '../../components/ActivityList';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty, DetailList, DetailRow } from '../../components/DetailList';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Textarea } from '../../components/Textarea';

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'inProgress', 'review', 'done'];

interface TaskModalProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskModal({ taskId, onClose }: TaskModalProps) {
  const { t } = useTranslation('tracker');
  const { state, dispatch, canEdit, projectId, teamId } = useProject();
  const [editing, setEditing] = useState(false);
  const [cycleWarn, setCycleWarn] = useState<string | null>(null);
  const [doneWarn, setDoneWarn] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const editSnapshot = useRef<State | null>(null);

  useEffect(() => {
    if (teamId) {
      api
        .listMembers(teamId)
        .then(setMembers)
        .catch(() => setMembers([]));
    } else {
      setMembers([]);
    }
  }, [teamId]);

  useEffect(() => {
    setEditing(false);
    setCycleWarn(null);
    setDoneWarn(null);
    setConfirmOpen(false);
  }, [taskId]);

  const task = state?.tasks.find((t) => t.id === taskId);
  usePresenceStatus(t('board.taskModal.presenceEditing'), task != null);
  if (!task) return null;

  const update = (patch: UpdatePatch<Task>) =>
    dispatch({ type: 'task/update', id: task.id, patch });

  const changeStatus = (next: TaskStatus) => {
    if (next === 'done' && !isTaskCompletable(task, state!.testCases)) {
      const pending = state!.testCases.filter(
        (tc) => tc.taskId === task.id && tc.status !== 'pass',
      );
      setDoneWarn(
        t('board.taskModal.cannotMarkDone', { count: pending.length }),
      );
      return;
    }
    setDoneWarn(null);
    update({ status: next });
  };

  const otherTasks = state!.tasks.filter((t) => t.id !== task.id);
  const dateWarn = startAfterDue(task.startDate, task.dueDate)
    ? t('board.taskModal.dateWarn')
    : null;
  const testCases = linkedTestCases(task.id, state!.testCases);
  const blockerNames = task.blockedBy
    .map((id) => state!.tasks.find((t) => t.id === id)?.title)
    .filter((t): t is string => t !== undefined);
  const blockedTasks = task.blockedBy
    .map((id) => state!.tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);
  const milestone = task.milestoneId
    ? state!.milestones.find((m) => m.id === task.milestoneId)
    : undefined;
  const startEditing = () => {
    editSnapshot.current = structuredClone(state!);
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

  const toggleBlocker = (id: string) => {
    const next = task.blockedBy.includes(id)
      ? task.blockedBy.filter((x) => x !== id)
      : [...task.blockedBy, id];
    if (next.length > task.blockedBy.length && wouldCreateCycle(state!.tasks, task.id, next)) {
      setCycleWarn(t('board.taskModal.cycleWarn'));
      return;
    }
    setCycleWarn(null);
    update({ blockedBy: next });
  };

  const remove = () => {
    dispatch({ type: 'task/remove', id: task.id });
    onClose();
  };

  return (
    <>
    <Modal
      open
      title={editing ? t('board.taskModal.editTitle') : t('board.taskModal.viewTitle')}
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
              {t('board.taskModal.delete')}
            </Button>
          )}
          <span className="flex-1" />
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEditing}>
                {t('board.taskModal.cancel')}
              </Button>
              <Button variant="primary" onClick={finishEditing}>
                {t('board.taskModal.done')}
              </Button>
            </>
          ) : (
            canEdit && (
              <Button variant="primary" onClick={startEditing}>
                {t('board.taskModal.edit')}
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
              label={t('board.taskModal.titleLabel')}
              value={task.title}
              onChange={(e) => update({ title: e.target.value })}
            />

            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="task-status">
                  {t('board.taskModal.statusLabel')}
                </label>
                <select
                  id="task-status"
                  className="select"
                  value={task.status}
                  onChange={(e) => changeStatus(e.target.value as TaskStatus)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS[s].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="task-priority">
                  {t('board.taskModal.priorityLabel')}
                </label>
                <select
                  id="task-priority"
                  className="select"
                  value={task.priority}
                  onChange={(e) => update({ priority: e.target.value as TaskPriority })}
                >
                  {TASK_PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {TASK_PRIORITY[p].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {doneWarn && <InlineError>{doneWarn}</InlineError>}

            <div className="field">
              <SearchableSelect
                id="task-milestone"
                label={t('board.taskModal.milestoneLabel')}
                value={task.milestoneId}
                options={state!.milestones.map((m) => ({ value: m.id, label: m.name }))}
                onChange={(v) => update({ milestoneId: v })}
              />
            </div>

            <div className="field">
              <SearchableSelect
                id="task-assignee"
                label={t('board.taskModal.assigneeLabel')}
                value={task.assigneeId ?? null}
                options={members.map((m) => ({
                  value: m.id,
                  label: m.displayName || m.email,
                }))}
                onChange={(v) => update({ assigneeId: v })}
              />
            </div>

            <Input
              label={t('board.taskModal.dueDateLabel')}
              type="date"
              value={task.dueDate?.slice(0, 10) ?? ''}
              onChange={(e) => update({ dueDate: e.target.value === '' ? null : e.target.value })}
            />

            <Input
              label={t('board.taskModal.startDateLabel')}
              type="date"
              value={task.startDate?.slice(0, 10) ?? ''}
              onChange={(e) => update({ startDate: e.target.value === '' ? null : e.target.value })}
            />
            {dateWarn && <InlineError>{dateWarn}</InlineError>}

            <Input
              label={t('board.taskModal.estimateLabel')}
              type="number"
              min={0}
              value={task.estimate ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                update({ estimate: v === '' ? undefined : Math.max(0, Number(v)) });
              }}
            />

            <Input
              label={t('board.taskModal.labelsLabel')}
              placeholder={t('board.taskModal.labelsPlaceholder')}
              value={task.labels.join(', ')}
              onChange={(e) => update({ labels: parseLabels(e.target.value) })}
            />

            <Textarea
              label={t('board.taskModal.descriptionLabel')}
              rows={4}
              value={task.description}
              onChange={(e) => update({ description: e.target.value })}
            />

            <div className="field">
              <label className="field-label">
                {blockerNames.length > 0
                  ? t('board.taskModal.blockedByWithNames', { names: blockerNames.join(', ') })
                  : t('board.taskModal.blockedByLabel')}
              </label>
              <div className="blocker-list">
                {otherTasks.length === 0 && (
                  <p className="field-helper">{t('board.taskModal.noBlockers')}</p>
                )}
                {otherTasks.map((t) => (
                  <label key={t.id} className="blocker-row">
                    <input
                      type="checkbox"
                      checked={task.blockedBy.includes(t.id)}
                      onChange={() => toggleBlocker(t.id)}
                    />
                    <span className="blocker-title">{t.title}</span>
                    <span className="blocker-state font-mono">{TASK_STATUS[t.status].label}</span>
                  </label>
                ))}
              </div>
              {cycleWarn && <InlineError>{cycleWarn}</InlineError>}
            </div>

            <div className="field">
              <label className="field-label">
                {testCases.length > 0
                  ? t('board.taskModal.testCasesWithCount', { count: testCases.length })
                  : t('board.taskModal.testCasesLabel')}
              </label>
              {testCases.length === 0 ? (
                <p className="field-helper">{t('board.taskModal.noTestCases')}</p>
              ) : (
                <div className="test-list">
                  {testCases.map((tc) => (
                    <div key={tc.id} className="test-row" title={tc.steps || tc.name}>
                      <span className="test-title">{tc.name}</span>
                      <select
                        className="select test-status-select"
                        aria-label={t('board.taskModal.statusOfName', { name: tc.name })}
                        value={tc.status}
                        onChange={(e) =>
                          dispatch({
                            type: 'testCase/update',
                            id: tc.id,
                            patch: { status: e.target.value as TestCaseStatus },
                          })
                        }
                      >
                        <option value="pending">{t('board.taskModal.optPending')}</option>
                        <option value="pass">{t('board.taskModal.optPass')}</option>
                        <option value="fail">{t('board.taskModal.optFail')}</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="field-helper">
              {t('board.taskModal.updated', { time: formatRelative(task.updatedAt) })}
            </p>
          </>
        ) : (
          <>
            <h3 className="detail-title">{task.title || <DetailEmpty>Untitled task</DetailEmpty>}</h3>
            <DetailList>
              <DetailRow label="Status">
                <Badge tone={TASK_STATUS[task.status].tone}>{TASK_STATUS[task.status].label}</Badge>
              </DetailRow>
              <DetailRow label="Priority">
                <Badge tone={TASK_PRIORITY[task.priority].tone}>
                  {TASK_PRIORITY[task.priority].label}
                </Badge>
              </DetailRow>
              <DetailRow label="Milestone">
                {milestone ? milestone.name : <DetailEmpty />}
              </DetailRow>
              <DetailRow label="Due date">
                {task.dueDate ? (
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <span className={`task-due task-due-${taskDueChip(task).tone}`}>
                      {taskDueChip(task).label}
                    </span>
                    <span className="text-muted">{formatDate(task.dueDate)}</span>
                  </span>
                ) : (
                  <DetailEmpty />
                )}
              </DetailRow>
              <DetailRow label="Done date">
                {task.completedAt ? formatDate(task.completedAt) : <DetailEmpty />}
              </DetailRow>
              <DetailRow label="Start date">
                {task.startDate ? (
                  <span className="task-due task-due-neutral">{startLabel(task.startDate)}</span>
                ) : (
                  <DetailEmpty />
                )}
              </DetailRow>
              <DetailRow label="Estimate">
                {task.estimate != null ? `${task.estimate}h` : <DetailEmpty />}
              </DetailRow>
              <DetailRow label="Actual">
                {task.actualHours != null ? `${task.actualHours}h` : <DetailEmpty />}
              </DetailRow>
              <DetailRow label="Labels">
                {task.labels.length > 0 ? (
                  <span className="detail-chips">
                    {task.labels.map((l) => (
                      <Badge key={l}>{l}</Badge>
                    ))}
                  </span>
                ) : (
                  <DetailEmpty />
                )}
              </DetailRow>
              <DetailRow label="Description">
                {task.description.trim() ? task.description : <DetailEmpty>No description.</DetailEmpty>}
              </DetailRow>
              <DetailRow label="Blocked by">
                {blockedTasks.length > 0 ? (
                  <div className="test-list">
                    {blockedTasks.map((t) => (
                      <div key={t.id} className="test-row">
                        <span className="test-title">{t.title}</span>
                        <Badge tone={TASK_STATUS[t.status].tone}>{TASK_STATUS[t.status].label}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <DetailEmpty />
                )}
              </DetailRow>
              <DetailRow label="Test cases">
                {testCases.length === 0 ? (
                  <DetailEmpty>No test cases linked to this task yet.</DetailEmpty>
                ) : (
                  <div className="test-list">
                    {testCases.map((tc) => (
                      <div key={tc.id} className="test-row" title={tc.steps || tc.name}>
                        <span className="test-title">{tc.name}</span>
                        <Badge tone={TEST_CASE_STATUS[tc.status].tone}>
                          {TEST_CASE_STATUS[tc.status].label}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </DetailRow>
            </DetailList>
            <h4 className="detail-subtitle">Activity</h4>
            <ActivityList projectId={projectId} entity="tasks" entityId={task.id} />
            <p className="field-helper">Updated {formatRelative(task.updatedAt)}</p>
          </>
        )}
      </div>
    </Modal>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title="Delete task?"
      description="This permanently deletes the task. This cannot be undone."
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    </>
  );
}