import { memo } from 'react';
import { LinkSimple, ListChecks } from '@phosphor-icons/react';
import { TASK_PRIORITY, TASK_STATUS } from '../../lib/labels';
import { formatDate, linkedTestCases, shortId } from '../../lib/utils';
import { taskDueChip } from '../../lib/due-dates';
import { startLabel } from '../../lib/start-dates';
import type { Task } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { PinButton } from '../../components/PinButton';

interface TaskCardProps {
  task: Task;
  onOpen: (taskId: string) => void;
  showStatus?: boolean;
  showMilestone?: boolean;
  unread?: boolean;
}

export const TaskCard = memo(function TaskCard({
  task,
  onOpen,
  showStatus = false,
  showMilestone = false,
  unread = false,
}: TaskCardProps) {
  const { state, canEdit, dispatch } = useProject();
  const blockers =
    task.blockedBy
      ?.map((id) => state?.tasks.find((t) => t.id === id))
      .filter((t): t is Task => t !== undefined) ?? [];
  const milestone = task.milestoneId
    ? state?.milestones.find((m) => m.id === task.milestoneId)
    : undefined;
  const testCases = linkedTestCases(task.id, state?.testCases ?? []);
  const dueChip = taskDueChip(task);

  const chipRows = (showStatus || showMilestone) && (
    <div className="task-card-labels">
      {showStatus && (
        <Badge tone={TASK_STATUS[task.status].tone}>{TASK_STATUS[task.status].label}</Badge>
      )}
      {showMilestone && milestone && <span className="task-label">{milestone.name}</span>}
      {task.labels.map((label) => (
        <span key={label} className="task-label">
          {label}
        </span>
      ))}
    </div>
  );

  return (
    <div className="task-card-wrap">
      <button
        type="button"
        className="task-card"
        draggable={canEdit}
        data-testid="task-card"
        data-task-id={task.id}
        onClick={() => onOpen(task.id)}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
      <div className="task-card-top">
        <span className="task-card-title">{task.title}</span>
        <Badge tone={TASK_PRIORITY[task.priority].tone}>{TASK_PRIORITY[task.priority].label}</Badge>
      </div>

      {(chipRows && task.labels.length > 0) || showStatus || (showMilestone && milestone) ? (
        chipRows
      ) : null}

      <div className="task-card-meta">
        <span className="task-meta-left">
          {task.dueDate && dueChip.label && (
            <span
              className={`task-due task-due-${dueChip.tone}`}
              title={formatDate(task.dueDate)}
            >
              {dueChip.label}
            </span>
          )}
          {task.startDate && (
            <span className="task-start" title={formatDate(task.startDate)}>
              {startLabel(task.startDate)}
            </span>
          )}
          {(task.estimate != null || task.actualHours != null) && (
            <span className="tabular" title="actual / estimate (hours)">
              {task.actualHours ?? 0}/{task.estimate ?? '—'}h
            </span>
          )}
          {blockers.length > 0 && (
            <span
              className="task-blockers"
              title={`Blocked by: ${blockers.map((b) => b.title).join(', ')}`}
            >
              <LinkSimple size={11} weight="bold" aria-hidden="true" />
              {blockers.length}
            </span>
          )}
          {testCases.length > 0 && (
            <span
              className="task-tests"
              title={testCases.map((tc) => `${tc.name} (${tc.status})`).join(', ')}
            >
              <ListChecks size={11} weight="bold" aria-hidden="true" />
              {testCases.length}
            </span>
          )}
        </span>
        <span className="task-card-id font-mono" title={task.id}>
          #{shortId(task.id)}
        </span>
        {unread && (
          <>
            <span className="unread-dot" aria-hidden="true" />
            <span className="sr-only">Unread</span>
          </>
        )}
      </div>

      <span className="sr-only">
        {TASK_STATUS[task.status].label} task. Drag to move between columns, or move with arrow keys when focused.
      </span>
      </button>
      {canEdit && (
        <PinButton
          pinned={!!task.pinned}
          label="task"
          onToggle={() => dispatch({ type: 'task/update', id: task.id, patch: { pinned: !task.pinned } })}
        />
      )}
    </div>
  );
});
