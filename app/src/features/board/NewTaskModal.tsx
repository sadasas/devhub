import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarBlank as CalendarIcon, Clock, DotsThree, FileText, Flag, Plus, Tag, User } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { formatDate, isDigitKey, newId, nowIso, parseLabels, sanitizeIntegerInput } from '../../lib/utils';
import { TASK_PRIORITY, TASK_PRIORITY_ORDER } from '../../lib/labels';
import { startAfterDue } from '../../lib/start-dates';
import type { TaskPriority, TaskStatus, TeamMember } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { Avatar } from '../../components/Avatar';
import { SearchableSelect } from '../../components/SearchableSelect';
import { DatePicker } from '../../components/DatePicker';
import { MarkdownField } from '../../components/MarkdownField';
import { FE_LIMITS, LIMITS } from '../../lib/limits';

type PropKey = 'priority' | 'dates' | 'assignee' | 'milestone' | 'estimate' | 'labels';

interface NewTaskModalProps {
  open: boolean;
  status: TaskStatus | null;
  milestoneId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  onClose: () => void;
}

export function NewTaskModal({ open, status, milestoneId, dueDate: _dueDate, startDate: _startDate, onClose }: NewTaskModalProps) {
  const { state, dispatch, teamId } = useProject();
  const { t } = useTranslation(['tracker', 'project']);
  usePresenceStatus(t('board.newTaskModal.presenceCreating'), open);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [estimate, setEstimate] = useState('');
  const [labels, setLabels] = useState('');
  const [description, setDescription] = useState('');
  const [milestone, setMilestone] = useState<string | null>(milestoneId ?? null);
  const [dueDateInput, setDueDateInput] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [datesOpen, setDatesOpen] = useState(false);
  const datesPillRef = useRef<HTMLButtonElement>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [popup, setPopup] = useState<{ key: PropKey; anchor: { top: number; bottom: number; left: number } } | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setExpanded(false);
      setMilestone(milestoneId ?? null);
      // Tanggal selalu mulai kosong (tampil label) — prefill konteks papan dimatikan.
      setDueDateInput('');
      setStartDateInput('');
      setAssignee(null);
    }
  }, [open, milestoneId]);

  useEffect(() => {
    if (open && teamId) {
      api.listMembers(teamId).then(setMembers).catch(() => setMembers([]));
    } else if (!open) {
      setMembers([]);
    }
  }, [open, teamId]);

  // Judul autogrow tanpa batas — yang scroll .composer-scroll, bukan textarea.
  useLayoutEffect(() => {
    const ta = titleRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  });

  useEffect(() => {
    if (!popup) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (popRef.current?.contains(t as Node) || t?.closest?.('[data-pop-anchor]')) return;
      setPopup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopup(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [popup]);

  // Ukur tinggi asli panel setelah render (sebelum paint) lalu tempelkan ke pill.
  const measurePopup = useCallback(() => {
    if (!popup) return;
    const h = popRef.current?.offsetHeight ?? 0;
    const w = 240;
    const below = popup.anchor.bottom + 6;
    const fitsBelow = window.innerHeight - below >= h + 8;
    const next = {
      top: fitsBelow ? below : Math.max(8, popup.anchor.top - h - 6),
      left: Math.max(8, Math.min(popup.anchor.left, window.innerWidth - w - 8)),
    };
    setPopupPos((prev) => (prev && prev.top === next.top && prev.left === next.left ? prev : next));
  }, [popup]);

  useLayoutEffect(() => {
    measurePopup();
  }, [measurePopup]);

  useEffect(() => {
    if (!popup) return;
    window.addEventListener('resize', measurePopup);
    return () => window.removeEventListener('resize', measurePopup);
  }, [popup, measurePopup]);

  // Fokus ke panel untuk popup non-teks; input teks sudah autoFocus sendiri.
  useEffect(() => {
    if (popup && popup.key !== 'estimate' && popup.key !== 'labels') {
      popRef.current?.focus({ preventScroll: true });
    }
  }, [popup]);

  // Fullscreen toggle via tombol header maupun Ctrl/Cmd+Shift+F.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setExpanded((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function openPopup(key: PropKey, anchor: HTMLElement) {
    const r = anchor.getBoundingClientRect();
    setPopup({ key, anchor: { top: r.top, bottom: r.bottom, left: r.left } });
  }

  const assigneeMember = members.find((m) => m.id === assignee) ?? null;

  const priorityBg =
    priority === '' || TASK_PRIORITY[priority].tone === 'neutral'
      ? undefined
      : `var(--status-${TASK_PRIORITY[priority].tone}-dim)`;

  const statusDot =
    status === 'done'
      ? 'var(--status-success)'
      : status === 'review'
        ? 'var(--status-warn)'
        : status === 'inProgress'
          ? 'var(--status-info)'
          : 'var(--text-muted)';

  const propLabels: Record<string, string> = {
    status: t('board.taskModal.statusLabel'),
    priority: t('board.newTaskModal.priorityLabel'),
    startDate: t('board.taskModal.startDateLabel'),
    dueDate: t('board.taskModal.dueDateLabel'),
    assignee: t('board.taskModal.assigneeLabel'),
    milestone: t('board.newTaskModal.milestoneLabel'),
    estimate: t('board.newTaskModal.estimateLabel'),
    labels: t('board.newTaskModal.labelsLabel'),
  };

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
        priority: priority === '' ? 'medium' : priority,
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
    setPriority('');
    setEstimate('');
    setLabels('');
    setDescription('');
    setMilestone(null);
    setDueDateInput('');
    setStartDateInput('');
    setAssignee(null);
    onClose();
  }

  const priorityControl = (
    <select
      id="new-task-priority"
      className="select"
      aria-label={t('board.newTaskModal.priorityLabel')}
      value={priority}
      onChange={(e) => setPriority(e.target.value as TaskPriority)}
    >
      <option value="">{t('board.newTaskModal.priorityLabel')}</option>
      {TASK_PRIORITY_ORDER.map((p) => (
        <option key={p} value={p}>
          {TASK_PRIORITY[p].label}
        </option>
      ))}
    </select>
  );

  const datesPillText =
    startDateInput && dueDateInput
      ? `${formatDate(startDateInput)} – ${formatDate(dueDateInput)}`
      : startDateInput || dueDateInput
        ? formatDate(startDateInput || dueDateInput)
        : t('board.taskModal.dateLabel');

  const assigneeControl = (
    <SearchableSelect
      id="new-task-assignee"
      label=""
      ariaLabel={t('board.taskModal.assigneeLabel')}
      value={assignee}
      options={members.map((m) => ({ value: m.id, label: m.displayName || m.email }))}
      onChange={setAssignee}
      placeholder={t('board.newTaskModal.optionalPlaceholder')}
      triggerEmptyLabel={t('board.taskModal.assigneeLabel')}
    />
  );

  const milestoneControl =
    state && state.milestones.length > 0 ? (
      <SearchableSelect
        id="new-task-milestone"
        label=""
        ariaLabel={t('board.newTaskModal.milestoneLabel')}
        value={milestone}
        options={state.milestones.map((m) => ({ value: m.id, label: m.name }))}
        onChange={setMilestone}
        triggerEmptyLabel={t('board.newTaskModal.milestoneLabel')}
      />
    ) : null;

  const estimateControl = (
    <input
      className="input"
      type="number"
      min={0}
      max={FE_LIMITS.ESTIMATE_MAX}
      placeholder={t('board.newTaskModal.estimateLabel')}
      value={estimate}
      onChange={(e) => setEstimate(sanitizeIntegerInput(e.target.value))}
      inputMode="numeric"
      aria-label={t('board.newTaskModal.estimateLabel')}
      autoFocus
      onKeyDown={(e) => {
        if (e.key === 'Enter') setPopup(null);
        else if (!isDigitKey(e.key)) e.preventDefault();
      }}
    />
  );

  const labelsControl = (
    <input
      className="input"
      placeholder={t('board.newTaskModal.labelsLabel')}
      value={labels}
      maxLength={FE_LIMITS.LABELS_INPUT}
      onChange={(e) => setLabels(e.target.value)}
      aria-label={t('board.newTaskModal.labelsLabel')}
      autoFocus
      onKeyDown={(e) => {
        if (e.key === 'Enter') setPopup(null);
      }}
    />
  );

  const propControls: Record<PropKey, ReactNode> = {
    priority: priorityControl,
    dates: null,
    assignee: assigneeControl,
    milestone: milestoneControl,
    estimate: estimateControl,
    labels: labelsControl,
  };

  return (
    <Modal
      open={open}
      title={t('board.newTaskModal.title')}
      onClose={onClose}
      width="lg"
      className={expanded ? 'modal-composer modal-composer--fullscreen' : 'modal-composer'}
      expandable
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
      expandLabel={t('board.newTaskModal.expandView')}
      collapseLabel={t('board.newTaskModal.contractView')}
      footer={
        <Button type="submit" form="new-task-form" leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />} disabled={!title.trim() || !!startAfterDue(startDateInput, dueDateInput)}>
          {t('board.newTaskModal.submit')}
        </Button>
      }
    >
      <form id="new-task-form" className="composer-form" onSubmit={onSubmit} noValidate>
        <div
          className="composer-scroll"
          ref={scrollRef}
          onScroll={(e) => {
            barRef.current?.classList.toggle('is-stuck', (e.target as HTMLDivElement).scrollTop > 4);
          }}
        >
          <textarea
            ref={titleRef}
            className="composer-title"
            rows={1}
            required
            autoFocus
            placeholder={t('board.newTaskModal.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.TASK_TITLE}
            aria-label={t('board.newTaskModal.titleLabel')}
          />
          <MarkdownField
            label={t('board.newTaskModal.descriptionLabel')}
            icon={FileText}
            value={description}
            onChange={setDescription}
            placeholder={t('board.newTaskModal.optionalPlaceholder')}
            maxLength={10000}
            rows={4}
            variant="bare"
            previewToggle
          />
        </div>
        <div className="composer-propbar" ref={barRef}>
          <span
            className="prop prop-static"
            data-prop="status"
            data-label={propLabels.status}
            style={{
              background:
                status === 'done'
                  ? 'var(--status-success-dim)'
                  : status === 'review'
                    ? 'var(--status-warn-dim)'
                    : status === 'inProgress'
                      ? 'var(--status-info-dim)'
                      : 'var(--bg-inset)',
              border: 'none',
            }}
          >
            <span className="dot" style={{ background: statusDot }} aria-hidden="true" />
            {status ? t(`board.column.${status}`) : t('board.column.todo')}
          </span>

          <span
            className="prop"
            data-prop="priority"
            data-label={propLabels.priority}
            style={priorityBg ? { background: priorityBg, border: 'none' } : undefined}
          >
            <span className="prop-ic" aria-hidden="true"><DotsThree size={14} /></span>
            <span className="sr-only">{propLabels.priority}</span>
            {popup?.key !== 'priority' && priorityControl}
          </span>

          <button
            type="button"
            className="prop"
            data-prop="dates"
            data-label={propLabels.startDate}
            data-pop-anchor="dates"
            ref={datesPillRef}
            onClick={() => { setPopup(null); setDatesOpen((v) => !v); }}
          >
            <span className="prop-ic" aria-hidden="true"><CalendarIcon size={14} /></span>
            <span className="prop-text">{datesPillText}</span>
          </button>
          {datesOpen && (
            <DatePicker
              id="new-task-dates"
              mode="range"
              start={startDateInput ? startDateInput.slice(0, 10) : null}
              end={dueDateInput ? dueDateInput.slice(0, 10) : null}
              anchorEl={datesPillRef.current}
              onApply={(s, e) => { setStartDateInput(s ?? ''); setDueDateInput(e ?? ''); setDatesOpen(false); }}
              onClose={() => setDatesOpen(false)}
            />
          )}

          <span className="prop" data-prop="assignee" data-label={propLabels.assignee}>
            {assigneeMember ? (
              <Avatar
                src={assigneeMember.avatarUrl ?? null}
                name={assigneeMember.displayName || assigneeMember.email}
                email={assigneeMember.email}
                id={assigneeMember.id}
                size={18}
                alt=""
              />
            ) : (
              <span className="prop-ic" aria-hidden="true"><User size={14} /></span>
            )}
            <span className="sr-only">{propLabels.assignee}</span>
            {popup?.key !== 'assignee' && assigneeControl}
          </span>

          {state && state.milestones.length > 0 && (
          <span className="prop" data-prop="milestone" data-label={propLabels.milestone}>
            <span className="prop-ic" aria-hidden="true"><Flag size={14} /></span>
            <span className="sr-only">{propLabels.milestone}</span>
            {popup?.key !== 'milestone' && milestoneControl}
            </span>
          )}

          <button
            type="button"
            className="prop"
            data-prop="estimate"
            data-label={propLabels.estimate}
            data-pop-anchor="estimate"
            onClick={(e) => (popup?.key === 'estimate' ? setPopup(null) : openPopup('estimate', e.currentTarget))}
          >
            <span className="prop-ic" aria-hidden="true"><Clock size={14} /></span>
            <span className="prop-text">{estimate === '' ? propLabels.estimate : `${estimate}h`}</span>
          </button>

          <button
            type="button"
            className="prop"
            data-prop="labels"
            data-label={propLabels.labels}
            data-pop-anchor="labels"
            onClick={(e) => (popup?.key === 'labels' ? setPopup(null) : openPopup('labels', e.currentTarget))}
          >
            <span className="prop-ic" aria-hidden="true"><Tag size={14} /></span>
            <span className="prop-text">{labels === '' ? propLabels.labels : labels}</span>
          </button>
        </div>
        {startAfterDue(startDateInput, dueDateInput) && <div className="composer-error"><InlineError>{t('board.newTaskModal.dateWarn')}</InlineError></div>}
      </form>
      {popup && createPortal(
        <div
          ref={popRef}
          className="prop-menu prop-pop"
          role="dialog"
          tabIndex={-1}
          aria-label={propLabels[popup.key]}
          style={popupPos ? { top: popupPos.top, left: popupPos.left } : { visibility: 'hidden' }}
        >
          <div className="prop-pop-label">{propLabels[popup.key]}</div>
          {propControls[popup.key]}
        </div>,
        document.body,
      )}
    </Modal>
  );
}
