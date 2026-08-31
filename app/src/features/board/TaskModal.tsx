import { useEffect, useState } from 'react';
import { Trash, Flag, CalendarBlank as CalendarIcon, User, Clock, Tag, LinkSimple, ListChecks, FileText, ArrowsOutSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import {
  TASK_PRIORITY,
  TASK_PRIORITY_ORDER,
  TASK_STATUS,
} from '../../lib/labels';
import { formatDate, formatRelative, isTaskCompletable, linkedTestCases, parseLabels } from '../../lib/utils';
import { api } from '../../lib/api';
import { taskDueChip } from '../../lib/due-dates';
import { startAfterDue } from '../../lib/start-dates';
import type { Task, TaskPriority, TaskStatus, TeamMember } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject, wouldCreateCycle } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { ActivityList } from '../../components/ActivityList';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty } from '../../components/DetailList';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { MarkdownBlocks } from '../../lib/markdown';
import { FE_LIMITS, LIMITS } from '../../lib/limits';

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'inProgress', 'review', 'done'];

interface TaskModalProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskModal({ taskId, onClose }: TaskModalProps) {
  const { t } = useTranslation(['tracker','project']);
  const { state, dispatch, canEdit, projectId, teamId } = useProject();
  const [activeField, setActiveField] = useState<string | null>(null);
  const [cycleWarn, setCycleWarn] = useState<string | null>(null);
  const [doneWarn, setDoneWarn] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fullscreenField, setFullscreenField] = useState<string | null>(null);
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
    setActiveField(null);
    setCycleWarn(null);
    setDoneWarn(null);
    setConfirmOpen(false);
  }, [taskId]);

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
    <Modal
      open
      title={t('board.taskModal.viewTitle')}
      onClose={onClose}
      width="lg"
      footer={
        canEdit ? (
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash size={13} aria-hidden="true" />}
            onClick={() => setConfirmOpen(true)}
          >
            {t('board.taskModal.delete')}
          </Button>
        ) : undefined
      }
    >
      <div className="form-stack">
          <>
            {/* Title inline */}
            {activeField === 'title' && canEdit ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <input
                  className="input"
                  value={task.title}
                  autoFocus
                  maxLength={LIMITS.TASK_TITLE}
                  onChange={(e) => update({ title: e.target.value })}
                  onBlur={() => setActiveField(null)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setActiveField(null); if (e.key === 'Escape') setActiveField(null); }}
                />
                <span style={{ fontSize: 11, color: task.title.length > Math.floor(LIMITS.TASK_TITLE * 0.9) ? 'var(--status-danger)' : task.title.length > Math.floor(LIMITS.TASK_TITLE * 0.8) ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', alignSelf: 'flex-end' }}>{task.title.length.toLocaleString()} / {LIMITS.TASK_TITLE.toLocaleString()}</span>
              </div>
            ) : (
              <h3
                className="detail-title"
                onClick={() => canEdit && setActiveField('title')}
                style={{ cursor: canEdit ? 'text' : undefined, padding: '4px 6px', margin: '-4px -6px', borderRadius: 6 }}
                onMouseEnter={(e) => { if (canEdit) (e.currentTarget as HTMLElement).style.background = 'var(--bg-inset)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                title={canEdit ? 'Click to edit' : undefined}
              >
                {task.title || <DetailEmpty>Untitled task</DetailEmpty>}
              </h3>
            )}
            {/* Fintech clean - no pinned bar, no section icons per row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 0' }}>
              {/* Created time - like Fintech */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Clock size={12} aria-hidden="true" /> Created time
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{formatDate(task.createdAt)} {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {/* Status - dot + peach pill like In Research */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Flag size={12} aria-hidden="true" /> Status
                </span>
                {activeField === 'status' && canEdit ? (
                  <select className="select" style={{ width: 160 }} value={task.status} autoFocus onChange={(e) => { changeStatus(e.target.value as TaskStatus); setActiveField(null); }} onBlur={() => setActiveField(null)}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{TASK_STATUS[s].label}</option>)}
                  </select>
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('status')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: task.status === 'done' ? 'var(--status-success-dim)' : task.status === 'review' ? 'var(--status-warn-dim)' : task.status === 'inProgress' ? 'var(--status-info-dim)' : 'var(--bg-inset)', border: 'none', cursor: canEdit ? 'pointer' : 'default', fontSize: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: TASK_STATUS[task.status].tone === 'success' ? 'var(--status-success)' : TASK_STATUS[task.status].tone === 'warn' ? 'var(--status-warn)' : TASK_STATUS[task.status].tone === 'info' ? 'var(--status-info)' : 'var(--text-muted)', flexShrink: 0 }} />
                    {TASK_STATUS[task.status].label}
                  </button>
                )}
              </div>
              {doneWarn && <InlineError>{doneWarn}</InlineError>}

              {/* Priority - pill biru tipis */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Flag size={12} aria-hidden="true" /> Priority
                </span>
                {activeField === 'priority' && canEdit ? (
                  <select className="select" style={{ width: 160 }} value={task.priority} autoFocus onChange={(e) => { update({ priority: e.target.value as TaskPriority }); setActiveField(null); }} onBlur={() => setActiveField(null)}>
                    {TASK_PRIORITY_ORDER.map((p) => <option key={p} value={p}>{TASK_PRIORITY[p].label}</option>)}
                  </select>
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('priority')} style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--status-info-dim)', border: '1px solid rgba(123,164,217,0.15)', fontSize: 11, color: 'var(--status-info)', cursor: canEdit ? 'pointer' : 'default' }}>
                    {TASK_PRIORITY[task.priority].label}
                  </button>
                )}
              </div>

              {/* Dates - combined Start → Due */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <CalendarIcon size={12} aria-hidden="true" /> Dates
                </span>
                {activeField === 'dates' && canEdit ? (
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input className="input" type="date" style={{ width: 140 }} value={task.startDate?.slice(0, 10) ?? ''} onChange={(e) => update({ startDate: e.target.value === '' ? null : e.target.value })} />
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <input className="input" type="date" style={{ width: 140 }} value={task.dueDate?.slice(0, 10) ?? ''} onChange={(e) => update({ dueDate: e.target.value === '' ? null : e.target.value })} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveField(null)} disabled={!!dateWarn}>OK</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('dates')} style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', fontSize: 13, color: task.dueDate || task.startDate ? 'var(--text-secondary)' : 'var(--text-muted)', padding: '2px 6px', margin: '-2px -6px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {task.startDate || task.dueDate ? (
                      <>
                        {task.startDate ? formatDate(task.startDate) : '—'}
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        {task.dueDate ? formatDate(task.dueDate) : '—'}
                        {task.dueDate && <span className={`task-due task-due-${taskDueChip(task).tone}`} style={{ marginLeft: 6 }}>{taskDueChip(task).label}</span>}
                      </>
                    ) : '—'}
                  </button>
                )}
              </div>
              {dateWarn && <InlineError>{dateWarn}</InlineError>}



              {/* Tags - pill abu tipis */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Tag size={12} aria-hidden="true" /> Tags
                </span>
                                {activeField === 'labels' && canEdit ? (
                  <div style={{ flex: 1, maxWidth: 260, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input className="input" style={{ flex: 1 }} placeholder={t('board.taskModal.labelsPlaceholder')} value={task.labels.join(', ')} autoFocus maxLength={FE_LIMITS.LABELS_INPUT} onChange={(e) => update({ labels: parseLabels(e.target.value) })} onBlur={() => setActiveField(null)} onKeyDown={(e) => { if (e.key === 'Enter') setActiveField(null); }} />
                    <span style={{ fontSize: 11, color: task.labels.join(', ').length > Math.floor(FE_LIMITS.LABELS_INPUT * 0.9) ? 'var(--status-danger)' : task.labels.join(', ').length > Math.floor(FE_LIMITS.LABELS_INPUT * 0.8) ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', alignSelf: 'flex-end' }}>{task.labels.join(', ').length.toLocaleString()} / {FE_LIMITS.LABELS_INPUT.toLocaleString()}</span>
                  </div>
                ) : task.labels.length > 0 ? (
                  <button type="button" onClick={() => canEdit && setActiveField('labels')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', padding: 0 }}>
                    {task.labels.map((l) => <span key={l} style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 11, color: 'var(--text-secondary)' }}>{l}</span>)}
                  </button>
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('labels')} style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', color: 'var(--text-muted)', fontSize: 13 }}>—</button>
                )}
              </div>

              {/* Assignees - avatar overlap */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <User size={12} aria-hidden="true" /> Assignees
                </span>
                {activeField === 'assignee' && canEdit ? (
                  <SearchableSelect id="task-assignee-inline" label="" value={task.assigneeId ?? null} options={members.map((m) => ({ value: m.id, label: m.displayName || m.email }))} onChange={(v) => { update({ assigneeId: v }); setActiveField(null); }} />
                ) : task.assigneeId ? (
                  <button type="button" onClick={() => canEdit && setActiveField('assignee')} style={{ display: 'inline-flex', alignItems: 'center', gap: -6, background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default' }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-dim)', border: '2px solid var(--bg-overlay)', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 600, color: 'var(--accent)' }}>{(members.find(m=>m.id===task.assigneeId)?.displayName || members.find(m=>m.id===task.assigneeId)?.email || '?').slice(0,1).toUpperCase()}</span>
                    <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--text-secondary)' }}>{members.find(m=>m.id===task.assigneeId)?.displayName || members.find(m=>m.id===task.assigneeId)?.email}</span>
                  </button>
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('assignee')} style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', color: 'var(--text-muted)', fontSize: 13 }}>—</button>
                )}
              </div>

              {/* Description - card abu muda - disamakan dengan IssueModal */
              <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16, marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={12} aria-hidden="true" /> {t('board.taskModal.descriptionLabel')}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label={t('tracker:issues.modal.fullscreenAriaDescription')}
                    title={t('tracker:issues.modal.fullscreenAriaDescription')}
                    onClick={() => setFullscreenField('description')}
                  >
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </div>
                {activeField === 'description' && canEdit ? (
                  <>
                    <textarea
                      className="textarea"
                      value={task.description}
                      autoFocus
                      rows={4}
                      placeholder={t('board.newTaskModal.descriptionLabel')}
                      onChange={(e) => update({ description: e.target.value })}
                      onBlur={() => setActiveField(null)}
                      aria-label={t('board.taskModal.descriptionLabel')}
                      maxLength={10000}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: task.description.length > 9000 ? 'var(--status-danger)' : task.description.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {task.description.length.toLocaleString()} / {(10000).toLocaleString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div
                    onClick={() => canEdit && setActiveField('description')}
                    role={canEdit ? 'button' : undefined}
                    tabIndex={canEdit ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setActiveField('description');
                      }
                    }}
                    aria-label={canEdit ? 'Edit ' + t('board.taskModal.descriptionLabel') : undefined}
                    style={{
                      cursor: canEdit ? 'text' : undefined,
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: task.description.trim() ? 'var(--text-secondary)' : 'var(--text-muted)',
                      minHeight: 40,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {task.description.trim() ? (
                      <MarkdownBlocks text={task.description} />
                    ) : (
                      t('board.taskModal.noDescription')
                    )}
                  </div>
                )}
              </div>

              /* All details directly with icons - no View details collapse */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Tag size={12} aria-hidden="true" /> Milestone
                </span>
                {activeField === 'milestone' && canEdit ? (
                  <SearchableSelect id="task-milestone" label="" value={task.milestoneId} options={state!.milestones.map((m) => ({ value: m.id, label: m.name }))} onChange={(v) => { update({ milestoneId: v }); setActiveField(null); }} />
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('milestone')} style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', fontSize: 13, color: milestone ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {milestone ? milestone.name : '—'}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Clock size={12} aria-hidden="true" /> Estimate
                </span>
                {activeField === 'estimate' && canEdit ? (
                  <input className="input" type="number" min={0} max={FE_LIMITS.ESTIMATE_MAX} style={{ width: 100 }} value={task.estimate ?? ''} autoFocus onChange={(e) => { const v = e.target.value; const n = Number(v); update({ estimate: v === '' ? undefined : Math.min(FE_LIMITS.ESTIMATE_MAX, Math.max(0, n)) }); }} onBlur={() => setActiveField(null)} />
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('estimate')} style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {task.estimate != null ? `${task.estimate}h` : '—'} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· Actual: {task.actualHours != null ? `${task.actualHours}h` : '—'}</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <LinkSimple size={12} aria-hidden="true" /> Blocked by
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, alignItems: 'center' }}>
                  {blockedTasks.length > 0 ? blockedTasks.map((bt) => (
                    <span key={bt.id} style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <LinkSimple size={10} aria-hidden="true" /> {bt.title} {canEdit && <button onClick={() => toggleBlocker(bt.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>}
                    </span>
                  )) : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                  {canEdit && (activeField === 'blockedBy' ? (
                    <SearchableSelect id="blockedBy-picker" label="" value={null} options={otherTasks.filter(ot => !task.blockedBy.includes(ot.id)).map(ot => ({ value: ot.id, label: ot.title }))} onChange={(v) => { if (v) { toggleBlocker(v); setActiveField(null); } }} />
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveField('blockedBy')}>+ Add</button>
                  ))}
                </div>
              </div>
              {cycleWarn && <InlineError>{cycleWarn}</InlineError>}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <ListChecks size={12} aria-hidden="true" /> Test cases
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {testCases.length === 0 ? 'No linked' : `${testCases.length} linked`}
                </span>
              </div>
            </div>
            <h4 className="detail-subtitle">Activity</h4>
            <ActivityList projectId={projectId} entity="tasks" entityId={task.id} />
            <p className="field-helper">Updated {formatRelative(task.updatedAt)}</p>
          </>
        </div>
    </Modal>
    {fullscreenField === 'description' && (
        <Modal
          open
          title={`${t('board.taskModal.descriptionLabel')} — Fullscreen`}
          onClose={() => setFullscreenField(null)}
          width="lg"
          className="modal-fullscreen"
        >
          <div className="field">
            <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
                <textarea
                  className="textarea"
                  style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }}
                  value={task.description}
                  autoFocus={canEdit}
                  readOnly={!canEdit}
                  placeholder={t('board.newTaskModal.descriptionLabel')}
                  onChange={(e) => canEdit && update({ description: e.target.value })}
                  aria-label={t('board.taskModal.descriptionLabel')}
                  maxLength={10000}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {task.description.trim() ? (
                    <MarkdownBlocks text={task.description} />
                  ) : (
                    <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{canEdit ? t('tracker:issues.modal.fullscreenHelper') : t('tracker:issues.modal.fullscreenHelperReadOnly')}</p>
              <span style={{ fontSize: 11, color: task.description.length > 9000 ? 'var(--status-danger)' : task.description.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {task.description.length.toLocaleString()} / {(10000).toLocaleString()}
              </span>
            </div>
          </div>
        </Modal>
      )}
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