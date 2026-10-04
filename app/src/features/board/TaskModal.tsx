import { TaskDetail } from './TaskDetail';

interface TaskModalProps {
  taskId: string | null;
  onClose: () => void;
  onNavigate?: (t: string) => void;
  onEnterFocus?: (t: string) => void;
}

export function TaskModal({ taskId, onClose, onNavigate, onEnterFocus }: TaskModalProps) {
  return <TaskDetail variant="modal" taskId={taskId} onClose={onClose} onNavigate={onNavigate} onEnterFocus={onEnterFocus} />;
}
