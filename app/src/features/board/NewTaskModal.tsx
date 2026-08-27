import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso, parseLabels } from '../../lib/utils';
import { TASK_PRIORITY, TASK_PRIORITY_ORDER } from '../../lib/labels';
import { startAfterDue } from '../../lib/start-dates';
import type { TaskPriority, TaskStatus } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Textarea } from '../../components/Textarea';

interface NewTaskModalProps {
  open: boolean;
  status: TaskStatus | null;
  milestoneId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  onClose: () => void;
}

export function NewTaskModal({ open, status, milestoneId, dueDate, startDate, onClose }: NewTaskModalProps) {
  const { state, dispatch } = useProject();
  const { t } = useTranslation('tracker');
  usePresenceStatus(t('board.newTaskModal.presenceCreating'), open);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimate, setEstimate] = useState('');
  const [labels, setLabels] = useState('');
  const [description, setDescription] = useState('');
  const [milestone, setMilestone] = useState<string | null>(milestoneId ?? null);
  const [dueDateInput, setDueDateInput] = useState('');
  const [startDateInput, setStartDateInput] = useState('');

  useEffect(() => {
    if (open) {
      setMilestone(milestoneId ?? null);
      setDueDateInput(dueDate ?? '');
      setStartDateInput(startDate ?? '');
    }
  }, [open, milestoneId, dueDate, startDate]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const taskStatus = status ?? 'todo';
    const parsedEstimate = Number(estimate);
    const ts = nowIso();
    dispatch({
      type: 'task/add',
      task: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        title: title.trim(),
        status: taskStatus,
        priority,
        estimate: estimate !== '' && !Number.isNaN(parsedEstimate) ? Math.max(0, parsedEstimate) : undefined,
        labels: parseLabels(labels),
        blockedBy: [],
        milestoneId: milestone,
        dueDate: dueDateInput === '' ? null : dueDateInput,
        startDate: startDateInput === '' ? null : startDateInput,
        description: description.trim(),
      },
    });
    setTitle('');
    setPriority('medium');
    setEstimate('');
    setLabels('');
    setDescription('');
    setMilestone(null);
    setDueDateInput('');
    setStartDateInput('');
    onClose();
  }

  return (
    <Modal
      open={open}
      title={t('board.newTaskModal.title')}
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('board.newTaskModal.cancel')}
          </Button>
          <Button type="submit" form="new-task-form" disabled={!title.trim()}>
            {t('board.newTaskModal.submit')}
          </Button>
        </>
      }
    >
      <form id="new-task-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label={t('board.newTaskModal.titleLabel')}
          required
          autoFocus
          placeholder={t('board.newTaskModal.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="field">
          <label className="field-label" htmlFor="new-task-priority">
            {t('board.newTaskModal.priorityLabel')}
          </label>
          <select
            id="new-task-priority"
            className="select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            {TASK_PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY[p].label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label={t('board.newTaskModal.estimateLabel')}
          type="number"
          min={0}
          placeholder={t('board.newTaskModal.optionalPlaceholder')}
          value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
        />
        <Input
          label={t('board.newTaskModal.dueDateLabel')}
          type="date"
          value={dueDateInput}
          onChange={(e) => setDueDateInput(e.target.value)}
        />
        <Input
          label={t('board.newTaskModal.startDateLabel')}
          type="date"
          value={startDateInput}
          onChange={(e) => setStartDateInput(e.target.value)}
        />
        {startAfterDue(startDateInput, dueDateInput) && (
          <InlineError>{t('board.newTaskModal.dateWarn')}</InlineError>
        )}
        <Input
          label={t('board.newTaskModal.labelsLabel')}
          placeholder={t('board.newTaskModal.labelsPlaceholder')}
          value={labels}
          onChange={(e) => setLabels(e.target.value)}
        />
        {state && state.milestones.length > 0 && (
          <SearchableSelect
            id="new-task-milestone"
            label={t('board.newTaskModal.milestoneLabel')}
            value={milestone}
            options={state.milestones.map((m) => ({ value: m.id, label: m.name }))}
            onChange={setMilestone}
          />
        )}
        <Textarea
          label={t('board.newTaskModal.descriptionLabel')}
          rows={3}
          placeholder={t('board.newTaskModal.optionalPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </form>
    </Modal>
  );
}
