import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUUpLeft,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  ChartBar,
  CheckCircle,
  Circle,
  Clock,
  Flag,
  LinkSimple,
  ListChecks,
  PencilSimple,
  Plus,
  Rocket,
  Tag,
  Trash,
  User,
} from '@phosphor-icons/react';
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
import {
  formatDate,
  isDecimalKey,
  isTaskCompletable,
  linkedTestCases,
  newId,
  openBlockerNames,
  parseLabels,
  sanitizeDecimalInput,
  taskBlockSummary,
} from '../../lib/utils';
import { taskDueChip } from '../../lib/due-dates';
import { startAfterDue, subRangeOutsideParent } from '../../lib/start-dates';
import { api } from '../../lib/api';
import type { Task, TaskPriority, TaskStatus, TeamMember } from '../../lib/types';
import { LabelPickerBody } from './LabelPickerBody';
import { GCalSyncedMark } from '../integrations/GCalSyncedMark';
import { GitHubTaskSection } from '../integrations/GitHubTaskSection';
import type { UpdatePatch } from '../../state/project-context';
import { useProject, wouldCreateCycle } from '../../state/project-context';
import { useOptionalAuth } from '../../state/auth-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Avatar } from '../../components/Avatar';
import { AttachmentSection } from '../../components/AttachmentSection';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ComposerTextarea } from '../../components/ComposerTextarea';
import { DatePicker } from '../../components/DatePicker';
import { InlineError } from '../../components/InlineError';
import { MarkdownField } from '../../components/MarkdownField';
import { PlanLimitModal } from '../../components/PlanLimitModal';
import { PropRow } from '../../components/PropRow';
import { SearchableSelect } from '../../components/SearchableSelect';
import { TaskStatusBadge } from '../../components/TaskStatusBadge';
import { Tooltip } from '../../components/Tooltip';
import { isTypingTarget } from '../../lib/keys';
import { FE_LIMITS, LIMITS } from '../../lib/limits';
import { FocusRadio } from './FocusRadio';
import { FocusTimer } from './FocusTimer';
import { track } from '../../lib/analytics';

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'inProgress', 'review', 'done'];
const AUTO_FOCUS_INPUT =
  typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

interface FocusTaskDetailProps {
  taskId: string;
  onClose: () => void;
  onNavigate?: (taskId: string) => void;
}

/**
 * FocusTaskDetail — rebuild satu kolom sesuai wireframe 02
 * "Halaman detail tugas" (board 00f96a5a, embed 55555555).
 *
 * Urutan kanonis wireframe: judul 28px → meta (Medium + Mulai–tgl + Hari
 * ini) → deskripsi → Subtask (+ Jadikan-subtask-dari DISABLE) → divider →
 * baris subtask → composer (+ chips + Enter hint) → Checklist (+ progress)
 * → Sembunyikan detail → Properties 10 baris (Status, Prioritas, Date,
 * Labels, Assignee, Milestone, Estimate, Active hours, Blocked by,
 * Test cases — kiri-kanan, value hug-content, tanpa divider, hover-edit
 * ala PropRow; Active hours + Test cases read-only).
 *
 * SENGAJA DIHAPUS dari jalur Focus (tetap ada di TaskModal/Board):
 * Created-time, focus-badges,
 * ActivityList, Updated-relative, bottombar.
 */
