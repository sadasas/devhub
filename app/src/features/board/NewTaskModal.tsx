import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, Flag, Clock, CalendarBlank as CalendarIcon, Tag, User } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso, parseLabels } from '../../lib/utils';
import { TASK_PRIORITY, TASK_PRIORITY_ORDER } from '../../lib/labels';
import { startAfterDue } from '../../lib/start-dates';
import type { TaskPriority, TaskStatus, TeamMember } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { MarkdownField } from '../../components/MarkdownField';

interface NewTaskModalProps {
  open: boolean;
  status: TaskStatus | null;
  milestoneId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  onClose: () => void;
}

export function NewTaskModal({ open, status, milestoneId, dueDate, startDate, onClose }: NewTaskModalProps) {
  const { state, dispatch, teamId } = useProject();
  const { t } = useTranslation(['tracker', 'project']);
  usePresenceStatus(t('board.newTaskModal.presenceCreating'), open);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimate, setEstimate] = useState('');
  const [labels, setLabels] = useState('');
  const [description, setDescription] = useState('');
  const [milestone, setMilestone] = useState<string | null>(milestoneId ?? null);
  const [dueDateInput, setDueDateInput] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (open) {
      setTitle('');
      setMilestone(milestoneId ?? null);
      setDueDateInput(dueDate ?? '');
      setStartDateInput(startDate ?? '');
      setAssignee(null);
    }
  }, [open, milestoneId, dueDate, startDate]);

  useEffect(() => {
    if (open && teamId) {
      api.listMembers(teamId).then(setMembers).catch(() => setMembers([]));
    } else if (!open) {
      setMembers([]);
    }
  }, [open, teamId]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (startAfterDue(startDateInput, dueDateInput)) return;
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
        assigneeId: assignee,
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
    setAssignee(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      title={t('board.newTaskModal.title')}
      onClose={onClose}
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('board.newTaskModal.cancel')}
          </Button>
          <Button type="submit" form="new-task-form" disabled={!title.trim() || !!startAfterDue(startDateInput, dueDateInput)}>
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
          maxLength={500}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span
              style={{
                width: 110,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
              }}
            >
              <Flag size={12} aria-hidden="true" /> {t('board.taskModal.statusLabel')}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                borderRadius: 999,
                background:
                  status === 'done'
                    ? 'var(--status-success-dim)'
                    : status === 'review'
                      ? 'var(--status-warn-dim)'
                      : status === 'inProgress'
                        ? 'var(--status-info-dim)'
                        : 'var(--bg-inset)',
                border: 'none',
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              {status ? t(`board.column.${status}`) : t('board.column.todo')}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span
              style={{
                width: 110,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
              }}
            >
              <Flag size={12} aria-hidden="true" /> {t('board.newTaskModal.priorityLabel')}
            </span>
            <select
              id="new-task-priority"
              className="select"
              style={{ width: 160 }}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span
              style={{
                width: 110,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
              }}
            >
              <CalendarIcon size={12} aria-hidden="true" /> {t('board.taskModal.dueDateLabel')} /{' '}
              {t('board.taskModal.startDateLabel')}
            </span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="input"
                type="date"
                style={{ width: 140 }}
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                aria-label={t('board.newTaskModal.startDateLabel')}
              />
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <input
                className="input"
                type="date"
                style={{ width: 140 }}
                value={dueDateInput}
                onChange={(e) => setDueDateInput(e.target.value)}
                aria-label={t('board.newTaskModal.dueDateLabel')}
              />
            </span>
          </div>
          {startAfterDue(startDateInput, dueDateInput) && <InlineError>{t('board.newTaskModal.dateWarn')}</InlineError>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span
              style={{
                width: 110,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
              }}
            >
              <User size={12} aria-hidden="true" /> {t('board.taskModal.assigneeLabel')}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SearchableSelect
                id="new-task-assignee"
                label=""
                value={assignee}
                options={members.map((m) => ({ value: m.id, label: m.displayName || m.email }))}
                onChange={setAssignee}
                placeholder={t('board.newTaskModal.optionalPlaceholder')}
              />
            </div>
          </div>

          {state && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
              <span
                style={{
                  width: 110,
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                }}
              >
                <Flag size={12} aria-hidden="true" /> {t('board.newTaskModal.milestoneLabel')}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SearchableSelect
                  id="new-task-milestone"
                  label=""
                  value={milestone}
                  options={state.milestones.map((m) => ({ value: m.id, label: m.name }))}
                  onChange={setMilestone}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span
              style={{
                width: 110,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
              }}
            >
              <Clock size={12} aria-hidden="true" /> {t('board.newTaskModal.estimateLabel')}
            </span>
            <input
              className="input"
              type="number"
              min={0}
              style={{ width: 100 }}
              placeholder={t('board.newTaskModal.optionalPlaceholder')}
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>h</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span
              style={{
                width: 110,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
              }}
            >
              <Tag size={12} aria-hidden="true" /> {t('board.newTaskModal.labelsLabel')}
            </span>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder={t('board.newTaskModal.labelsPlaceholder')}
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <MarkdownField
              label={t('board.newTaskModal.descriptionLabel')}
              icon={FileText}
              value={description}
              onChange={setDescription}
              placeholder={t('board.newTaskModal.optionalPlaceholder')}
              maxLength={10000}
              rows={4}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
