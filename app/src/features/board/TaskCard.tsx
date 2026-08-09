import { LinkSimple } from '@phosphor-icons/react';
import { TASK_PRIORITY, TASK_STATUS } from '../../lib/labels';
import { shortId } from '../../lib/utils';
import type { Task } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { Badge } from '../../components/Badge';

interface TaskCardProps {
  task: Task;
  onOpen: () => void;
}

export function TaskCard({ task, onOpen }: TaskCardProps) {
  const { state } = useProject();
  const blockers =
    task.blockedBy
      ?.map((id) => state?.tasks.find((t) => t.id === id))
      .filter((t): t is Task => t !== undefined) ?? [];

  return (
    <div
      className="task-card"
      draggable
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <div className="task-card-top">
        <span className="task-card-title">{task.title}</span>
        <Badge tone={TASK_PRIORITY[task.priority].tone}>{TASK_PRIORITY[task.priority].label}</Badge>
      </div>

      {task.labels.length > 0 && (
        <div className="task-card-labels">
          {task.labels.map((label) => (
            <span key={label} className="task-label">
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="task-card-meta">
        <span className="task-meta-left">
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
        </span>
        <span className="task-card-id font-mono" title={task.id}>
          #{shortId(task.id)}
        </span>
      </div>

      <span className="sr-only">
        {TASK_STATUS[task.status].label} task. Drag to move between columns.
      </span>
    </div>
  );
}
