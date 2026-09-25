import { memo, useCallback, useRef } from 'react';
import { GitBranch, LinkSimple, ListChecks } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TASK_PRIORITY, TASK_PRIORITY_SHORT, TASK_STATUS, findLabelDef, labelChipStyleFor } from '../../lib/labels';
import { formatDate, isTaskCompletable, linkedTestCases, shortId, taskBlockSummary } from '../../lib/utils';
import { taskDueChip } from '../../lib/due-dates';
import { startLabel } from '../../lib/start-dates';
import type { Task } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { TaskPriorityIcon, TaskStatusIcon } from '../../lib/task-icons';
import { PinButton } from '../../components/PinButton';
import { Tooltip } from '../../components/Tooltip';
import { GCalSyncedMark } from '../integrations/GCalSyncedMark';
import { GitHubLinkBadge } from '../integrations/GitHubLinkBadge';
import { useTouchDrag } from '../../hooks/useTouchDrag';

interface MemberInfo {
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
}

interface TaskCardProps {
  task: Task;
  onOpen: (taskId: string) => void;
  members?: Record<string, MemberInfo>;
  showStatus?: boolean;
  showMilestone?: boolean;
  unread?: boolean;
  onTouchDrop?: (taskId: string, dropKey: string | null) => void;
  /** Matikan drag (HTML5 + long-press) saat kolom tak berdampingan (swipe HP). */
  dragEnabled?: boolean;
  /** Tampilan ringkas satu baris untuk viewport swipe. */
  density?: 'full' | 'compact';
}

