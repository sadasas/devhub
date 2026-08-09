import { useState } from 'react';
import type { FormEvent } from 'react';
import { newId, nowIso } from '../../lib/utils';
import type { TaskPriority, TaskStatus } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface NewTaskModalProps {
  status: TaskStatus | null;
  onClose: () => void;
}

export function NewTaskModal({ status, onClose }: NewTaskModalProps) {
  const { dispatch } = useProject();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimate, setEstimate] = useState('');
  const [labels, setLabels] = useState('');
  const [description, setDescription] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!status || !title.trim()) return;
    const parsedEstimate = Number(estimate);
    const ts = nowIso();
    dispatch({
      type: 'task/add',
      task: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        title: title.trim(),
        status,
        priority,
        estimate: estimate !== '' && !Number.isNaN(parsedEstimate) ? parsedEstimate : undefined,
        labels: labels
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 20),
        blockedBy: [],
        description: description.trim(),
      },
    });
    setTitle('');
    setPriority('medium');
    setEstimate('');
    setLabels('');
    setDescription('');
    onClose();
  }

  return (
    <Modal
      open={status !== null}
      title="New task"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-task-form" disabled={!title.trim()}>
            Add task
          </Button>
        </>
      }
    >
      <form id="new-task-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label="Title"
          required
          autoFocus
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="field">
          <label className="field-label" htmlFor="new-task-priority">
            Priority
          </label>
          <select
            id="new-task-priority"
            className="select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <Input
          label="Estimate (hours)"
          type="number"
          min={0}
          placeholder="Optional"
          value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
        />
        <Input
          label="Labels"
          placeholder="comma, separated"
          value={labels}
          onChange={(e) => setLabels(e.target.value)}
        />
        <Textarea
          label="Description"
          rows={3}
          placeholder="Optional"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </form>
    </Modal>
  );
}
