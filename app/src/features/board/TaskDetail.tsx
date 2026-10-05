import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { Clock, LinkSimple, FileText, CheckCircle, Circle, Flag, CalendarBlank, Tag, User, Rocket, ChartBar, ListChecks, PencilSimple, CaretLeft, Crosshair } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import {
  TASK_PRIORITY,
  TASK_PRIORITY_ORDER,
  TASK_STATUS,
  findLabelDef,
  hashLabelColor,
  labelChipStyleFor,
} from '../../lib/labels';
import { TaskPriorityIcon, TaskStatusIcon } from '../../lib/task-icons';
import { formatDate, formatRelative, isDecimalKey, isTaskCompletable, linkedTestCases, newId, nowIso, openBlockerNames, parseLabels, sanitizeDecimalInput, taskBlockSummary } from '../../lib/utils';
import { api } from '../../lib/api';
import { taskDueChip } from '../../lib/due-dates';
import { startAfterDue, subRangeOutsideParent } from '../../lib/start-dates';
import type { Task, TaskPriority, TaskStatus, TeamMember } from '../../lib/types';
import { LabelPickerBody } from './LabelPickerBody';
import { GCalSyncedMark } from '../integrations/GCalSyncedMark';
import { GitHubTaskSection } from '../integrations/GitHubTaskSection';
import type { UpdatePatch } from '../../state/project-context';
import { useProject, wouldCreateCycle } from '../../state/project-context';
import { useOptionalAuth } from '../../state/auth-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { ActivityList } from '../../components/ActivityList';
import { AttachmentSection } from '../../components/AttachmentSection';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ChecklistSection } from '../../components/ChecklistSection';
import { ComposerTextarea } from '../../components/ComposerTextarea';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { PlanLimitModal } from '../../components/PlanLimitModal';
import { ParentPillSection } from '../../components/ParentPillSection';
import { PropRow } from '../../components/PropRow';
import { DetailShell } from '../../components/DetailShell';
import { DetailFooter } from '../../components/DetailFooter';
import { DatePicker } from '../../components/DatePicker';
import { DetailEmpty } from '../../components/DetailList';
import { InlineError } from '../../components/InlineError';
import { Tooltip } from '../../components/Tooltip';
import { MarkdownField } from '../../components/MarkdownField';
import { SearchableSelect } from '../../components/SearchableSelect';
import { SubtaskCrumb } from '../../components/SubtaskCrumb';
import { SubtaskSection } from '../../components/SubtaskSection';
import { TaskStatusBadge } from '../../components/TaskStatusBadge';
import { FE_LIMITS, LIMITS } from '../../lib/limits';
import { isTypingTarget } from '../../lib/keys';
import { FocusTimer } from './FocusTimer';
import { FocusRadio } from './FocusRadio';
import { FOCUS_MODE_FLAG, track, useFeatureFlag } from '../../lib/analytics';

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'inProgress', 'review', 'done'];

// autoFocus hanya desktop (hover) — di touch, keyboard virtual melonjak (pola Modal).
const AUTO_FOCUS_INPUT = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

interface TaskDetailProps {
  taskId: string | null;
  variant: 'modal' | 'page';
  onClose: () => void;
  /** Navigasi antar task di dalam modal (klik subtask / breadcrumb parent). */
  onNavigate?: (taskId: string) => void;
  onEnterFocus?: (id: string) => void;
}