export const TaskCard = memo(function TaskCard({
  task,
  onOpen,
  members,
  showStatus = false,
  showMilestone = false,
  unread = false,
  onTouchDrop,
  dragEnabled = true,
  density = 'full',
}: TaskCardProps) {
  const { t } = useTranslation('tracker');
  const { state, canEdit, dispatch, projectId } = useProject();
  const cardRef = useRef<HTMLDivElement>(null);
  const handleTouchDrop = useCallback(
    (dropKey: string | null) => onTouchDrop?.(task.id, dropKey),
    [task.id, onTouchDrop],
  );
  const canDrag = canEdit && dragEnabled;
  useTouchDrag(cardRef, { enabled: canDrag && !!onTouchDrop, onDrop: handleTouchDrop });
  const assignee = task.assigneeId ? members?.[task.assigneeId] : undefined;
  const assigneeName = assignee ? (assignee.displayName || assignee.email) : undefined;
  const blockers =
    task.blockedBy
      ?.map((id) => state?.tasks.find((t) => t.id === id))
      .filter((t): t is Task => t !== undefined) ?? [];
  const milestone = task.milestoneId
    ? state?.milestones.find((m) => m.id === task.milestoneId)
    : undefined;
  const testCases = linkedTestCases(task.id, state?.testCases ?? []);
  const dueChip = taskDueChip(task);
  const subtasks = (state?.tasks ?? []).filter((tt) => tt.parentTaskId === task.id);
  const subDone = subtasks.filter((tt) => tt.status === 'done').length;
  const checklist = task.checklist ?? [];
  const checkDone = checklist.filter((c) => c.done).length;
  const subEstimate = subtasks.reduce((s, tt) => s + (tt.estimate ?? 0), 0);
  const isSubtask = !!task.parentTaskId;
  const parentTask = isSubtask
    ? (state?.tasks ?? []).find((tt) => tt.id === task.parentTaskId)
    : undefined;
  /** Due rollup: due terdekat subtask yang masih open (khusus parent tanpa due sendiri). */
  const subDueRollup = (() => {
    if (isSubtask || task.dueDate) return null;
    const dues = subtasks.flatMap((tt) => (tt.status !== 'done' && tt.dueDate ? [tt.dueDate] : []));
    if (dues.length === 0) return null;
    return dues.sort()[0]!;
  })();
  const subDueChip = subDueRollup
    ? taskDueChip({ status: 'todo', dueDate: subDueRollup, completedAt: null })
    : null;

  const statusChip = showStatus && (
    <Badge tone={TASK_STATUS[task.status].tone}>
      <TaskStatusIcon status={task.status} size={11} />
      {TASK_STATUS[task.status].label}
    </Badge>
  );
  const milestoneChip = showMilestone && milestone && (
    <span className="task-label" title={milestone.name}>
      {milestone.name}
    </span>
  );
  const MAX_VISIBLE_LABELS = 2;
  const visibleLabels = task.labels.slice(0, MAX_VISIBLE_LABELS);
  const hiddenLabels = task.labels.slice(MAX_VISIBLE_LABELS);
  const labelDefs = state?.labelDefs;
  const labelTitle = (label: string) => findLabelDef(label, labelDefs)?.description || label;
  const hasChips = Boolean(statusChip) || Boolean(milestoneChip) || task.labels.length > 0;
  const chipRows = hasChips && (
    <div className="task-card-labels">
      {statusChip}
      {milestoneChip}
      {visibleLabels.map((label, i) => (
        <Tooltip key={`${label}-${i}`} title={labelTitle(label)}>
          <span className="task-label" style={labelChipStyleFor(label, labelDefs)}>
            {label}
          </span>
        </Tooltip>
      ))}
      {hiddenLabels.length > 0 && (
        <Tooltip title={hiddenLabels.join(', ')}>
          <span className="task-label-more">+{hiddenLabels.length}</span>
        </Tooltip>
      )}
    </div>
  );

  return (
    <div className={`task-card-wrap${task.pinned ? ' card-pinned' : ''}`}>
      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        className={`task-card task-card-priority-${task.priority}${density === 'compact' ? ' task-card--compact' : ''}`}
        draggable={canDrag}
        data-testid="task-card"
        data-task-id={task.id}
        aria-label={task.title}
        onClick={() => onOpen(task.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(task.id);
          }
        }}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        {density === 'compact' ? (
          <>
            <Tooltip title={task.title}>
              <div className="task-card-compact-name">
                {task.title}
              {isSubtask && parentTask && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t('board.taskCard.subtaskOf', { defaultValue: 'Subtask of {{parent}}', parent: parentTask.title })}>
                  <GitBranch size={11} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parentTask.title}</span>
                </span>
              )}
            </div>
            </Tooltip>
            <div className="task-card-compact-row">
              {assigneeName && task.assigneeId && assignee && (
                <span className="task-avatar" title={assigneeName}>
                  <Avatar
                    src={assignee.avatarUrl ?? null}
                    name={assigneeName}
                    email={assignee.email}
                    id={task.assigneeId}
                    size={18}
                    className="task-assignee-avatar"
                  />
                  <span className="sr-only">{assigneeName}</span>
                </span>
              )}
              {visibleLabels.map((label, i) => (
                <Tooltip key={`${label}-${i}`} title={labelTitle(label)}>
                  <span className="task-label" style={labelChipStyleFor(label, labelDefs)}>
                    {label}
                  </span>
                </Tooltip>
              ))}
              {hiddenLabels.length > 0 && (
                <Tooltip title={hiddenLabels.join(', ')}>
                  <span className="task-label-more">+{hiddenLabels.length}</span>
                </Tooltip>
              )}
              <Badge
                tone={TASK_PRIORITY[task.priority].tone}
                className="task-card-priority"
                title={t('board.taskCard.priorityTitle', { priority: TASK_PRIORITY[task.priority].label })}
              >
                <TaskPriorityIcon priority={task.priority} size={11} />
                {TASK_PRIORITY_SHORT[task.priority]}
              </Badge>
              {(task.estimate != null || task.actualHours != null) && (
                <span className="tabular" title={t('board.taskCard.actualEstimate')}>
                  {task.actualHours ?? 0}/{task.estimate ?? '—'}h
                </span>
              )}
              {unread && (
                <span
                  className="unread-pill"
                  role="status"
                  aria-label={t('board.taskCard.unreadAria', { defaultValue: 'New — not yet viewed' })}
                  title={t('board.taskCard.unreadTitle', { defaultValue: 'New · not yet viewed' })}
                >
                  {t('board.taskCard.unread')}
                </span>
              )}
            </div>
          </>
        ) : (
        <>
        <div className="task-card-top">
          <Tooltip title={String(t('board.taskCard.priorityTitle', { priority: TASK_PRIORITY[task.priority].label }))}>
            <Badge tone={TASK_PRIORITY[task.priority].tone} className="task-card-priority">
              <TaskPriorityIcon priority={task.priority} size={11} />
              {TASK_PRIORITY_SHORT[task.priority]}
            </Badge>
          </Tooltip>
        </div>

        <div className="task-card-title" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {canEdit && (
            <Tooltip
              title={(() => {
                if (task.status === 'done') return t('board.unmarkDone', { defaultValue: 'Kembalikan ke Todo' });
                if (!state) return t('board.markDone', { defaultValue: 'Tandai selesai' });
                if (isTaskCompletable(task, state.testCases, state.tasks)) return t('board.markDone', { defaultValue: 'Tandai selesai' });
                return taskBlockSummary(task, state.testCases, state.tasks).join(', ');
              })()}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={task.status === 'done'}
                aria-label={task.status === 'done' ? t('board.unmarkDone', { defaultValue: 'Kembalikan ke Todo' }) : t('board.markDone', { defaultValue: 'Tandai selesai' })}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!state) return;
                  const next = task.status === 'done' ? 'todo' : 'done';
                  if (next === 'done' && !isTaskCompletable(task, state.testCases, state.tasks)) return;
                  dispatch({ type: 'task/update', id: task.id, patch: { status: next } });
                }}
                onKeyDown={(e) => { e.stopPropagation(); }}
                style={{
                  flexShrink: 0,
                  width: 18,
                  height: 18,
                  marginTop: 1,
                  borderRadius: 6,
                  border: '1px solid var(--border-strong)',
                  background: task.status === 'done' ? 'var(--status-success)' : 'transparent',
                  color: task.status === 'done' ? '#fff' : 'transparent',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  lineHeight: 1,
                }}
              >
                {task.status === 'done' ? '✓' : ''}
              </button>
            </Tooltip>
          )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <Tooltip title={task.title}>
                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
              </Tooltip>
              {isSubtask && parentTask && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t('board.taskCard.subtaskOf', { defaultValue: 'Subtask of {{parent}}', parent: parentTask.title })}>
                  <GitBranch size={11} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parentTask.title}</span>
                </span>
              )}
            </span>
          </div>

        {chipRows || null}

        <div className="task-card-meta">
          <span className="task-meta-left">
            {task.dueDate && dueChip.label && (
              <Tooltip
                title={
                  task.startDate && task.startDate !== task.dueDate
                    ? `${formatDate(task.startDate)} → ${formatDate(task.dueDate)}${dueChip.title ? ` · ${dueChip.title}` : ''}`
                    : dueChip.title || formatDate(task.dueDate)
                }
              >
                <span className={`task-due task-due-${dueChip.tone}`}>
                  {task.startDate && task.startDate !== task.dueDate ? `${formatDate(task.startDate)} → ${dueChip.label}` : dueChip.label}
                </span>
              </Tooltip>
            )}
            {!task.dueDate && task.startDate && (
              <Tooltip title={formatDate(task.startDate)}>
                <span className="task-start">
                  {startLabel(task.startDate)}
                </span>
              </Tooltip>
            )}
            {(task.estimate != null || task.actualHours != null || subEstimate > 0) && !(task.dueDate && dueChip.label) && (
              <Tooltip title={String(t('board.taskCard.actualEstimate'))}>
                <span className="tabular">
                  {task.actualHours ?? 0}/{task.estimate ?? (subEstimate > 0 ? `Σ${subEstimate}` : '—')}h
                </span>
              </Tooltip>
            )}
            <GCalSyncedMark taskId={task.id} projectId={projectId} />
            <GitHubLinkBadge links={task.githubLinks} />
            {subDueChip && subDueRollup && (
              <Tooltip title={subDueChip.title || formatDate(subDueRollup)}>
                <span className={`task-due task-due-${subDueChip.tone}`}>
                  {subDueChip.label}
                </span>
              </Tooltip>
            )}
            {subtasks.length > 0 && (
              <Tooltip title={subtasks.map((ss) => `${ss.title} (${ss.status})`).join(', ')}>
                <span className="task-tests">
                  ▸ {subDone}/{subtasks.length}
                </span>
              </Tooltip>
            )}
            {subtasks.length > 0 && (
              <span
                className="usage-meter-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={subtasks.length}
                aria-valuenow={subDone}
                aria-label={t('board.taskCard.subtaskProgress', { defaultValue: '{{done}} of {{total}} subtasks done', done: subDone, total: subtasks.length })}
                title={t('board.taskCard.subtaskProgress', { defaultValue: '{{done}} of {{total}} subtasks done', done: subDone, total: subtasks.length })}
                style={{ width: 56, flexShrink: 0, alignSelf: 'center' }}
              >
                <span className="usage-meter-fill" style={{ display: 'block', width: `${subtasks.length === 0 ? 0 : Math.round((subDone / subtasks.length) * 100)}%` }} />
              </span>
            )}
            {checklist.length > 0 && (
              <Tooltip title={checklist.map((c) => `${c.title} (${c.done ? 'done' : 'open'})`).join(', ')}>
                <span className="task-tests">
                  ☑ {checkDone}/{checklist.length}
                </span>
              </Tooltip>
            )}
            {isSubtask && parentTask && (
              <Tooltip title={t('board.taskCard.subtaskOf', { defaultValue: 'Subtask of {{parent}}', parent: parentTask.title })}>
                <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)' }} aria-hidden="true">
                  <GitBranch size={11} weight="bold" />
                </span>
              </Tooltip>
            )}
          </span>
          <span className="task-meta-right">
            {assigneeName && task.assigneeId && assignee && (
              <Tooltip title={assigneeName}>
                <span className="task-avatar">
                  <Avatar
                    src={assignee.avatarUrl ?? null}
                    name={assigneeName}
                    email={assignee.email}
                    id={task.assigneeId}
                    size={16}
                    className="task-assignee-avatar"
                  />
                  <span className="sr-only">{assigneeName}</span>
                </span>
              </Tooltip>
            )}
            {blockers.length > 0 && (
              <Tooltip
                title={String(t('board.taskCard.blockedByTooltip', {
                  names: blockers.map((b) => b.title).join(', '),
                }))}
              >
                <span className="task-blockers">
                  <LinkSimple size={11} weight="bold" aria-hidden="true" />
                  {blockers.length}
                </span>
              </Tooltip>
            )}
            {testCases.length > 0 && (
              <Tooltip title={testCases.map((tc) => `${tc.name} (${tc.status})`).join(', ')}>
                <span className="task-tests">
                  <ListChecks size={11} weight="bold" aria-hidden="true" />
                  {testCases.length}
                </span>
              </Tooltip>
            )}
            {(task.estimate != null || task.actualHours != null || subEstimate > 0) && task.dueDate && dueChip.label && (
              <Tooltip title={String(t('board.taskCard.actualEstimate'))}>
                <span className="tabular">
                  {task.actualHours ?? 0}/{task.estimate ?? (subEstimate > 0 ? `Σ${subEstimate}` : '—')}h
                </span>
              </Tooltip>
            )}
            <span className="task-card-id font-mono">#{shortId(task.id)}</span>
            {unread && (
              <Tooltip title={String(t('board.taskCard.unreadTitle', { defaultValue: 'New · not yet viewed' }))}>
                <span
                  className="unread-pill"
                  role="status"
                  aria-label={t('board.taskCard.unreadAria', { defaultValue: 'New — not yet viewed' })}
                >
                  {t('board.taskCard.unread')}
                </span>
              </Tooltip>
            )}
          </span>
        </div>

        <span className="sr-only">
          {t('board.taskCard.srSummary', {
            status: TASK_STATUS[task.status].label,
            priority: TASK_PRIORITY[task.priority].label,
          })}
        </span>
        </>)}
      </div>
      {canEdit && (
        <PinButton
          className="task-card-pin"
          pinned={!!task.pinned}
          label="task"
          onToggle={() => dispatch({ type: 'task/update', id: task.id, patch: { pinned: !task.pinned } })}
        />
      )}
    </div>
  );
});