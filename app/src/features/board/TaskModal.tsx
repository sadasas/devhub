import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { Trash, Clock, LinkSimple, FileText, CheckCircle, Plus, Circle, Flag, CalendarBlank, Tag, User, Rocket, ChartBar, ListChecks, PencilSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import {
  TASK_PRIORITY,
  TASK_PRIORITY_ORDER,
  TASK_STATUS,
  findLabelDef,
  hashLabelColor,
  labelChipStyleFor,
} from '../../lib/labels';
import { formatDate, formatRelative, isDecimalKey, isTaskCompletable, linkedTestCases, newId, nowIso, openBlockerNames, parseLabels, sanitizeDecimalInput, taskBlockSummary } from '../../lib/utils';
import { api } from '../../lib/api';
import { taskDueChip } from '../../lib/due-dates';
import { startAfterDue, subRangeOutsideParent } from '../../lib/start-dates';
import type { Task, TaskPriority, TaskStatus, TeamMember } from '../../lib/types';
import { LabelPickerBody } from './LabelPickerBody';
import { GCalSyncedMark } from '../integrations/GCalSyncedMark';
import type { UpdatePatch } from '../../state/project-context';
import { useProject, wouldCreateCycle } from '../../state/project-context';
import { useOptionalAuth } from '../../state/auth-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { ActivityList } from '../../components/ActivityList';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { PropRow } from '../../components/PropRow';
import { DetailShell } from '../../components/DetailShell';
import { DatePicker } from '../../components/DatePicker';
import { DetailEmpty } from '../../components/DetailList';
import { InlineError } from '../../components/InlineError';
import { Tooltip } from '../../components/Tooltip';
import { MarkdownField } from '../../components/MarkdownField';
import { SearchableSelect } from '../../components/SearchableSelect';
import { FE_LIMITS, LIMITS } from '../../lib/limits';

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'inProgress', 'review', 'done'];

// autoFocus hanya desktop (hover) — di touch, keyboard virtual melonjak (pola Modal).
const AUTO_FOCUS_INPUT = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

