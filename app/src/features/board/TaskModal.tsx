import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { Trash, Clock, LinkSimple, FileText, CheckCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import {
  TASK_PRIORITY,
  TASK_PRIORITY_ORDER,
  TASK_STATUS,
} from '../../lib/labels';
import { formatDate, formatRelative, isDigitKey, isTaskCompletable, linkedTestCases, parseLabels, sanitizeIntegerInput } from '../../lib/utils';
import { api } from '../../lib/api';
import { taskDueChip } from '../../lib/due-dates';
import { startAfterDue } from '../../lib/start-dates';
import type { Task, TaskPriority, TaskStatus, TeamMember } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject, wouldCreateCycle } from '../../state/project-context';
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
import { MarkdownField } from '../../components/MarkdownField';
import { SearchableSelect } from '../../components/SearchableSelect';
import { FE_LIMITS, LIMITS } from '../../lib/limits';

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'inProgress', 'review', 'done'];

interface TaskModalProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskModal({ taskId, onClose }: TaskModalProps) {
  const { t } = useTranslation(['tracker','project']);
  const { state, dispatch, canEdit, projectId, teamId, saving, lastSavedAt } = useProject();
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

  const openLabels = () => {
    if (!task) return;
    setLabelsDraft(task.labels.join(', '));
    labelsCancelRef.current = false;
    setLabelsPos(null);
    setLabelsOpen(true);
  };
  const commitLabels = () => {
    if (!labelsCancelRef.current && task) update({ labels: parseLabels(labelsDraft) });
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
  const [pickingBlocker, setPickingBlocker] = useState(false);
  /** Chip blocked-by; tombol × hanya saat baris hot (mode edit). */
  const blockerChip = (bt: { id: string; title: string }, removable: boolean) => (
    <span key={bt.id} style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <LinkSimple size={10} aria-hidden="true" /> {bt.title} {removable ? (
        <button type="button" onClick={() => toggleBlocker(bt.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '0 2px', lineHeight: 1 }} aria-label={`Remove blocker ${bt.title}`}>×</button>
      ) : (
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 12, padding: '0 2px', lineHeight: 1, visibility: 'hidden' }}>×</span>
      )}
    </span>
  );
  const [cycleWarn, setCycleWarn] = useState<string | null>(null);
  const [doneWarn, setDoneWarn] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
    setConfirmOpen(false);
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
    if (next === 'done' && !isTaskCompletable(task, state!.testCases)) {
      const pending = state!.testCases.filter(
        (tc) => tc.taskId === task.id && tc.status !== 'pass',
      );
      setDoneWarn(
        t('board.taskModal.cannotMarkDone', { count: pending.length }),
      );
      return;
    }
    setDoneWarn(null);
    update({ status: next });
  };

  const otherTasks = state!.tasks.filter((t) => t.id !== task.id);
  const dateWarn = startAfterDue(task.startDate, task.dueDate)
    ? t('board.taskModal.dateWarn')
    : null;
  const testCases = linkedTestCases(task.id, state!.testCases);
  const blockedTasks = task.blockedBy
    .map((id) => state!.tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);
  const milestone = task.milestoneId
    ? state!.milestones.find((m) => m.id === task.milestoneId)
    : undefined;
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
      onClose={onClose}
      footer={
        canEdit ? (
          <>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t('board.taskModal.delete')}
            </Button>
            {(saving || lastSavedAt) && (
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
                hot={hotProp === 'status'}
                setHot={setHotProp}
                canEdit={canEdit}
                view={(
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: task.status === 'done' ? 'var(--status-success-dim)' : task.status === 'review' ? 'var(--status-warn-dim)' : task.status === 'inProgress' ? 'var(--status-info-dim)' : 'var(--bg-inset)', fontSize: 12 }}>
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
                hot={hotProp === 'priority'}
                setHot={setHotProp}
                canEdit={canEdit}
                view={(
                  <span style={{ padding: '2px 8px', borderRadius: 999, background: task.priority === 'urgent' ? 'var(--status-danger-dim)' : task.priority === 'high' ? 'var(--status-warn-dim)' : task.priority === 'medium' ? 'var(--status-info-dim)' : 'var(--bg-inset)', fontSize: 11, color: task.priority === 'urgent' ? 'var(--status-danger)' : task.priority === 'high' ? 'var(--status-warn)' : task.priority === 'medium' ? 'var(--status-info)' : 'var(--text-secondary)' }}>
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
                hot={hotProp === 'dates'}
                setHot={setHotProp}
                canEdit={canEdit}
                view={!(task.startDate || task.dueDate) ? (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', maxWidth: '100%' }}>
                    <span>
                      {task.startDate ? formatDate(task.startDate) : t('board.taskModal.startDateLabel')}
                      {' - '}
                      {task.dueDate ? formatDate(task.dueDate) : t('board.taskModal.dueDateLabel')}
                    </span>
                    {task.dueDate && taskDueChip(task).tone === 'danger' && (
                      <span style={{ display: 'block', marginTop: 4 }}>
                        <span className={`task-due task-due-${taskDueChip(task).tone}`}>{taskDueChip(task).label}</span>
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
                    onApply={(s, e) => { update({ startDate: s, dueDate: e }); setHotProp(null); }}
                    onClose={() => setHotProp(null)}
                  />
                )}
              />



              {dateWarn && <InlineError>{dateWarn}</InlineError>}

              {/* Tags */}
              <div
                className="prop"
                data-prop="labels"
                data-hot={labelsOpen || undefined}
                ref={labelsRowRef}
              >
                <span className="prop-label">{t('board.taskModal.labelsLabel')}</span>
                {canEdit ? (
                  <button
                    type="button"
                    className="prop-view"
                    onClick={() => (labelsOpen ? commitLabels() : openLabels())}
                  >
                    {task.labels.length > 0 ? (
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {task.labels.map((l) => <span key={l} style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 11, color: 'var(--text-secondary)' }}>{l}</span>)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                    )}
                  </button>
                ) : task.labels.length > 0 ? (
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {task.labels.map((l) => <span key={l} style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 11, color: 'var(--text-secondary)' }}>{l}</span>)}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                )}
                {canEdit && <span className="prop-chev" aria-hidden="true">›</span>}
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
                  <input
                    autoFocus
                    className="input"
                    placeholder={t('board.taskModal.labelsPlaceholder')}
                    value={labelsDraft}
                    maxLength={FE_LIMITS.LABELS_INPUT}
                    onChange={(e) => setLabelsDraft(e.target.value)}
                    onBlur={commitLabels}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitLabels(); }}
                    aria-label={t('board.taskModal.labelsLabel')}
                  />
                </div>,
                document.body,
              )}

              {/* Assignees */}
              <PropRow
                propKey="assignee"
                label={t('board.taskModal.assigneeLabel')}
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
                  <SearchableSelect defaultOpen id="task-assignee-inline" label="" ariaLabel={t('board.taskModal.assigneeLabel')} value={task.assigneeId ?? null} options={members.map((m) => { const n = m.displayName || m.email; return { value: m.id, label: n, icon: <Avatar src={m.avatarUrl ?? null} name={n} email={m.email} id={m.id} size={20} alt="" /> }; })} onChange={(v) => { update({ assigneeId: v }); setHotProp(null); }} triggerEmptyLabel={t('board.taskModal.assigneeLabel')} />
                )}
              />

              {/* Milestone */}
              <PropRow
                propKey="milestone"
                label={t('board.taskModal.milestoneLabel')}
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
                <span className="prop-label">{t('board.taskModal.estimateLabel')}</span>
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
                {canEdit && <span className="prop-chev" aria-hidden="true">›</span>}
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
                    autoFocus
                    className="input"
                    type="number"
                    min={0}
                    max={FE_LIMITS.ESTIMATE_MAX}
                    value={task.estimate ?? ''}
                    aria-label={t('board.taskModal.estimateLabel')}
                    placeholder={t('board.taskModal.estimateLabel')}
                    inputMode="numeric"
                    onChange={(e) => { const v = sanitizeIntegerInput(e.target.value); const n = Number(v); update({ estimate: v === '' ? undefined : Math.min(FE_LIMITS.ESTIMATE_MAX, Math.max(0, n)) }); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setEstimateOpen(false);
                      else if (!isDigitKey(e.key)) e.preventDefault();
                    }}
                  />
                </div>,
                document.body,
              )}
              <PropRow
                propKey="actual"
                label={t('board.taskModal.actualLabel')}
                hot={false}
                setHot={setHotProp}
                canEdit={false}
                view={(
                  <span style={{ fontSize: 13, color: task.actualHours != null ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {task.actualHours != null ? `${task.actualHours}h` : '—'}
                  </span>
                )}
                control={<span />}
              />
              <div
                data-blocked-row
                data-prop="blockedBy"
                data-hot={(hotProp === 'blockedBy' || pickingBlocker) || undefined}
                className="prop"
                style={{ fontSize: 13 }}
                onMouseEnter={() => { if (canEdit && !pickingBlocker) setHotProp('blockedBy'); }}
                onMouseLeave={(e) => { if (!e.currentTarget.contains(document.activeElement) && !document.querySelector('.ss-panel')) { setHotProp(null); setPickingBlocker(false); } }}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !document.querySelector('.ss-panel')) { setHotProp(null); setPickingBlocker(false); } }}
                onKeyDown={(e) => { if (e.key === 'Escape') { setHotProp(null); setPickingBlocker(false); } }}
              >
                <span className="prop-label">Blocked by</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 0, alignItems: 'center', order: 2, flexBasis: '100%' }}>
                  {canEdit && (hotProp === 'blockedBy' || pickingBlocker) ? (
                    <>
                      {blockedTasks.map((bt) => blockerChip(bt, true))}
                      {pickingBlocker ? (
                        <SearchableSelect defaultOpen id="blockedBy-picker" label="" value={null} options={otherTasks.filter(ot => !task.blockedBy.includes(ot.id)).map(ot => ({ value: ot.id, label: ot.title }))} onChange={(v) => { if (v) { toggleBlocker(v); setPickingBlocker(false); } }} />
                      ) : (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPickingBlocker(true)}>+ Add</button>
                      )}
                    </>
                  ) : canEdit ? (
                    <button type="button" className="prop-view" onClick={() => setHotProp('blockedBy')}>
                      {blockedTasks.length > 0 ? blockedTasks.map((bt) => blockerChip(bt, false)) : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                    </button>
                  ) : (
                    <>{blockedTasks.length > 0 ? blockedTasks.map((bt) => blockerChip(bt, false)) : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}</>
                  )}
                </div>
                {canEdit && <span className="prop-chev" aria-hidden="true">›</span>}
              </div>
              {cycleWarn && <InlineError>{cycleWarn}</InlineError>}
              <PropRow
                propKey="testCases"
                label={t('board.taskModal.testCasesLabel')}
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
              <textarea
                ref={titleRef}
                className="composer-title"
                rows={1}
                value={task.title}
                autoFocus
                maxLength={LIMITS.TASK_TITLE}
                onChange={(e) => update({ title: e.target.value })}
                aria-label={t('board.taskModal.titleLabel')}
                placeholder={t('board.taskModal.untitled')}
              />
            ) : (
              <h3
                className="detail-title"
                style={{ padding: '4px 6px', margin: '-4px -6px' }}
              >
                {task.title || <DetailEmpty>Untitled task</DetailEmpty>}
              </h3>
            )}
            <div className="detail-created" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
              <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Clock size={12} aria-hidden="true" /> {t('issues.modal.createdTimeLabel')}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{formatDate(task.createdAt)} {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <MarkdownField
              label={t('board.taskModal.descriptionLabel')}
              icon={FileText}
              value={task.description}
              onChange={(v) => update({ description: v })}
              placeholder={t('board.newTaskModal.descriptionLabel')}
              maxLength={10000}
              rows={4}
              variant="bare"
              previewToggle
            />
            {doneWarn && <InlineError>{doneWarn}</InlineError>}

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