export function TaskDetail({ taskId, variant, onClose, onNavigate, onEnterFocus }: TaskDetailProps) {
  const { t } = useTranslation(['tracker','project']);
  const { state, dispatch, canEdit, projectId, teamId, saving, lastSavedAt } = useProject();
  const { user } = useOptionalAuth();
  const focusEnabled = useFeatureFlag(FOCUS_MODE_FLAG, true);
  const [hotProp, setHotProp] = useState<string | null>(null);
  /** Kartu Properti Focus page: buka/tutup di mobile (default buka, tanpa persist). */
  const [propsOpen, setPropsOpen] = useState(true);
  /** Topbar sticky Focus page: bg + hairline muncul setelah scroll > 8px (page saja). */
  const [scrolled, setScrolled] = useState(false);
  /** Popup labels: draft mentah (koma bebas diketik) + posisi panel. */
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelsDraft, setLabelsDraft] = useState('');
  const [labelsPos, setLabelsPos] = useState<{ top: number; left: number } | null>(null);
  const labelsRowRef = useRef<HTMLDivElement>(null);
  const labelsPopRef = useRef<HTMLDivElement>(null);
  const labelsCancelRef = useRef(false);
  /** Popup estimate: panel terposisi, nilai live dari task. */
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimatePos, setEstimatePos] = useState<{ top: number; left: number } | null>(null);
  const estimateRowRef = useRef<HTMLDivElement>(null);
  const estimatePopRef = useRef<HTMLDivElement>(null);

  const openLabels = () => {
    if (!task) return;
    setLabelsDraft(task.labels.join(', '));
    labelsCancelRef.current = false;
    setLabelsPos(null);
    setLabelsOpen(true);
  };
  const commitLabels = () => {
    if (!labelsCancelRef.current && task) {
      const labels = parseLabels(labelsDraft);
      ensureLabelDefs(labels);
      update({ labels });
    }
    labelsCancelRef.current = false;
    setLabelsOpen(false);
  };
  /** Buat-cepat definisi untuk nama label baru (warna hash, tanpa deskripsi).
      Duplikat case-insensitive dilewati; kunci = nama. */
  const ensureLabelDefs = (names: string[]) => {
    const existing = state?.labelDefs ?? [];
    const seen = new Set(existing.map((d) => d.name.trim().toLowerCase()));
    const ts = nowIso();
    for (const raw of names) {
      const name = raw.trim().slice(0, 50);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      dispatch({
        type: 'labelDef/add',
        labelDef: {
          id: newId(),
          createdAt: ts,
          updatedAt: ts,
          name,
          color: hashLabelColor(key),
          description: '',
        },
      });
    }
  };
  const measurePop = (
    anchor: HTMLElement | null,
    panel: HTMLElement | null,
    setPos: Dispatch<SetStateAction<{ top: number; left: number } | null>>,
  ) => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const h = panel?.offsetHeight ?? 140;
    const w = 260;
    const below = r.bottom + 6;
    const top = window.innerHeight - below >= h + 8 ? below : Math.max(8, r.top - h - 6);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    setPos((p) => (p && p.top === top && p.left === left ? p : { top, left }));
  };

  useLayoutEffect(() => {
    if (!labelsOpen) return;
    const compute = () => measurePop(labelsRowRef.current, labelsPopRef.current, setLabelsPos);
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [labelsOpen]);

  useEffect(() => {
    if (!labelsOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!labelsPopRef.current?.contains(e.target as Node)) commitLabels();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { labelsCancelRef.current = true; setLabelsOpen(false); }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [labelsOpen, labelsDraft]);

  useLayoutEffect(() => {
    if (!estimateOpen) return;
    const compute = () => measurePop(estimateRowRef.current, estimatePopRef.current, setEstimatePos);
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [estimateOpen]);

  useEffect(() => {
    if (!estimateOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!estimatePopRef.current?.contains(e.target as Node)) setEstimateOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEstimateOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [estimateOpen]);
  /** Shift+F: modal → masuk focus page; page → keluar (onClose). Kill-switch OFF blocks entry. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (focusEnabled === false) return;
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== 'F' && e.key !== 'f') return;
      if (isTypingTarget(e.target)) return;
      if (variant === 'modal') {
        if (!onEnterFocus || !taskId) return;
        e.preventDefault();
        onEnterFocus(taskId);
      } else {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [variant, taskId, onEnterFocus, onClose, focusEnabled]);
  /** Escape di page → keluar (di modal biarkan Modal yang handle). */
  useEffect(() => {
    if (variant !== 'page') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [variant, onClose]);
  /** Focus page scroll dengan dokumen — bg topbar muncul setelah scroll > 8px (page saja). */
  useEffect(() => {
    if (variant !== 'page') return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant]);
  const [pickingBlocker, setPickingBlocker] = useState(false);
  /** Chip blocked-by; tombol × hanya saat baris hot (mode edit). */
  const blockerChip = (bt: { id: string; title: string }, removable: boolean) => (
    <span key={bt.id} style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <LinkSimple size={10} aria-hidden="true" /> {bt.title} {removable ? (
        <button type="button" onClick={() => toggleBlocker(bt.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 'inherit', padding: '0 2px', lineHeight: 1, minWidth: 24, minHeight: 24 }} aria-label={t('board.taskModal.removeBlocker', { title: bt.title, defaultValue: `Remove blocker ${bt.title}` })}>×</button>
      ) : (
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 'inherit', padding: '0 2px', lineHeight: 1, visibility: 'hidden' }}>×</span>
      )}
    </span>
  );
  const [cycleWarn, setCycleWarn] = useState<string | null>(null);
  const [doneWarn, setDoneWarn] = useState<string | null>(null);
  /** Pemicu terakhir doneWarn ('status' = dropdown Status, 'suggest' = tombol Mark done) — error tampil di dekat situ, satu lokasi. */
  const [doneWarnSource, setDoneWarnSource] = useState<'status' | 'suggest' | null>(null);
  const [rangeWarn, setRangeWarn] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [storageLimitOpen, setStorageLimitOpen] = useState(false);
  const [subAdding, setSubAdding] = useState(false);
  const [checkAdding, setCheckAdding] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
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
    setHotProp(null);
    setPickingBlocker(false);
    setCycleWarn(null);
    setDoneWarn(null);
    setDoneWarnSource(null);
    setRangeWarn(null);
    setConfirmOpen(false);
    setStorageLimitOpen(false);
    setEstimateOpen(false);
    setLabelsOpen(false);
    setSubAdding(false);
    setCheckAdding(false);
  }, [taskId]);

  // Judul autogrow kini di dalam ComposerTextarea.

  const task = state?.tasks.find((t) => t.id === taskId);
  usePresenceStatus(t('board.taskModal.presenceEditing'), task != null);
  if (!task) return null;

  const update = (patch: UpdatePatch<Task>) =>
    dispatch({ type: 'task/update', id: task.id, patch });

  const changeStatus = (next: TaskStatus, source: 'status' | 'suggest' = 'status') => {
    if (next === 'done' && !isTaskCompletable(task, state!.testCases, state!.tasks)) {
      const pending = state!.testCases.filter(
        (tc) => tc.taskId === task.id && tc.status !== 'pass',
      );
      const blockers = openBlockerNames(task, state!.tasks);
      if (blockers.length > 0) {
        setDoneWarn(
          t('board.taskModal.blockedByNames', {
            defaultValue: 'Blocked by {{names}} — finish them first.',
            names: blockers.slice(0, 3).join(', '),
          }),
        );
      } else {
        const summary = taskBlockSummary(task, state!.testCases, state!.tasks);
        setDoneWarn(
          summary.length > 0
            ? t('board.taskModal.blockedSummary', {
              defaultValue: 'Cannot mark done: {{reasons}} not finished yet.',
              reasons: summary.join(', '),
            })
            : t('board.taskModal.cannotMarkDone', { count: pending.length }),
        );
      }
      setDoneWarnSource(source);
      return;
    }
    setDoneWarn(null);
    setDoneWarnSource(null);
    update({ status: next });
  };

  /** Badges mobile → buka kartu Properti lalu scroll ke anchor aside. */
  const scrollToProps = () => {
    setPropsOpen(true);
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('focus-properties')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };
  const focusDueChip = taskDueChip(task);

  const otherTasks = state!.tasks.filter((t) => t.id !== task.id);
  const labelDefs = state?.labelDefs;
  const renderLabelChip = (l: string, i: number) => {
    const style = labelChipStyleFor(l, labelDefs);
    const title = findLabelDef(l, labelDefs)?.description || l;
    return (
      <Tooltip key={`${l}-${i}`} title={title}>
        <span style={{ padding: '2px 8px', borderRadius: 6, background: style.background, fontSize: 12, color: style.color }}>{l}</span>
      </Tooltip>
    );
  };
  const dateWarn = startAfterDue(task.startDate, task.dueDate)
    ? t('board.taskModal.dateWarn')
    : null;
  /** Nilai assignee (avatar + nama) — dipakai view idle & trigger hot. */
  const renderAssigneeValue = () => {
    if (!task.assigneeId) {
      return <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>;
    }
    const am = members.find((m) => m.id === task.assigneeId);
    const an = am?.displayName || am?.email || '?';
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Avatar src={am?.avatarUrl ?? null} name={an} email={am?.email} id={task.assigneeId!} size={24} style={{ border: '2px solid var(--bg-overlay)' }} />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{an}</span>
      </span>
    );
  };
  const testCases = linkedTestCases(task.id, state!.testCases);
  const blockedTasks = [...new Set(task.blockedBy)]
    .map((id) => state!.tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);
  const milestone = task.milestoneId
    ? state!.milestones.find((m) => m.id === task.milestoneId)
    : undefined;
  const titleEmpty = task.title.trim() === '';
  const parentTask = task.parentTaskId ? state!.tasks.find((tt) => tt.id === task.parentTaskId) : undefined;
  /** Subtask yang keluar rentang task ini (hanya relevan bila task ini parent). */
  const orphanedSubtasks = !task.parentTaskId
    ? state!.tasks
      .filter((tt) => tt.parentTaskId === task.id)
      .filter((ss) => subRangeOutsideParent(ss, task) !== null)
    : [];
  const clampSubtasks = () => {
    for (const ss of orphanedSubtasks) {
      const patch: { startDate?: string | null; dueDate?: string | null } = {};
      if (task.startDate && ss.startDate && ss.startDate < task.startDate) patch.startDate = task.startDate;
      if (task.dueDate && ss.dueDate && ss.dueDate > task.dueDate) patch.dueDate = task.dueDate;
      if (Object.keys(patch).length > 0) {
        dispatch({ type: 'task/update', id: ss.id, patch });
      }
    }
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
    <DetailShell
      title={t('board.taskModal.viewTitle')}
      headerTitle={undefined}
      onClose={onClose}
      variant={variant}
      topbar={
        variant === 'page' ? (
          <div className={`focus-topbar${scrolled ? ' focus-topbar--scrolled' : ''}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, padding: '8px 0', marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              aria-label={t('board.focus.back')}
              style={{ paddingLeft: 0, justifySelf: 'start' }}
            >
              <CaretLeft size={14} aria-hidden="true" />
              <span className="focus-topbar-label">{t('board.focus.back')}</span>
            </button>
            <div className="focus-combined" style={{ display: 'inline-flex', alignItems: 'center', gap: 0, justifySelf: 'center', minWidth: 0 }}>
              <FocusTimer />
              <FocusRadio />
            </div>
            {task.status !== 'done' ? (
              <Button variant="primary" size="sm" className="focus-topbar-done" leftIcon={<CheckCircle size={14} aria-hidden="true" />} onClick={() => { track('focus_mark_done', { source: 'topbar' }); changeStatus('done'); }} style={{ justifySelf: 'end' }}>
                <span className="focus-topbar-label">{t('board.taskModal.focusMarkDone')}</span>
              </Button>
            ) : (
              <span style={{ justifySelf: 'end' }}>
                <Badge tone="success">{TASK_STATUS.done.label}</Badge>
              </span>
            )}
          </div>
        ) : undefined
      }
      headerAction={
        variant === 'modal' && onEnterFocus && focusEnabled !== false ? (
          <Tooltip title={`${t('board.taskModal.focusEnter')} (Shift+F)`}>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => onEnterFocus(task.id)}
            aria-label={t('board.taskModal.focusEnter')}
          >
            <Crosshair size={14} aria-hidden="true" />
          </button>
          </Tooltip>
        ) : undefined
      }
      footer={
        variant === 'page' ? (
          task.status !== 'done' && canEdit ? (
            <div className="focus-bottombar">
              <Button
                variant="primary"
                size="md"
                leftIcon={<CheckCircle size={14} aria-hidden="true" />}
                onClick={() => { track('focus_mark_done', { source: 'bottombar' }); changeStatus('done', 'suggest'); }}
                style={{ width: '100%', background: 'var(--accent-focus)', color: 'var(--text-on-accent)' }}
              >
                {t('board.taskModal.focusMarkDone')}
              </Button>
            </div>
          ) : undefined
        ) : canEdit ? (
          <DetailFooter onDelete={() => setConfirmOpen(true)} deleteLabel={t('board.taskModal.delete')}>
            {(saving || lastSavedAt) && !titleEmpty && (
              <span className="save-state" role="status">
                {saving ? (
                  t('board.taskModal.autosaveSaving')
                ) : (
                  <>
                    <CheckCircle size={13} weight="bold" aria-hidden="true" />
                    {t('board.taskModal.autosaveSaved')}
                  </>
                )}
              </span>
            )}
          </DetailFooter>
        ) : undefined
      }
      sidebarHead={(
        <>
          <span>{t('board.taskModal.propertiesLabel')}</span>
          <button
            type="button"
            className="focus-props-toggle"
            onClick={() => setPropsOpen((v) => !v)}
            aria-expanded={propsOpen}
            aria-controls="focus-properties"
          >
            {propsOpen ? t('board.focus.propsHide') : t('board.focus.propsShow')}{' '}
            <span aria-hidden="true">{propsOpen ? '^' : 'v'}</span>
          </button>
        </>
      )}
      sideId={variant === 'page' ? 'focus-properties' : undefined}
      sidebar={(<>
      {propsOpen && (<>
              <PropRow
                propKey="status"
                label={t('board.taskModal.statusLabel')}
                icon={<Circle size={12} aria-hidden="true" />}
                hot={hotProp === 'status'}
                setHot={setHotProp}
                canEdit={canEdit}
                view={(
                  <TaskStatusBadge status={task.status} />
                )}
                control={(
                  <SearchableSelect defaultOpen searchable={false} id="task-status" label="" ariaLabel={t('board.taskModal.statusLabel')} value={task.status} allowEmpty={false} triggerContent={<TaskStatusBadge status={task.status} />} options={STATUS_OPTIONS.map((s) => ({ value: s, label: TASK_STATUS[s].label, icon: <TaskStatusIcon status={s} size={13} /> }))} onOpenChange={(o) => { if (!o) setHotProp(null); }} onChange={(v) => { if (v) { changeStatus(v as TaskStatus, 'status'); setHotProp(null); } }} />
                )}
              />
              {doneWarn && doneWarnSource === 'status' && <InlineError>{doneWarn}</InlineError>}
              {/* Priority */}
              <PropRow
                propKey="priority"
                label={t('board.newTaskModal.priorityLabel')}
                icon={<Flag size={12} aria-hidden="true" />}
                hot={hotProp === 'priority'}
                setHot={setHotProp}
                canEdit={canEdit}
                view={(
                  <Badge tone={TASK_PRIORITY[task.priority].tone}>
                    <TaskPriorityIcon priority={task.priority} size={11} />
                    {TASK_PRIORITY[task.priority].label}
                  </Badge>
                )}
                control={(
                  <SearchableSelect defaultOpen searchable={false} id="task-priority" label="" ariaLabel={t('board.newTaskModal.priorityLabel')} value={task.priority} allowEmpty={false} triggerContent={(<Badge tone={TASK_PRIORITY[task.priority].tone}><TaskPriorityIcon priority={task.priority} size={11} />{TASK_PRIORITY[task.priority].label}</Badge>)} options={TASK_PRIORITY_ORDER.map((p) => ({ value: p, label: TASK_PRIORITY[p].label, icon: <TaskPriorityIcon priority={p} size={13} /> }))} onOpenChange={(o) => { if (!o) setHotProp(null); }} onChange={(v) => { if (v) { update({ priority: v as TaskPriority }); setHotProp(null); } }} />
                )}
              />

              {/* Dates */}
              <PropRow
                propKey="dates"
                label={t('board.taskModal.dateLabel')}
                icon={<CalendarBlank size={12} aria-hidden="true" />}
                hot={hotProp === 'dates'}
                setHot={setHotProp}
                canEdit={canEdit}
                view={!(task.startDate || task.dueDate) ? (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', maxWidth: '100%' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span>
                        {task.startDate ? formatDate(task.startDate) : t('board.taskModal.startDateLabel')}
                        {' - '}
                        {task.dueDate ? formatDate(task.dueDate) : t('board.taskModal.dueDateLabel')}
                      </span>
                      <GCalSyncedMark taskId={task.id} projectId={projectId} />
                    </span>
                    {task.dueDate && taskDueChip(task).tone === 'danger' && (
                      <span style={{ display: 'block', marginTop: 4 }}>
                        <span className={`task-due task-due-${taskDueChip(task).tone}`} title={taskDueChip(task).title}>{taskDueChip(task).label}</span>
                      </span>
                    )}
                    {task.status === 'done' && task.completedAt && (
                      <span style={{ display: 'block', color: 'var(--text-muted)', marginTop: 4 }}>· {t('board.taskModal.doneDateLabel')}: {formatDate(task.completedAt)}</span>
                    )}
                  </span>
                )}
                control={(
                  <DatePicker
                    id="task-dates"
                    mode="range"
                    start={task.startDate?.slice(0, 10) ?? null}
                    end={task.dueDate?.slice(0, 10) ?? null}
                    minDate={parentTask?.startDate?.slice(0, 10) ?? null}
                    maxDate={parentTask?.dueDate?.slice(0, 10) ?? null}
                    onApply={(s, e) => {
                      if (parentTask && subRangeOutsideParent({ startDate: s, dueDate: e }, parentTask)) {
                        setRangeWarn(t('board.taskModal.subRangeWarn', {
                          defaultValue: 'Date is outside the parent range ({{start}} – {{due}}).',
                          start: parentTask.startDate ? formatDate(parentTask.startDate) : '…',
                          due: parentTask.dueDate ? formatDate(parentTask.dueDate) : '…',
                        }));
                        return;
                      }
                      setRangeWarn(null);
                      update({ startDate: s, dueDate: e });
                      setHotProp(null);
                    }}
                    onClose={() => { setRangeWarn(null); setHotProp(null); }}
                  />
                )}
              />



              {dateWarn && <InlineError>{dateWarn}</InlineError>}
              {rangeWarn && <InlineError>{rangeWarn}</InlineError>}
              {orphanedSubtasks.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <InlineError>
                    {t('board.taskModal.parentShrinkWarn', {
                      defaultValue: '{{count}} subtasks are outside the new range.',
                      count: orphanedSubtasks.length,
                    })}
                  </InlineError>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={clampSubtasks}
                  >
                      {t('board.taskModal.clampSubtasks', {
                        defaultValue: 'Adjust {{count}} subtasks',
                        count: orphanedSubtasks.length,
                      })}
                  </button>
                </div>
              )}

              {/* Tags */}
              <div
                className="prop"
                data-prop="labels"
                data-hot={labelsOpen || undefined}
                ref={labelsRowRef}
              >
                {canEdit ? (
                  <button
                    type="button"
                    className="prop-label prop-label-btn"
                    onClick={() => (labelsOpen ? commitLabels() : openLabels())}
                    aria-label={`${t('board.taskModal.labelsLabel')} — edit`}
                  >
                    <Tag size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.labelsLabel')}</span>{!labelsOpen && <PencilSimple size={12} aria-hidden="true" className="prop-edit" />}
                  </button>
                ) : (
                  <span className="prop-label"><Tag size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.labelsLabel')}</span></span>
                )}
                {canEdit ? (
                  <button
                    type="button"
                    className="prop-view"
                    onClick={() => (labelsOpen ? commitLabels() : openLabels())}
                  >
                    {task.labels.length > 0 ? (
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {task.labels.map((l, i) => renderLabelChip(l, i))}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                    )}
                  </button>
                ) : task.labels.length > 0 ? (
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {task.labels.map((l, i) => renderLabelChip(l, i))}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                )}
              </div>
              {labelsOpen && createPortal(
                <div
                  ref={labelsPopRef}
                  className="prop-menu prop-pop"
                  role="dialog"
                  aria-label={t('board.taskModal.labelsLabel')}
                  style={labelsPos ? { top: labelsPos.top, left: labelsPos.left } : { visibility: 'hidden' }}
                >
                  <div className="prop-pop-label">{t('board.taskModal.labelsLabel')}</div>
                  <LabelPickerBody draft={labelsDraft} onChange={setLabelsDraft} />
                </div>,
                document.body,
              )}

              {/* Assignees */}
              <PropRow
                propKey="assignee"
                label={t('board.taskModal.assigneeLabel')}
                icon={<User size={12} aria-hidden="true" />}
                hot={hotProp === 'assignee'}
                setHot={setHotProp}
                canEdit={canEdit}
                view={renderAssigneeValue()}
                control={(
                  <SearchableSelect defaultOpen id="task-assignee-inline" label="" ariaLabel={t('board.taskModal.assigneeLabel')} value={task.assigneeId ?? null} triggerContent={renderAssigneeValue()} options={[
                    ...(user?.id && task.assigneeId !== user.id
                      ? (() => {
                        const me = members.find((m) => m.id === user.id);
                        const n = me?.displayName || me?.email || t('board.taskModal.assignToMe', { defaultValue: 'Assign to me' });
                        return [{ value: user.id, label: t('board.taskModal.assignToMe', { defaultValue: 'Assign to me' }), icon: <Avatar src={me?.avatarUrl ?? null} name={n} email={me?.email} id={user.id} size={20} alt="" /> }];
                      })()
                      : []),
                    ...members.filter((m) => !(user?.id && task.assigneeId !== user.id && m.id === user.id)).map((m) => { const n = m.displayName || m.email; return { value: m.id, label: n, icon: <Avatar src={m.avatarUrl ?? null} name={n} email={m.email} id={m.id} size={20} alt="" /> }; }),
                   ]} onOpenChange={(o) => { if (!o) setHotProp(null); }} onChange={(v) => { update({ assigneeId: v }); setHotProp(null); }} triggerEmptyLabel={t('board.taskModal.assigneeLabel')} />
                )}
              />

              {/* Milestone */}
              <PropRow
                propKey="milestone"
                label={t('board.taskModal.milestoneLabel')}
                icon={<Rocket size={12} aria-hidden="true" />}
                hot={hotProp === 'milestone'}
                setHot={setHotProp}
                canEdit={canEdit}
                view={(
                  <span style={{ fontSize: 13, color: milestone ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {milestone ? milestone.name : '—'}
                  </span>
                )}
                control={(
                  <SearchableSelect defaultOpen id="task-milestone" label="" ariaLabel={t('board.taskModal.milestoneLabel')} value={task.milestoneId} options={state!.milestones.map((m) => ({ value: m.id, label: m.name }))} onOpenChange={(o) => { if (!o) setHotProp(null); }} onChange={(v) => { update({ milestoneId: v }); setHotProp(null); }} triggerEmptyLabel={t('board.taskModal.milestoneLabel')} />
                )}
              />

              {/* Estimate */}
              <div
                className="prop"
                data-prop="estimate"
                data-hot={estimateOpen || undefined}
                ref={estimateRowRef}
              >
                {canEdit ? (
                  <button
                    type="button"
                    className="prop-label prop-label-btn"
                    onClick={() => { setEstimatePos(null); setEstimateOpen((v) => !v); }}
                    aria-label={`${t('board.taskModal.estimateLabel')} — edit`}
                  >
                    <Clock size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.estimateLabel')}</span>{!estimateOpen && <PencilSimple size={12} aria-hidden="true" className="prop-edit" />}
                  </button>
                ) : (
                  <span className="prop-label"><Clock size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.estimateLabel')}</span></span>
                )}
                {canEdit ? (
                  <button
                    type="button"
                    className="prop-view"
                    onClick={() => { setEstimatePos(null); setEstimateOpen((v) => !v); }}
                  >
                    {task.estimate != null ? (
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{task.estimate}h</span>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </button>
                ) : task.estimate != null ? (
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{task.estimate}h</span>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
              {estimateOpen && createPortal(
                <div
                  ref={estimatePopRef}
                  className="prop-menu prop-pop"
                  role="dialog"
                  aria-label={t('board.taskModal.estimateLabel')}
                  style={estimatePos ? { top: estimatePos.top, left: estimatePos.left } : { visibility: 'hidden' }}
                >
                  <div className="prop-pop-label">{t('board.taskModal.estimateLabel')}</div>
                  <input
                    autoFocus={AUTO_FOCUS_INPUT}
                    className="input"
                    type="number"
                    min={0}
                    max={FE_LIMITS.ESTIMATE_MAX}
                    step="any"
                    value={task.estimate ?? ''}
                    aria-label={t('board.taskModal.estimateLabel')}
                    placeholder={t('board.taskModal.estimateLabel')}
                    inputMode="decimal"
                    onChange={(e) => { const v = sanitizeDecimalInput(e.target.value); if (v === '' || v === '.') { update({ estimate: undefined }); return; } const n = Number(v); if (Number.isNaN(n)) return; update({ estimate: Math.min(FE_LIMITS.ESTIMATE_MAX, Math.max(0, n)) }); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setEstimateOpen(false);
                      else if (!isDecimalKey(e.key)) e.preventDefault();
                    }}
                  />
                </div>,
                document.body,
              )}
              <div
                className="prop"
                data-prop="actual"
                title={t('board.taskModal.actualHint')}
              >
                {canEdit ? (
                  <span className="prop-label"><ChartBar size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.actualLabel')}</span></span>
                ) : (
                  <span className="prop-label"><ChartBar size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.actualLabel')}</span></span>
                )}
                {canEdit ? (
                  task.actualHours != null ? (
                    <span className="prop-view-text">{task.actualHours}h</span>
                  ) : (
                    <span className="prop-view-empty">—</span>
                  )
                ) : task.actualHours != null ? (
                  <span className="prop-view-text">{task.actualHours}h</span>
                ) : (
                  <span className="prop-view-empty">—</span>
                )}
              </div>
              <div
                data-blocked-row
                data-prop="blockedBy"
                data-hot={(hotProp === 'blockedBy' || pickingBlocker) || undefined}
                className="prop"
                style={{ fontSize: 13 }}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !document.querySelector('.ss-panel')) { setHotProp(null); setPickingBlocker(false); } }}
                onKeyDown={(e) => { if (e.key === 'Escape') { setHotProp(null); setPickingBlocker(false); } }}
              >
                {canEdit ? (
                  <button
                    type="button"
                    className="prop-label prop-label-btn"
                    onClick={() => setPickingBlocker(true)}
                    aria-label={`${t('board.taskModal.blockedByLabel', { defaultValue: 'Blocked by' })} — edit`}
                  >
                    <LinkSimple size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.blockedByLabel', { defaultValue: 'Blocked by' })}</span>
                  </button>
                ) : (
                  <span className="prop-label"><LinkSimple size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.blockedByLabel', { defaultValue: 'Blocked by' })}</span></span>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: '1 1 100%', order: 2, flexBasis: '100%', minWidth: 0, alignItems: 'center' }}>
                  {canEdit ? (
                    <>
                      {blockedTasks.map((bt) => blockerChip(bt, true))}
                      {pickingBlocker ? (
                        <SearchableSelect defaultOpen id="blockedBy-picker" label="" value={null} options={otherTasks.filter(ot => !task.blockedBy.includes(ot.id) && !ot.parentTaskId).map(ot => ({ value: ot.id, label: `${ot.title} · ${TASK_STATUS[ot.status].label}`, icon: <TaskStatusIcon status={ot.status} size={13} /> }))} onOpenChange={(o) => { if (!o) setPickingBlocker(false); }} onChange={(v) => { if (v) { toggleBlocker(v); setPickingBlocker(false); } }} />
                      ) : (
                        <button type="button" onClick={() => setPickingBlocker(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '6px 8px', minWidth: 24, minHeight: 24 }}>+ Add</button>
                      )}
                    </>
                  ) : (
                    <>{blockedTasks.length > 0 ? blockedTasks.map((bt) => blockerChip(bt, false)) : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}</>
                  )}
                </div>
              </div>
              {cycleWarn && <InlineError>{cycleWarn}</InlineError>}
              <PropRow
                propKey="testCases"
                label={t('board.taskModal.testCasesLabel')}
                icon={<ListChecks size={12} aria-hidden="true" />}
                hot={false}
                setHot={setHotProp}
                canEdit={false}
                view={(
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {testCases.length === 0 ? '—' : `${testCases.length} linked`}
                  </span>
                )}
                control={<span />}
              />
      </>)}
      </>)}
    >
            {task.parentTaskId && (
              <SubtaskCrumb
                parentTitle={parentTask?.title ?? t('board.taskModal.parentMissing', { defaultValue: '(missing)' })}
                parentStatus={parentTask?.status ?? null}
                parentFullTitle={parentTask?.title}
                currentTitle={task.title}
                onOpenParent={onNavigate && task.parentTaskId ? () => onNavigate(task.parentTaskId!) : undefined}
              />
            )}
            {canEdit ? (
              <div className="editable-field editable-field-title" style={{ position: 'relative' }}>
                <ComposerTextarea
                  value={task.title}
                  onChange={(v) => update({ title: v })}
                  autoFocus={AUTO_FOCUS_INPUT}
                  maxLength={LIMITS.TASK_TITLE}
                  ariaLabel={t('board.taskModal.titleLabel')}
                  invalid={titleEmpty}
                  placeholder={t('board.taskModal.untitled')}
                  style={{ paddingRight: 20 }}
                />
              </div>
            ) : (
              <h3 className="detail-title">
                {task.title || <DetailEmpty>Untitled task</DetailEmpty>}
              </h3>
            )}
            {titleEmpty && <InlineError>{t('issues.modal.titleRequired')}</InlineError>}
            {variant === 'page' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge tone={TASK_PRIORITY[task.priority].tone}>
                  <TaskPriorityIcon priority={task.priority} size={11} />
                  {TASK_PRIORITY[task.priority].label}
                </Badge>
                {(task.startDate || task.dueDate) && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {task.startDate ? `${t('board.taskModal.startDateLabel')} – ${formatDate(task.startDate)}` : formatDate(task.dueDate!)}
                  </span>
                )}
                {focusDueChip.tone === 'danger' && (
                  <span className={`task-due task-due-${focusDueChip.tone}`} title={focusDueChip.title}>{focusDueChip.label}</span>
                )}
              </div>
            )}
            <div className="detail-created" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('issues.modal.createdTimeLabel')} {formatDate(task.createdAt)}, {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {variant === 'page' && (
            <div
              className="focus-badges"
              role="button"
              tabIndex={0}
              aria-label={t('board.taskModal.propertiesLabel')}
              onClick={scrollToProps}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollToProps(); } }}
            >
              <TaskStatusBadge status={task.status} />
              <Badge tone={TASK_PRIORITY[task.priority].tone}>
                <TaskPriorityIcon priority={task.priority} size={11} />
                {TASK_PRIORITY[task.priority].label}
              </Badge>
              {task.dueDate && focusDueChip.tone === 'danger' && (
                <span className={`task-due task-due-${focusDueChip.tone}`} title={focusDueChip.title}>{focusDueChip.label}</span>
              )}
            </div>
            )}
            <div className="editable-field" style={{ position: 'relative' }}>
              <MarkdownField
                label={t('board.taskModal.descriptionLabel')}
                icon={FileText}
                value={task.description}
                onChange={(v) => update({ description: v })}
                placeholder={t('board.newTaskModal.descriptionPlaceholder')}
                maxLength={LIMITS.TASK_DESCRIPTION}
                rows={4}
                variant="bare"
                hideHead={variant === 'page'}
                previewToggle
                embedAttachments={{ projectId, attachments: task.attachments ?? [] }}
              />
            </div>
            {!task.parentTaskId ? (
              <SubtaskSection
                key={task.id}
                task={task}
                canEdit={canEdit}
                allowAdd={canEdit}
                members={members}
                userId={user?.id}
                onNavigate={onNavigate}
                open={subAdding}
                onOpen={() => { setCheckAdding(false); setSubAdding(true); }}
                onClose={() => setSubAdding(false)}
              />
            ) : (
              <ParentPillSection
                parentTitle={parentTask?.title ?? null}
                canEdit={canEdit}
                onOpenParent={onNavigate && parentTask ? () => onNavigate(parentTask.id) : undefined}
                onDetach={() => update({ parentTaskId: null })}
              />
            )}

            <ChecklistSection
              key={`${task.id}-check`}
              task={task}
              canEdit={canEdit}
              allowAdd={canEdit}
              open={checkAdding}
              onOpen={() => { setSubAdding(false); setCheckAdding(true); }}
              onClose={() => setCheckAdding(false)}
            />
            {variant === 'page' && (
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPropsOpen((v) => !v)}
                  aria-expanded={propsOpen}
                  style={{ paddingLeft: 0, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'underline' }}
                >
                  {propsOpen ? t('board.taskModal.detailHideTask') : t('board.taskModal.detailShowTask')}
                </button>
              </div>
            )}
            {variant === 'page' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 110, flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>{t('board.taskModal.statusLabel')}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SearchableSelect searchable={false} id="task-status-inline" label="" ariaLabel={t('board.taskModal.statusLabel')} value={task.status} allowEmpty={false} options={STATUS_OPTIONS.map((s) => ({ value: s, label: TASK_STATUS[s].label, icon: <TaskStatusIcon status={s} size={13} /> }))} onChange={(v) => { if (v) changeStatus(v as TaskStatus, 'status'); }} />
                  </div>
                </div>
                {doneWarn && doneWarnSource === 'status' && <InlineError>{doneWarn}</InlineError>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 110, flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>{t('board.newTaskModal.priorityLabel')}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SearchableSelect searchable={false} id="task-priority-inline" label="" ariaLabel={t('board.newTaskModal.priorityLabel')} value={task.priority} allowEmpty={false} options={TASK_PRIORITY_ORDER.map((p) => ({ value: p, label: TASK_PRIORITY[p].label, icon: <TaskPriorityIcon priority={p} size={13} /> }))} onChange={(v) => { if (v) update({ priority: v as TaskPriority }); }} />
                  </div>
                </div>
              </div>
            )}

            <div className="focus-detail-check">
              <AttachmentSection
                projectId={projectId}
                entity="tasks"
                entityId={task.id}
                attachments={task.attachments ?? []}
                canEdit={canEdit}
                onChanged={(next) => update({ attachments: next })}
                onQuotaExceeded={() => setStorageLimitOpen(true)}
              />
            </div>
            {doneWarn && doneWarnSource === 'suggest' && <InlineError>{doneWarn}</InlineError>}
            <div className="focus-detail-check">
              <GitHubTaskSection
                task={task}
                canEdit={canEdit}
                onChanged={(next) => update({ githubLinks: next })}
                onMarkDone={() => changeStatus('done', 'suggest')}
              />
            </div>
            <ActivityList collapsible projectId={projectId} entity="tasks" entityId={task.id} />
            <p className="field-helper">Updated {formatRelative(task.updatedAt)}</p>
    </DetailShell>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title={t('board.taskModal.deleteConfirmTitle', { defaultValue: 'Delete task?' })}
      description={t('board.taskModal.deleteConfirmBody', { defaultValue: 'This permanently deletes the task. This cannot be undone.' })}
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    {teamId && (
      <PlanLimitModal
        open={storageLimitOpen}
        resource="storage"
        teamId={teamId}
        onClose={() => setStorageLimitOpen(false)}
      />
    )}
    </>
  );
}