export function FocusTaskDetail({ taskId, onClose, onNavigate }: FocusTaskDetailProps) {
  const { t } = useTranslation('tracker');
  const { state, dispatch, canEdit, projectId, teamId } = useProject();
  const { user } = useOptionalAuth();
  const [propsOpen, setPropsOpen] = useState(true);
  const [hotProp, setHotProp] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [doneWarn, setDoneWarn] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState('');
  const [subAdding, setSubAdding] = useState(false);
  const [subAssignee, setSubAssignee] = useState<string | null>(null);
  const [subPriority, setSubPriority] = useState<TaskPriority | null>(null);
  const [subStart, setSubStart] = useState<string | null>(null);
  const [subDue, setSubDue] = useState<string | null>(null);
  const [subRangeErr, setSubRangeErr] = useState<string | null>(null);
  const [subDatesOpen, setSubDatesOpen] = useState(false);
  const [checkDraft, setCheckDraft] = useState('');
  const [checkAdding, setCheckAdding] = useState(false);
  const [parentPicking, setParentPicking] = useState(false);
  const [pickingBlocker, setPickingBlocker] = useState(false);
  const [cycleWarn, setCycleWarn] = useState<string | null>(null);
  const [rangeWarn, setRangeWarn] = useState<string | null>(null);
  /** Popup labels: draft mentah + posisi panel (pola TaskDetail). */
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [storageLimitOpen, setStorageLimitOpen] = useState(false);  const [labelsDraft, setLabelsDraft] = useState('');
  const [labelsPos, setLabelsPos] = useState<{ top: number; left: number } | null>(null);
  const labelsRowRef = useRef<HTMLDivElement>(null);
  const labelsPopRef = useRef<HTMLDivElement>(null);
  const labelsCancelRef = useRef(false);
  /** Popup estimate: panel terposisi, nilai live dari task. */
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimatePos, setEstimatePos] = useState<{ top: number; left: number } | null>(null);
  const estimateRowRef = useRef<HTMLDivElement>(null);
  const estimatePopRef = useRef<HTMLDivElement>(null);
  const subDatesTriggerRef = useRef<HTMLButtonElement>(null);
  const parentBtnRef = useRef<HTMLButtonElement>(null);
  const subCardRef = useRef<HTMLDivElement>(null);
  const checkCardRef = useRef<HTMLDivElement>(null);

  const task = state?.tasks.find((tt) => tt.id === taskId) ?? null;
  usePresenceStatus(t('board.taskModal.presenceEditing'), task != null);

  /** Helpers properti (pola TaskDetail, guard bila task null). */
  const openLabels = () => {
    if (!task) return;
    setLabelsDraft(task.labels.join(', '));
    labelsCancelRef.current = false;
    setLabelsPos(null);
    setLabelsOpen(true);
  };
  const commitLabels = () => {
    if (!labelsCancelRef.current && task && state) {
      const labels = parseLabels(labelsDraft);
      const existing = state.labelDefs ?? [];
      const seen = new Set(existing.map((d) => d.name.trim().toLowerCase()));
      const ts = new Date().toISOString();
      for (const raw of labels) {
        const name = raw.trim().slice(0, 50);
        const key = name.toLowerCase();
        if (!name || seen.has(key)) continue;
        seen.add(key);
        dispatch({
          type: 'labelDef/add',
          labelDef: { id: newId(), createdAt: ts, updatedAt: ts, name, color: hashLabelColor(key), description: '' },
        });
      }
      dispatch({ type: 'task/update', id: task.id, patch: { labels } });
    }
    labelsCancelRef.current = false;
    setLabelsOpen(false);
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
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Klik di luar kartu composer menutup + reset total (panel portal
  // .ss-panel/.dp-panel dikecualikan agar pilih assignee/tanggal tak menutup).
  // Sengaja memakai 'click' (bubble) bukan 'pointerdown': handler klik target
  // (mis. checkbox checklist, tombol + New item) jalan DULU baru outside-close,
  // sehingga aksi target tak hilang saat composer menciut dan layout bergeser.
  // Klik pada tombol pembuka ([data-composer-toggle]) diabaikan: listener
  // terpasang mid-dispatch dan event pembuka masih mencapai document — tanpa
  // pengecualian ini composer langsung menutup dirinya sendiri.
  useEffect(() => {
    if (!subAdding) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.('[data-composer-toggle]')) return;
      if (subCardRef.current?.contains(el as Node)) return;
      if (el?.closest?.('.ss-panel,.dp-panel')) return;
      setSubDraft('');
      setSubAssignee(null);
      setSubPriority(null);
      setSubStart(null);
      setSubDue(null);
      setSubRangeErr(null);
      setSubDatesOpen(false);
      setSubAdding(false);
    };
    document.addEventListener('click', onDown);
    return () => document.removeEventListener('click', onDown);
  }, [subAdding]);

  useEffect(() => {
    if (!checkAdding) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.('[data-composer-toggle]')) return;
      if (checkCardRef.current?.contains(el as Node)) return;
      setCheckDraft('');
      setCheckAdding(false);
    };
    document.addEventListener('click', onDown);
    return () => document.removeEventListener('click', onDown);
  }, [checkAdding]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isTypingTarget(e.target)) {
        e.preventDefault();
        onClose();
        return;
      }
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== 'F' && e.key !== 'f') return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!state || !task) return null;

  const update = (patch: UpdatePatch<Task>) =>
    dispatch({ type: 'task/update', id: task.id, patch });

  const changeStatus = (next: TaskStatus) => {
    if (next === 'done' && !isTaskCompletable(task, state.testCases, state.tasks)) {
      const blockers = openBlockerNames(task, state.tasks);
      if (blockers.length > 0) {
        setDoneWarn(
          t('board.taskModal.blockedByNames', {
            defaultValue: 'Blocked by {{names}} — finish them first.',
            names: blockers.slice(0, 3).join(', '),
          }),
        );
      } else {
        const summary = taskBlockSummary(task, state.testCases, state.tasks);
        setDoneWarn(
          summary.length > 0
            ? t('board.taskModal.blockedSummary', {
                defaultValue: 'Cannot mark done: {{reasons}} not finished yet.',
                reasons: summary.join(', '),
              })
            : t('board.taskModal.cannotMarkDone', { count: 1 }),
        );
      }
      return;
    }
    setDoneWarn(null);
    update({ status: next });
  };

  /** Data turunan properti (pola TaskDetail). */
  const otherTasks = state.tasks.filter((tt) => tt.id !== task.id);
  const labelDefs = state.labelDefs;
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
  const testCases = linkedTestCases(task.id, state.testCases);
  const blockedTasks = [...new Set(task.blockedBy)]
    .map((id) => state.tasks.find((tt) => tt.id === id))
    .filter((tt): tt is Task => tt !== undefined);
  const milestone = task.milestoneId
    ? state.milestones.find((m) => m.id === task.milestoneId)
    : undefined;
  const orphanedSubtasks = !task.parentTaskId
    ? state.tasks
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
    if (next.length > task.blockedBy.length && wouldCreateCycle(state.tasks, task.id, next)) {
      setCycleWarn(t('board.taskModal.cycleWarn'));
      return;
    }
    setCycleWarn(null);
    update({ blockedBy: next });
  };
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

  const titleEmpty = task.title.trim() === '';
  const chip = taskDueChip(task);
  const checklist = task.checklist ?? [];
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = checklist.length === 0 ? 0 : Math.round((doneCount / checklist.length) * 100);
  const subtasks = state.tasks.filter((tt) => tt.parentTaskId === task.id);
  const parentTask = task.parentTaskId
    ? state.tasks.find((tt) => tt.id === task.parentTaskId)
    : undefined;
  const parentTitle = parentTask?.title ?? t('board.taskModal.parentMissing');
  const subDone = subtasks.filter((tt) => tt.status === 'done').length;
  const parentOptions = state.tasks.filter(
    (tt) => tt.id !== task.id && !tt.parentTaskId && subtasks.every((ss) => ss.id !== tt.id),
  );
  const showAdders = canEdit && !titleEmpty;

  const toggleCheck = (cid: string) => {
    update({ checklist: checklist.map((c) => (c.id === cid ? { ...c, done: !c.done } : c)) });
  };
  const removeCheck = (cid: string) => {
    update({ checklist: checklist.filter((c) => c.id !== cid) });
  };
  const addCheck = () => {
    const title = checkDraft.trim().slice(0, 200);
    if (!title || checklist.length >= 20) return;
    update({ checklist: [...checklist, { id: newId(), title, done: false }] });
    setCheckDraft('');
  };

  const addSubtask = (): boolean => {
    const title = subDraft.trim();
    if (!title || task.parentTaskId) return false;
    if (subRangeOutsideParent({ startDate: subStart, dueDate: subDue }, task)) {
      setSubRangeErr(
        t('board.taskModal.subRangeWarn', {
          defaultValue: 'Date is outside the parent range ({{start}} – {{due}}).',
          start: task.startDate ? formatDate(task.startDate) : '…',
          due: task.dueDate ? formatDate(task.dueDate) : '…',
        }),
      );
      return false;
    }
    setSubRangeErr(null);
    const ts = new Date().toISOString();
    dispatch({
      type: 'task/add',
      task: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        title: title.slice(0, 300),
        status: 'todo',
        priority: subPriority ?? task.priority,
        labels: [],
        blockedBy: [],
        parentTaskId: task.id,
        checklist: [],
        milestoneId: task.milestoneId ?? null,
        dueDate: subDue,
        startDate: subStart,
        completedAt: null,
        assigneeId: subAssignee,
        pinned: false,
        description: '',
      },
    });
    setSubDraft('');
    return true;
  };

  return (
    <div className="page">
      <div
        className={`focus-topbar${scrolled ? ' focus-topbar--scrolled' : ''}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 8,
          padding: '8px 0',
          marginBottom: 16,
        }}
      >
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
        <div
          className="focus-combined"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0,
            justifySelf: 'center',
            minWidth: 0,
          }}
        >
          <FocusTimer />
          <FocusRadio />
        </div>
        {task.status !== 'done' ? (
          <Button
            variant="primary"
            size="sm"
            className="focus-topbar-done"
            leftIcon={<CheckCircle size={14} aria-hidden="true" />}
            onClick={() => {
              track('focus_mark_done', { source: 'topbar' });
              changeStatus('done');
            }}
            style={{ justifySelf: 'end' }}
          >
            <span className="focus-topbar-label">{t('board.taskModal.focusMarkDone')}</span>
          </Button>
        ) : (
          <span style={{ justifySelf: 'end' }}>
            <Badge tone="success">{TASK_STATUS.done.label}</Badge>
          </span>
        )}
      </div>

      <div className="detail-grid">
        <div className="detail-main focus-detail">
          {task.parentTaskId && (
            <div className="focus-detail-crumb">
              {onNavigate && parentTask ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm focus-detail-parentbtn"
                  onClick={() => onNavigate(parentTask.id)}
                  aria-label={t('board.taskModal.backToParent')}
                  title={parentTask.title}
                >
                  <ArrowUUpLeft size={14} aria-hidden="true" />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {parentTitle}
                  </span>
                  <TaskStatusBadge status={parentTask.status} />
                </button>
              ) : (
                <span className="focus-detail-parentbtn" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {parentTitle}
                  {parentTask && (
                    <TaskStatusBadge status={parentTask.status} />
                  )}
                </span>
              )}
              <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                ›
              </span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 13,
                  color: 'var(--text-muted)',
                }}
              >
                {task.title || t('board.taskModal.untitled')}
              </span>
            </div>
          )}
          <div className="focus-detail-head">
          {canEdit ? (
            <div className="editable-field editable-field-title" style={{ position: 'relative' }}>
              <ComposerTextarea
                value={task.title}
                onChange={(v) => update({ title: v })}
                autoFocus={AUTO_FOCUS_INPUT}
                maxLength={LIMITS.TASK_TITLE}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                ariaLabel={t('board.taskModal.titleLabel')}
                invalid={titleEmpty}
                placeholder={t('board.taskModal.untitled')}
              />
            </div>
          ) : (
            <h3 className="detail-title">{task.title}</h3>
          )}
          {titleEmpty && <InlineError>{t('issues.modal.titleRequired')}</InlineError>}

          <div className="focus-detail-meta">
            <Badge tone={TASK_PRIORITY[task.priority].tone}>
              <TaskPriorityIcon priority={task.priority} size={11} />
              {TASK_PRIORITY[task.priority].label}
            </Badge>
            {(task.startDate || task.dueDate) && (
              <span className="focus-detail-dates">
                {task.startDate
                  ? `${t('board.taskModal.startDateLabel')} – ${formatDate(task.startDate)}`
                  : formatDate(task.dueDate!)}
              </span>
            )}
            {task.dueDate && chip.tone === 'danger' && (
              <span className={`task-due task-due-${chip.tone}`} title={chip.title}>
                {chip.label}
              </span>
            )}
          </div>

          <div className="focus-detail-desc">
            <MarkdownField
              label={t('board.taskModal.descriptionLabel')}
              value={task.description}
              onChange={(v) => update({ description: v })}
              placeholder={t('board.newTaskModal.descriptionPlaceholder')}
              maxLength={LIMITS.TASK_DESCRIPTION}
              rows={2}
              variant="bare"
              previewToggle
            />
          </div>
          </div>

          {!task.parentTaskId ? (
            <div className="focus-detail-check">
              <div className="focus-detail-subhead">
                <h4 className="detail-subtitle" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
                  {t('board.taskModal.subtasksLabel', { defaultValue: 'Subtasks' })}
                  {subtasks.length > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                      {' '}
                      · {subDone}/{subtasks.length}
                    </span>
                  )}
                </h4>
                {canEdit && (
                  subtasks.length > 0 ? (                    <Tooltip
                      title={
                        t('board.taskModal.setParentDisabledHint', {
                          defaultValue: 'Sudah punya subtask',
                        }) as string
                      }
                    >
                      <span style={{ display: 'inline-flex' }}>
                        <button
                          type="button"
                          disabled
                          aria-label={
                            t('board.taskModal.setParentDisabledHint', {
                              defaultValue: 'Sudah punya subtask',
                            }) as string
                          }
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'default',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            padding: 0,
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            opacity: 0.55,
                          }}
                        >
                          <CaretDown size={12} aria-hidden="true" />
                          {t('board.taskModal.setParent', { defaultValue: 'Make subtask of…' })}
                        </button>
                      </span>
                    </Tooltip>
                  ) : (
                    <button
                      ref={parentBtnRef}
                      type="button"
                      onClick={() => setParentPicking((v) => !v)}
                      aria-label={
                        t('board.taskModal.setParent', {
                          defaultValue: 'Make subtask of…',
                        }) as string
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: 12,
                        padding: 0,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <CaretDown size={12} aria-hidden="true" />
                      {t('board.taskModal.setParent', { defaultValue: 'Make subtask of…' })}
                    </button>
                  )
                )}
              </div>
              <div className="focus-detail-div" aria-hidden="true" />
              <div>
                {subtasks.map((ss, i) => {
                  const sc = taskDueChip(ss);
                  const rowStyle = {
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '5px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border-hairline)',
                    cursor: onNavigate ? 'pointer' : undefined,
                    background: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: 'none',
                    width: '100%',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'inherit',
                  } as const;
                  const inner = (
                    <>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 4,
                          flexShrink: 0,
                          border: '1px solid var(--border-strong)',
                          background:
                            ss.status === 'done' ? 'var(--status-success)' : 'transparent',
                          color: 'var(--text-on-accent)',
                          fontSize: 10,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        aria-hidden="true"
                      >
                        {ss.status === 'done' ? '✓' : ''}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 13,
                            whiteSpace: 'normal',
                            overflowWrap: 'anywhere',
                            color: 'var(--text-secondary)',
                          }}
                          title={ss.title}
                        >
                          {ss.title}
                        </span>
                        {ss.dueDate && (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              color: 'var(--text-muted)',
                            }}
                          >
                            <Tooltip title={`${t('board.taskModal.dueDateLabel')}: ${formatDate(ss.dueDate)}`}>
                              <span>{formatDate(ss.dueDate)}</span>
                            </Tooltip>
                            {sc.tone === 'danger' && sc.label && (
                              <span
                                className={`task-due task-due-${sc.tone}`}
                                title={sc.title}
                              >
                                {sc.label}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                        <TaskStatusBadge status={ss.status} size={11} />
                      </span>
                    </>
                  );
                  return onNavigate ? (
                    <button
                      key={ss.id}
                      type="button"
                      className="mini-row"
                      onClick={() => onNavigate(ss.id)}
                      aria-label={t('board.taskModal.openSubtask', {
                        defaultValue: 'Open subtask {{title}}',
                        title: ss.title,
                      })}
                      style={rowStyle}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div key={ss.id} className="mini-row" style={rowStyle}>
                      {inner}
                    </div>
                  );
                })}
                {showAdders &&
                  (subAdding ? (
                    <div ref={subCardRef} style={{ marginTop: 4 }}>
                      <ComposerTextarea
                        autoFocus={AUTO_FOCUS_INPUT}
                        value={subDraft}
                        onChange={setSubDraft}
                        onSubmit={() => { addSubtask(); }}
                        onCancel={() => { setSubDraft(''); setSubAssignee(null); setSubPriority(null); setSubStart(null); setSubDue(null); setSubRangeErr(null); setSubAdding(false); }}
                        maxLength={300}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        placeholder={t('board.taskModal.addSubtask', {
                          defaultValue: 'New subtask…',
                        })}
                        ariaLabel={t('board.taskModal.addSubtask', {
                          defaultValue: 'New subtask…',
                        })}
                        style={{ fontSize: 13, fontWeight: 400 }}
                      />
                      <div
                        className="composer-propbar"
                        style={{ borderTop: 'none', background: 'transparent', padding: '6px 8px' }}
                      >
                        <span className="prop" data-prop="assignee">
                          <span className="prop-ic" aria-hidden="true">
                            <User size={14} />
                          </span>
                          <span className="sr-only">
                            {t('board.taskModal.subAssignee', { defaultValue: 'Subtask assignee' })}
                          </span>
                          <SearchableSelect
                            id="new-subtask-assignee"
                            label=""
                            ariaLabel={t('board.taskModal.subAssignee', {
                              defaultValue: 'Subtask assignee',
                            })}
                            value={subAssignee}
                            searchable={false}
                            options={[
                              ...(user?.id
                                ? (() => {
                                    const me = members.find((m) => m.id === user.id);
                                    const n =
                                      me?.displayName ||
                                      me?.email ||
                                      t('board.taskModal.assignToMe', {
                                        defaultValue: 'Assign to me',
                                      });
                                    return [
                                      {
                                        value: user.id,
                                        label: t('board.taskModal.assignToMe', {
                                          defaultValue: 'Assign to me',
                                        }),
                                        icon: (
                                          <Avatar
                                            src={me?.avatarUrl ?? null}
                                            name={n}
                                            email={me?.email}
                                            id={user.id}
                                            size={20}
                                            alt=""
                                          />
                                        ),
                                      },
                                    ];
                                  })()
                                : []),
                              ...members
                                .filter((m) => m.id !== user?.id)
                                .map((m) => {
                                  const n = m.displayName || m.email;
                                  return {
                                    value: m.id,
                                    label: n,
                                    icon: (
                                      <Avatar
                                        src={m.avatarUrl ?? null}
                                        name={n}
                                        email={m.email}
                                        id={m.id}
                                        size={20}
                                        alt=""
                                      />
                                    ),
                                  };
                                }),
                            ]}
                            onChange={setSubAssignee}
                            triggerEmptyLabel={t('board.taskModal.subAssignee', {
                              defaultValue: 'Subtask assignee',
                            })}
                          />
                        </span>
                        <button
                          ref={subDatesTriggerRef}
                          type="button"
                          className="prop"
                          data-prop="dates"
                          onClick={() => setSubDatesOpen((v) => !v)}
                          aria-haspopup="dialog"
                          aria-expanded={subDatesOpen}
                        >
                          <span className="prop-ic" aria-hidden="true">
                            <CalendarBlank size={14} />
                          </span>
                          <span className="prop-text">
                            {subStart || subDue
                              ? subStart && subDue
                                ? `${formatDate(subStart)} – ${formatDate(subDue)}`
                                : formatDate(subStart || subDue)
                              : t('board.taskModal.subDates', { defaultValue: 'Subtask dates' })}
                          </span>
                        </button>
                        {subDatesOpen && (
                          <DatePicker
                            id="new-subtask-dates"
                            mode="range"
                            start={subStart}
                            end={subDue}
                            minDate={task.startDate?.slice(0, 10) ?? null}
                            maxDate={task.dueDate?.slice(0, 10) ?? null}
                            anchorEl={subDatesTriggerRef.current}
                            onApply={(s, e) => {
                              setSubStart(s);
                              setSubDue(e);
                              setSubRangeErr(null);
                              setSubDatesOpen(false);
                            }}
                            onClose={() => setSubDatesOpen(false)}
                          />
                        )}
                        <span className="prop" data-prop="priority">
                          <span className="prop-ic" aria-hidden="true">
                            <Flag size={14} />
                          </span>
                          <span className="sr-only">
                            {t('board.taskModal.subPriority', {
                              defaultValue: 'Subtask priority',
                            })}
                          </span>
                          <SearchableSelect
                            id="new-subtask-priority"
                            label=""
                            ariaLabel={t('board.taskModal.subPriority', {
                              defaultValue: 'Subtask priority',
                            })}
                            value={subPriority}
                            searchable={false}
                            options={TASK_PRIORITY_ORDER.map((p) => ({
                              value: p,
                              label: TASK_PRIORITY[p].label,
                              icon: <TaskPriorityIcon priority={p} size={13} />,
                            }))}
                            emptyLabel={t('board.taskModal.followParent', {
                              defaultValue: 'Follow parent',
                            })}
                            triggerEmptyLabel={t('board.taskModal.subPriorityInherit', {
                              defaultValue: '{{label}} (inherited)',
                              label: TASK_PRIORITY[task.priority].label,
                            })}
                            onChange={(v) => setSubPriority(v as TaskPriority | null)}
                          />
                        </span>
                        {subDraft.trim() ? (
                          <span
                            style={{
                              marginLeft: 'auto',
                              display: 'inline-flex',
                              alignItems: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Tooltip title={t('board.taskModal.addSubtask', { defaultValue: 'New subtask…' })}>
                            <Button
                              variant="primary"
                              size="md"
                              className="btn-icon"
                              aria-label={t('board.taskModal.addSubtask', {
                                defaultValue: 'New subtask…',
                              })}
                              onClick={() => {
                                addSubtask();
                              }}
                            >
                              <Plus size={16} aria-hidden="true" />
                            </Button>
                            </Tooltip>
                          </span>
                        ) : null}
                      </div>
                      {subRangeErr && (
                        <div style={{ padding: '0 12px 8px' }}>
                          <InlineError>{subRangeErr}</InlineError>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="md"
                      data-composer-toggle="subtask"
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                      onClick={() => {
                        setCheckDraft('');
                        setCheckAdding(false);
                        setSubAdding(true);
                      }}
                    >
                      + {t('board.taskModal.addSubtask', { defaultValue: 'New subtask…' })}
                    </Button>
                  ))}
              </div>
              {canEdit && parentPicking && (
                <SearchableSelect
                  id="task-parent-picker"
                  label=""
                  defaultOpen
                  hideTrigger
                  anchorEl={parentBtnRef.current}
                  ariaLabel={t('board.taskModal.parentLabel', { defaultValue: 'Parent:' })}
                    value={task.parentTaskId ?? null}
                    options={parentOptions.map((ot) => ({
                      value: ot.id,
                      label: `${ot.title} · ${TASK_STATUS[ot.status].label}`,
                      icon: <TaskStatusIcon status={ot.status} size={13} />,
                    }))}
                    onOpenChange={(o) => {
                      if (!o) setParentPicking(false);
                    }}
                    onChange={(v) => {
                      update({ parentTaskId: v });
                      setParentPicking(false);
                      parentBtnRef.current?.focus();
                    }}
                    triggerEmptyLabel={t('board.taskModal.setParent', {
                      defaultValue: 'Make subtask of…',
                    })}
                  />
              )}
            </div>
          ) : (
            <div className="focus-detail-check">
              <div className="focus-detail-subhead">
                <h4 className="detail-subtitle" style={{ marginBottom: 0, flex: 'none', minWidth: 0 }}>
                  {t('board.taskModal.subtasksLabel', { defaultValue: 'Subtasks' })}
                </h4>
                <span className="focus-detail-parentpill">
                  <span aria-hidden="true">✓</span>
                  <span className="focus-detail-parentpill-text">
                    {t('board.taskModal.subtaskOf', {
                      defaultValue: 'Subtask of {{parent}}',
                      parent: parentTitle,
                    })}
                  </span>
                </span>
                {canEdit && (
                  <Tooltip title={t('board.taskModal.detachParent')}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon focus-detail-detach"
                      onClick={() => update({ parentTaskId: null })}
                      aria-label={t('board.taskModal.detachParent')}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </Tooltip>
                )}
              </div>
              <div className="focus-detail-childinfo">
                {t('board.taskModal.subtaskChildInfo', {
                  defaultValue:
                    "This task is a subtask of '{{parent}}', so it can't have subtasks of its own.",
                  parent: parentTitle,
                })}
              </div>
            </div>
          )}

          <div className="focus-detail-check">
          <h4 className="detail-subtitle" style={{ marginBottom: 0 }}>
            {t('board.taskModal.checklistLabel', { defaultValue: 'Checklist' })}
            {checklist.length > 0 && (
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                {' '}
                · {doneCount}/{checklist.length}
              </span>
            )}
          </h4>
          {checklist.length > 0 && (
            <div
              role="progressbar"
              aria-valuenow={doneCount}
              aria-valuemin={0}
              aria-valuemax={checklist.length}
              aria-label={t('board.taskModal.checklistLabel', { defaultValue: 'Checklist' })}
              style={{
                height: 4,
                borderRadius: 'var(--radius-pill)',
                background: 'color-mix(in srgb, var(--text-muted) 18%, transparent)',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--accent-focus)',
                }}
              />
            </div>
          )}
          <div>
            {checklist.map((c, i) => (
              <div
                key={c.id}
                className="mini-row"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '5px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border-hairline)',
                }}
              >
                <Tooltip title={canEdit ? (c.done ? t('board.taskModal.uncheckItem', { defaultValue: 'Mark as todo' }) : t('board.taskModal.checkItem', { defaultValue: 'Mark done' })) : undefined}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={c.done}
                  aria-label={c.title}
                  onClick={() => canEdit && toggleCheck(c.id)}
                  disabled={!canEdit}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 5,
                    flexShrink: 0,
                    border: '1px solid var(--border-strong)',
                    background: c.done ? 'var(--status-success)' : 'transparent',
                    color: 'var(--text-on-accent)',
                    cursor: canEdit ? 'pointer' : 'default',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                  }}
                >
                  {c.done ? '✓' : ''}
                </button>
                </Tooltip>
                <span
                  className="mini-row-body"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    textDecoration: c.done ? 'line-through' : 'none',
                    color: c.done ? 'var(--text-muted)' : 'var(--text-secondary)',
                  }}
                >
                  {c.title}
                </span>
                {canEdit && (
                  <span className="mini-row-actions">
                    <Tooltip title={`Remove ${c.title}`}>
                    <button
                      type="button"
                      className="mini-del"
                      onClick={() => removeCheck(c.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--status-danger)',
                        padding: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                      aria-label={`Remove ${c.title}`}
                    >
                      <Trash size={15} aria-hidden="true" />
                    </button>
                    </Tooltip>
                  </span>
                )}
              </div>
            ))}
            {showAdders &&
              checklist.length < 20 &&
              (checkAdding ? (
                <div ref={checkCardRef} style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <ComposerTextarea
                    autoFocus={AUTO_FOCUS_INPUT}
                    value={checkDraft}
                    onChange={setCheckDraft}
                    onSubmit={() => { addCheck(); }}
                    onCancel={() => { setCheckDraft(''); setCheckAdding(false); }}
                    onBlur={() => {
                      if (!checkDraft.trim()) setCheckAdding(false);
                    }}
                    maxLength={200}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    placeholder={t('board.taskModal.addChecklist', { defaultValue: 'New item…' })}
                    ariaLabel={t('board.taskModal.addChecklist', { defaultValue: 'New item…' })}
                    wrapStyle={{ flex: 1, minWidth: 0 }}
                    style={{ fontSize: 13, fontWeight: 400 }}
                  />
                  {checkDraft.trim() ? (
                    <Tooltip title={t('board.taskModal.addChecklist', { defaultValue: 'New item…' })}>
                    <Button
                      variant="primary"
                      size="md"
                      className="btn-icon"
                      aria-label={t('board.taskModal.addChecklist', {
                        defaultValue: 'New item…',
                      })}
                      onClick={addCheck}
                    >
                      <Plus size={16} aria-hidden="true" />
                    </Button>
                    </Tooltip>
                  ) : null}
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="md"
                  data-composer-toggle="checklist"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => {
                    setSubDraft('');
                    setSubAssignee(null);
                    setSubPriority(null);
                    setSubStart(null);
                    setSubDue(null);
                    setSubRangeErr(null);
                    setSubDatesOpen(false);
                    setSubAdding(false);
                    setCheckAdding(true);
                  }}
                >
                  + {t('board.taskModal.addChecklist', { defaultValue: 'New item…' })}
                </Button>
              ))}
          </div>
          </div>

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

          <div className="focus-detail-check">
            <GitHubTaskSection
              task={task}
              canEdit={canEdit}
              onChanged={(next) => update({ githubLinks: next })}
              onMarkDone={() => changeStatus('done')}
            />
          </div>

          <div className="focus-detail-propswrap">
          <div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPropsOpen((v) => !v)}
              aria-expanded={propsOpen}
              style={{
                paddingLeft: 0,
                fontSize: 12,
                color: 'var(--text-muted)',
                textDecoration: 'underline',
              }}
            >
              {propsOpen
                ? t('board.taskModal.detailHideTask')
                : t('board.taskModal.detailShowTask')}
            </button>
          </div>
          {propsOpen && (
            <div className="focus-detail-props">
              <PropRow
                propKey="status"
                label={t('board.taskModal.statusLabel')}
                icon={<Circle size={12} aria-hidden="true" />}
                hot={hotProp === 'status'}
                setHot={setHotProp}
                canEdit={canEdit}
                editAfterValue
                view={(
                  <TaskStatusBadge status={task.status} />
                )}
                control={(
                  <SearchableSelect defaultOpen searchable={false} id="task-status" label="" ariaLabel={t('board.taskModal.statusLabel')} value={task.status} allowEmpty={false} triggerContent={<TaskStatusBadge status={task.status} />} options={STATUS_OPTIONS.map((s) => ({ value: s, label: TASK_STATUS[s].label, icon: <TaskStatusIcon status={s} size={13} /> }))} onOpenChange={(o) => { if (!o) setHotProp(null); }} onChange={(v) => { if (v) { changeStatus(v as TaskStatus); setHotProp(null); } }} />
                )}
              />
              <PropRow
                propKey="priority"
                label={t('board.newTaskModal.priorityLabel')}
                icon={<Flag size={12} aria-hidden="true" />}
                hot={hotProp === 'priority'}
                setHot={setHotProp}
                canEdit={canEdit}
                editAfterValue
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
              <PropRow
                propKey="dates"
                label={t('board.taskModal.dateLabel')}
                icon={<CalendarBlank size={12} aria-hidden="true" />}
                hot={hotProp === 'dates'}
                setHot={setHotProp}
                canEdit={canEdit}
                editAfterValue
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
                    <Tag size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.labelsLabel')}</span>
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
                {canEdit && !labelsOpen && (
                  <span className="prop-pencil" aria-hidden="true">
                    <PencilSimple size={12} aria-hidden="true" />
                  </span>
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
              <PropRow
                propKey="assignee"
                label={t('board.taskModal.assigneeLabel')}
                icon={<User size={12} aria-hidden="true" />}
                hot={hotProp === 'assignee'}
                setHot={setHotProp}
                canEdit={canEdit}
                editAfterValue
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
              <PropRow
                propKey="milestone"
                label={t('board.taskModal.milestoneLabel')}
                icon={<Rocket size={12} aria-hidden="true" />}
                hot={hotProp === 'milestone'}
                setHot={setHotProp}
                canEdit={canEdit}
                editAfterValue
                view={(
                  <span style={{ fontSize: 13, color: milestone ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {milestone ? milestone.name : '—'}
                  </span>
                )}
                control={(
                  <SearchableSelect defaultOpen id="task-milestone" label="" ariaLabel={t('board.taskModal.milestoneLabel')} value={task.milestoneId} options={state.milestones.map((m) => ({ value: m.id, label: m.name }))} onOpenChange={(o) => { if (!o) setHotProp(null); }} onChange={(v) => { update({ milestoneId: v }); setHotProp(null); }} triggerEmptyLabel={t('board.taskModal.milestoneLabel')} />
                )}
              />
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
                    <Clock size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.estimateLabel')}</span>
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
                {canEdit && !estimateOpen && (
                  <span className="prop-pencil" aria-hidden="true">
                    <PencilSimple size={12} aria-hidden="true" />
                  </span>
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
                <span className="prop-label"><ChartBar size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.actualLabel')}</span></span>
                {task.actualHours != null ? (
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
            </div>
          )}
          </div>
          {doneWarn && <InlineError>{doneWarn}</InlineError>}
        </div>
      </div>
      {task.status !== 'done' && (
        <div className="focus-done-bar">
          <Button
            variant="primary"
            size="md"
            leftIcon={<CheckCircle size={14} aria-hidden="true" />}
            onClick={() => {
              track('focus_mark_done', { source: 'bar' });
              changeStatus('done');
            }}
            style={{ width: '100%', background: 'var(--accent-focus)', color: 'var(--text-on-accent)' }}
          >
            {t('board.taskModal.focusMarkDone')}
          </Button>
        </div>
      )}
      {teamId && (
        <PlanLimitModal
          open={storageLimitOpen}
          resource="storage"
          teamId={teamId}
          onClose={() => setStorageLimitOpen(false)}
        />
      )}
    </div>
  );
}
