import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import type { TaskStatus } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';
import { NewTaskModal } from './NewTaskModal';
import { InlineError } from '../../components/InlineError';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'inProgress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
];

export function BoardPage() {
  const { state, loading, error, dispatch, canEdit } = useProject();
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<TaskStatus | null>(null);

  if (loading) {
    return (
      <div className="kanban">
        {COLUMNS.map((col) => (
          <div key={col.status} className="kanban-col" aria-hidden="true">
            <div className="kanban-col-header">
              <span>{col.label}</span>
            </div>
            <div className="kanban-col-body">
              <Skeleton style={{ height: 84, width: '100%' }} />
              <Skeleton style={{ height: 84, width: '100%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <InlineError>
        {error}
      </InlineError>
    );
  }

  if (!state) return null;

  function handleDrop(status: TaskStatus, e: React.DragEvent) {
    const id = e.dataTransfer.getData('text/plain');
    const task = state?.tasks.find((t) => t.id === id);
    if (task && task.status !== status) {
      dispatch({ type: 'task/update', id, patch: { status } });
    }
    setOverCol(null);
  }

  return (
    <div>
      <div className="kanban">
        {COLUMNS.map((col) => {
          const tasks = state.tasks.filter((t) => t.status === col.status);
          return (
            <div
              key={col.status}
              className="kanban-col"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setOverCol(col.status);
              }}
              onDragLeave={() => setOverCol((cur) => (cur === col.status ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(col.status, e);
              }}
            >
              <div className="kanban-col-header">
                <span className="kanban-col-label">{col.label}</span>
                <span className="kanban-col-count tabular">{tasks.length}</span>
              </div>
              <div className={`kanban-col-body ${overCol === col.status ? 'kanban-drop-active' : ''}`}>
                {tasks.length === 0 && <p className="kanban-col-empty">Drop tasks here</p>}
                {tasks.map((task) => (
                  <TaskCard key={task.id} task={task} onOpen={() => setEditId(task.id)} />
                ))}
              </div>
              <div className="kanban-col-add">
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="kanban-add-btn"
                    leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />}
                    onClick={() => setNewStatus(col.status)}
                  >
                    Add task
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskModal taskId={editId} onClose={() => setEditId(null)} />
      <NewTaskModal status={newStatus} onClose={() => setNewStatus(null)} />
    </div>
  );
}