interface TaskModalProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskModal({ taskId, onClose }: TaskModalProps) {
  const { t } = useTranslation(['tracker','project']);
  const { state, dispatch, canEdit, projectId, teamId, saving, lastSavedAt } = useProject();
  const { user } = useOptionalAuth();
  const [hotProp, setHotProp] = useState<string | null>(null);
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
  /** Popup actual: manual menang permanen, kosong = auto-elapsed. */
  const [actualOpen, setActualOpen] = useState(false);
  const [actualPos, setActualPos] = useState<{ top: number; left: number } | null>(null);
  const actualRowRef = useRef<HTMLDivElement>(null);
  const actualPopRef = useRef<HTMLDivElement>(null);

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
  useLayoutEffect(() => {
    if (!actualOpen) return;
    const compute = () => measurePop(actualRowRef.current, actualPopRef.current, setActualPos);
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [actualOpen]);

  useEffect(() => {
    if (!actualOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!actualPopRef.current?.contains(e.target as Node)) setActualOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActualOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [actualOpen]);
  const [pickingBlocker, setPickingBlocker] = useState(false);
  /** Chip blocked-by; tombol × hanya saat baris hot (mode edit). */
  const blockerChip = (bt: { id: string; title: string }, removable: boolean) => (
    <span key={bt.id} style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <LinkSimple size={10} aria-hidden="true" /> {bt.title} {removable ? (
        <button type="button" onClick={() => toggleBlocker(bt.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 'inherit', padding: '0 2px', lineHeight: 1, minWidth: 24, minHeight: 24 }} aria-label={`Remove blocker ${bt.title}`}>×</button>
      ) : (
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 'inherit', padding: '0 2px', lineHeight: 1, visibility: 'hidden' }}>×</span>
      )}
    </span>
  );
  const [cycleWarn, setCycleWarn] = useState<string | null>(null);
  const [doneWarn, setDoneWarn] = useState<string | null>(null);
  const [rangeWarn, setRangeWarn] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checkDraft, setCheckDraft] = useState('');
  const [subDraft, setSubDraft] = useState('');
  const [subAdding, setSubAdding] = useState(false);
  const [checkAdding, setCheckAdding] = useState(false);
  const [parentPicking, setParentPicking] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

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
    setRangeWarn(null);
    setConfirmOpen(false);
    setEstimateOpen(false);
    setActualOpen(false);
    setLabelsOpen(false);
    setCheckDraft('');
    setSubDraft('');
    setSubAdding(false);
    setCheckAdding(false);
    setParentPicking(false);
  }, [taskId]);

  // Judul autogrow tanpa batas — yang scroll .composer-scroll, bukan textarea.
  useLayoutEffect(() => {
    const ta = titleRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  });

  const task = state?.tasks.find((t) => t.id === taskId);
  usePresenceStatus(t('board.taskModal.presenceEditing'), task != null);
  if (!task) return null;

  const update = (patch: UpdatePatch<Task>) =>
    dispatch({ type: 'task/update', id: task.id, patch });

  const changeStatus = (next: TaskStatus) => {
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
      return;
    }
    setDoneWarn(null);
    update({ status: next });
  };

  const otherTasks = state!.tasks.filter((t) => t.id !== task.id);
  const labelDefs = state?.labelDefs;
  const renderLabelChip = (l: string, i: number) => {
    const style = labelChipStyleFor(l, labelDefs);
    const title = findLabelDef(l, labelDefs)?.description || l;
    return (
      <Tooltip key={`${l}-${i}`} tone="light" title={title}>
        <span style={{ padding: '2px 8px', borderRadius: 6, background: style.background, fontSize: 12, color: style.color }}>{l}</span>
      </Tooltip>
    );
  };
  const dateWarn = startAfterDue(task.startDate, task.dueDate)
    ? t('board.taskModal.dateWarn')
    : null;
  const testCases = linkedTestCases(task.id, state!.testCases);
  const blockedTasks = [...new Set(task.blockedBy)]
    .map((id) => state!.tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);
  const milestone = task.milestoneId
    ? state!.milestones.find((m) => m.id === task.milestoneId)
    : undefined;
  const titleEmpty = task.title.trim() === '';
  const checklist = task.checklist ?? [];
  const subtasks = state!.tasks.filter((tt) => tt.parentTaskId === task.id);
  const subDone = subtasks.filter((tt) => tt.status === 'done').length;
  const parentTask = task.parentTaskId ? state!.tasks.find((tt) => tt.id === task.parentTaskId) : undefined;
  /** Subtask yang keluar rentang task ini (hanya relevan bila task ini parent). */
  const orphanedSubtasks = !task.parentTaskId
    ? subtasks.filter((ss) => subRangeOutsideParent(ss, task) !== null)
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
  const parentOptions = state!.tasks.filter(
    (tt) => tt.id !== task.id && !tt.parentTaskId && tt.parentTaskId !== task.id && subtasks.every((ss) => ss.id !== tt.id),
  );
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
  const addSubtask = () => {
    const title = subDraft.trim();
    if (!title || task.parentTaskId) return;
    const ts = new Date().toISOString();
    dispatch({
      type: 'task/add',
      task: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        title: title.slice(0, 300),
        status: 'todo',
        priority: task.priority,
        labels: [],
        blockedBy: [],
        parentTaskId: task.id,
        checklist: [],
        milestoneId: task.milestoneId ?? null,
        dueDate: null,
        startDate: null,
        completedAt: null,
        assigneeId: null,
        pinned: false,
        description: '',
      },
    });
    setSubDraft('');
  };

  return (
    <>
    <DetailShell
      title={t('board.taskModal.viewTitle')}
      onClose={onClose}
      footer={
        canEdit ? (
          <>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={14} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t('board.taskModal.delete')}
            </Button>
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
          </>
        ) : undefined
      }
      sidebarHead={t('board.taskModal.propertiesLabel')}
      sidebar={<>
              <PropRow
                propKey="status"
                label={t('board.taskModal.statusLabel')}
                icon={<Circle size={12} aria-hidden="true" />}
                hot={hotProp === 'status'}
                setHot={setHotProp}
                canEdit={canEdit}
                view={(
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 6, background: task.status === 'done' ? 'var(--status-success-dim)' : task.status === 'review' ? 'var(--status-warn-dim)' : task.status === 'inProgress' ? 'var(--status-info-dim)' : 'var(--bg-inset)', fontSize: 12 }}>
                    {TASK_STATUS[task.status].label}
                  </span>
                )}
                control={(
                  <SearchableSelect defaultOpen searchable={false} id="task-status" label="" ariaLabel={t('board.taskModal.statusLabel')} value={task.status} allowEmpty={false} options={STATUS_OPTIONS.map((s) => ({ value: s, label: TASK_STATUS[s].label }))} onChange={(v) => { if (v) { changeStatus(v as TaskStatus); setHotProp(null); } }} />
                )}
              />
              {/* Priority */}
              <PropRow
                propKey="priority"
                label={t('board.newTaskModal.priorityLabel')}
                icon={<Flag size={12} aria-hidden="true" />}
                hot={hotProp === 'priority'}
                setHot={setHotProp}
                canEdit={canEdit}
                view={(
                  <span style={{ padding: '2px 8px', borderRadius: 6, background: task.priority === 'urgent' ? 'var(--status-danger-dim)' : task.priority === 'high' ? 'var(--status-warn-dim)' : task.priority === 'medium' ? 'var(--status-info-dim)' : 'var(--bg-inset)', fontSize: 12, color: task.priority === 'urgent' ? 'var(--status-danger)' : task.priority === 'high' ? 'var(--status-warn)' : task.priority === 'medium' ? 'var(--status-info)' : 'var(--text-secondary)' }}>
                    {TASK_PRIORITY[task.priority].label}
                  </span>
                )}
                control={(
                  <SearchableSelect defaultOpen searchable={false} id="task-priority" label="" ariaLabel={t('board.newTaskModal.priorityLabel')} value={task.priority} allowEmpty={false} options={TASK_PRIORITY_ORDER.map((p) => ({ value: p, label: TASK_PRIORITY[p].label }))} onChange={(v) => { if (v) { update({ priority: v as TaskPriority }); setHotProp(null); } }} />
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
                      defaultValue: 'Sesuaikan {{count}} subtask',
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
                    <Tag size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.labelsLabel')}</span><PencilSimple size={12} aria-hidden="true" className="prop-edit" />
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
                view={task.assigneeId ? (
                  (() => {
                    const am = members.find((m) => m.id === task.assigneeId);
                    const an = am?.displayName || am?.email || '?';
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Avatar src={am?.avatarUrl ?? null} name={an} email={am?.email} id={task.assigneeId!} size={24} style={{ border: '2px solid var(--bg-overlay)' }} />
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{an}</span>
                      </span>
                    );
                  })()
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                )}
                control={(
                  <SearchableSelect defaultOpen id="task-assignee-inline" label="" ariaLabel={t('board.taskModal.assigneeLabel')} value={task.assigneeId ?? null} options={[
                    ...(user?.id && task.assigneeId !== user.id
                      ? (() => {
                        const me = members.find((m) => m.id === user.id);
                        const n = me?.displayName || me?.email || t('board.taskModal.assignToMe', { defaultValue: 'Assign to me' });
                        return [{ value: user.id, label: t('board.taskModal.assignToMe', { defaultValue: 'Assign to me' }), icon: <Avatar src={me?.avatarUrl ?? null} name={n} email={me?.email} id={user.id} size={20} alt="" /> }];
                      })()
                      : []),
                    ...members.filter((m) => !(user?.id && task.assigneeId !== user.id && m.id === user.id)).map((m) => { const n = m.displayName || m.email; return { value: m.id, label: n, icon: <Avatar src={m.avatarUrl ?? null} name={n} email={m.email} id={m.id} size={20} alt="" /> }; }),
                  ]} onChange={(v) => { update({ assigneeId: v }); setHotProp(null); }} triggerEmptyLabel={t('board.taskModal.assigneeLabel')} />
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
                  <SearchableSelect defaultOpen id="task-milestone" label="" ariaLabel={t('board.taskModal.milestoneLabel')} value={task.milestoneId} options={state!.milestones.map((m) => ({ value: m.id, label: m.name }))} onChange={(v) => { update({ milestoneId: v }); setHotProp(null); }} triggerEmptyLabel={t('board.taskModal.milestoneLabel')} />
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
                    <Clock size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.estimateLabel')}</span><PencilSimple size={12} aria-hidden="true" className="prop-edit" />
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
                data-hot={actualOpen || undefined}
                ref={actualRowRef}
                title={t('board.taskModal.actualHint', { defaultValue: 'Manual wins permanently — empty = auto from start date' })}
              >
                {canEdit ? (
                  <button
                    type="button"
                    className="prop-label prop-label-btn"
                    onClick={() => { setActualPos(null); setActualOpen((v) => !v); }}
                    aria-label={`${t('board.taskModal.actualLabel')} — edit`}
                  >
                    <ChartBar size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.actualLabel')}</span><PencilSimple size={12} aria-hidden="true" className="prop-edit" />
                  </button>
                ) : (
                  <span className="prop-label"><ChartBar size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.actualLabel')}</span></span>
                )}
                {canEdit ? (
                  <button
                    type="button"
                    className="prop-view"
                    onClick={() => { setActualPos(null); setActualOpen((v) => !v); }}
                  >
                    {task.actualHours != null ? (
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{task.actualHours}h</span>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </button>
                ) : task.actualHours != null ? (
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{task.actualHours}h</span>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
              {actualOpen && createPortal(
                <div
                  ref={actualPopRef}
                  className="prop-menu prop-pop"
                  role="dialog"
                  aria-label={t('board.taskModal.actualLabel')}
                  style={actualPos ? { top: actualPos.top, left: actualPos.left } : { visibility: 'hidden' }}
                >
                  <div className="prop-pop-label">{t('board.taskModal.actualLabel')}</div>
                  <input
                    autoFocus={AUTO_FOCUS_INPUT}
                    className="input"
                    type="number"
                    min={0}
                    max={FE_LIMITS.ESTIMATE_MAX}
                    step="any"
                    value={task.actualHours ?? ''}
                    aria-label={t('board.taskModal.actualLabel')}
                    placeholder={t('board.taskModal.actualLabel')}
                    inputMode="decimal"
                    onChange={(e) => { const v = sanitizeDecimalInput(e.target.value); if (v === '' || v === '.') { update({ actualHours: undefined }); return; } const n = Number(v); if (Number.isNaN(n)) return; update({ actualHours: Math.min(FE_LIMITS.ESTIMATE_MAX, Math.max(0, n)) }); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setActualOpen(false);
                      else if (!isDecimalKey(e.key)) e.preventDefault();
                    }}
                  />
                  <p className="field-helper">{t('board.taskModal.actualHint', { defaultValue: 'Manual wins permanently — empty = auto from start date' })}</p>
                </div>,
                document.body,
              )}
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
                    <LinkSimple size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.blockedByLabel', { defaultValue: 'Blocked by' })}</span><PencilSimple size={12} aria-hidden="true" className="prop-edit" />
                  </button>
                ) : (
                  <span className="prop-label"><LinkSimple size={12} aria-hidden="true" /><span className="prop-label-text">{t('board.taskModal.blockedByLabel', { defaultValue: 'Blocked by' })}</span></span>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: '1 1 100%', order: 2, flexBasis: '100%', minWidth: 0, alignItems: 'center' }}>
                  {canEdit ? (
                    <>
                      {blockedTasks.map((bt) => blockerChip(bt, true))}
                      {pickingBlocker ? (
                        <SearchableSelect defaultOpen id="blockedBy-picker" label="" value={null} options={otherTasks.filter(ot => !task.blockedBy.includes(ot.id) && !ot.parentTaskId).map(ot => ({ value: ot.id, label: `${ot.title} · ${ot.status}` }))} onChange={(v) => { if (v) { toggleBlocker(v); setPickingBlocker(false); } }} />
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
      </>}
    >
            {canEdit ? (
              <div className="editable-field editable-field-title" style={{ position: 'relative' }}>
                <textarea
                  ref={titleRef}
                  className="composer-title"
                  rows={1}
                  value={task.title}
                  autoFocus={AUTO_FOCUS_INPUT}
                  maxLength={LIMITS.TASK_TITLE}
                  onChange={(e) => update({ title: e.target.value })}
                  aria-label={t('board.taskModal.titleLabel')}
                  aria-invalid={titleEmpty}
                  placeholder={t('board.taskModal.untitled')}
                  style={{ paddingRight: 20 }}
                />
                <PencilSimple size={12} aria-hidden="true" className="editable-pencil" />
              </div>
            ) : (
              <h3 className="detail-title">
                {task.title || <DetailEmpty>Untitled task</DetailEmpty>}
              </h3>
            )}
            {titleEmpty && <InlineError>{t('issues.modal.titleRequired')}</InlineError>}
            <div className="detail-created" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
              <span style={{ width: 110, color: 'var(--text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Clock size={12} aria-hidden="true" /> {t('issues.modal.createdTimeLabel')}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{formatDate(task.createdAt)} {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
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
                previewToggle
              />
            </div>
            {doneWarn && <InlineError>{doneWarn}</InlineError>}

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <h4 className="detail-subtitle" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
                {t('board.taskModal.subtasksLabel', { defaultValue: 'Subtasks' })}
                {subtasks.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {subDone}/{subtasks.length}</span>}
              </h4>
              {canEdit && !task.parentTaskId && subtasks.length === 0 && !parentPicking && (
                <button
                  type="button"
                  onClick={() => setParentPicking(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: 0, whiteSpace: 'nowrap' }}
                >
                  {t('board.taskModal.setParent', { defaultValue: 'Make subtask of…' })}
                </button>
              )}
            </div>
            {!task.parentTaskId ? (
              <div style={{ marginTop: 2 }}>
                {subtasks.length === 0 && !canEdit && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                {subtasks.map((ss, i) => (
                  <div
                    key={ss.id}
                    className="mini-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
                      borderTop: i === 0 ? 'none' : '1px solid var(--border-hairline)',
                    }}
                  >
                    <span
                      style={{
                        width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                        border: '1px solid var(--border-strong)',
                        background: ss.status === 'done' ? 'var(--status-success)' : 'transparent',
                        color: '#fff', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      aria-hidden="true"
                    >
                      {ss.status === 'done' ? '✓' : ''}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }} title={ss.title}>{ss.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{ss.status}</span>
                  </div>
                ))}
                {canEdit && (
                  subAdding ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <input
                        autoFocus={AUTO_FOCUS_INPUT}
                        className="input"
                        value={subDraft}
                        maxLength={300}
                        onChange={(e) => setSubDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); addSubtask(); setSubAdding(false); }
                          else if (e.key === 'Escape') { setSubDraft(''); setSubAdding(false); }
                        }}
                        onBlur={() => { if (!subDraft.trim()) setSubAdding(false); }}
                        placeholder={t('board.taskModal.addSubtask', { defaultValue: 'New subtask…' })}
                        aria-label={t('board.taskModal.addSubtask', { defaultValue: 'New subtask…' })}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <Button variant="ghost" size="md" className="btn-icon" aria-label={t('board.taskModal.addSubtask', { defaultValue: 'New subtask…' })} onClick={() => { addSubtask(); setSubAdding(false); }} disabled={!subDraft.trim()}><Plus size={16} aria-hidden="true" /></Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="md"
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                      onClick={() => setSubAdding(true)}
                    >
                      + {t('board.taskModal.addSubtask', { defaultValue: 'New subtask…' })}
                    </Button>
                  )
                )}
              </div>
            ) : (
              <div className="mini-row" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 2 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('board.taskModal.parentLabel', { defaultValue: 'Parent' })}</span>
                <span style={{ color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={parentTask?.title ?? ''}>
                  {parentTask?.title ?? t('board.taskModal.parentMissing', { defaultValue: '(missing)' })}
                </span>
                {canEdit && (
                  <button type="button" className="mini-del" onClick={() => update({ parentTaskId: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '6px 8px', minWidth: 24, minHeight: 24, flexShrink: 0 }}>
                    {t('board.taskModal.detachParent', { defaultValue: 'Detach' })}
                  </button>
                )}
              </div>
            )}
            {canEdit && parentPicking && !task.parentTaskId && (
              <div style={{ marginTop: 4 }} onKeyDown={(e) => { if (e.key === 'Escape') setParentPicking(false); }}>
                <SearchableSelect
                  id="task-parent-picker"
                  label=""
                  ariaLabel={t('board.taskModal.parentLabel', { defaultValue: 'Parent:' })}
                  value={task.parentTaskId ?? null}
                  options={parentOptions.map((ot) => ({ value: ot.id, label: `${ot.title} · ${ot.status}` }))}
                  onChange={(v) => { update({ parentTaskId: v }); setParentPicking(false); }}
                  triggerEmptyLabel={t('board.taskModal.setParent', { defaultValue: 'Make subtask of…' })}
                />
              </div>
            )}

            <h4 className="detail-subtitle" style={{ marginBottom: 0 }}>
              {t('board.taskModal.checklistLabel', { defaultValue: 'Checklist' })}
              {checklist.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {checklist.filter((c) => c.done).length}/{checklist.length}</span>}
            </h4>
            <div style={{ marginTop: 2 }}>
              {checklist.length === 0 && !canEdit && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
              {checklist.map((c, i) => (
                <div
                  key={c.id}
                  className="mini-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
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
                        width: 16, height: 16, borderRadius: 5, flexShrink: 0,
                        border: '1px solid var(--border-strong)',
                        background: c.done ? 'var(--status-success)' : 'transparent',
                        color: '#fff', cursor: canEdit ? 'pointer' : 'default',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                      }}
                    >
                      {c.done ? '✓' : ''}
                    </button>
                  </Tooltip>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: c.done ? 'line-through' : 'none', color: c.done ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{c.title}</span>
                  {canEdit && (
                    <button type="button" className="mini-del" onClick={() => removeCheck(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-danger)', padding: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-label={`Remove ${c.title}`}><Trash size={15} aria-hidden="true" /></button>
                  )}
                </div>
              ))}
              {canEdit && checklist.length < 20 && (
                checkAdding ? (
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <input
                      autoFocus={AUTO_FOCUS_INPUT}
                      className="input"
                      value={checkDraft}
                      maxLength={200}
                      onChange={(e) => setCheckDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); addCheck(); }
                        else if (e.key === 'Escape') { setCheckDraft(''); setCheckAdding(false); }
                      }}
                      onBlur={() => { if (!checkDraft.trim()) setCheckAdding(false); }}
                      placeholder={t('board.taskModal.addChecklist', { defaultValue: 'New item…' })}
                      aria-label={t('board.taskModal.addChecklist', { defaultValue: 'New item…' })}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <Button variant="ghost" size="md" className="btn-icon" aria-label={t('board.taskModal.addChecklist', { defaultValue: 'New item…' })} onClick={addCheck} disabled={!checkDraft.trim()}><Plus size={16} aria-hidden="true" /></Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="md"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => setCheckAdding(true)}
                  >
                    + {t('board.taskModal.addChecklist', { defaultValue: 'New item…' })}
                  </Button>
                )
              )}
            </div>

            <h4 className="detail-subtitle">Activity</h4>
            <ActivityList projectId={projectId} entity="tasks" entityId={task.id} />
            <p className="field-helper">Updated {formatRelative(task.updatedAt)}</p>
    </DetailShell>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title="Delete task?"
      description="This permanently deletes the task. This cannot be undone."
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    </>
  );
}