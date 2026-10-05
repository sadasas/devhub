import { useEffect, useRef, useState } from 'react';
import {
  CalendarBlank,
  CaretDown,
  Flag,
  Plus,
  User,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TASK_PRIORITY, TASK_PRIORITY_ORDER, TASK_STATUS } from '../lib/labels';
import { TaskPriorityIcon, TaskStatusIcon } from '../lib/task-icons';
import type { Task, TaskPriority, TeamMember } from '../lib/types';
import { formatDate, newId } from '../lib/utils';
import { taskDueChip } from '../lib/due-dates';
import { subRangeOutsideParent } from '../lib/start-dates';
import { useProject } from '../state/project-context';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { ComposerTextarea } from './ComposerTextarea';
import { DatePicker } from './DatePicker';
import { InlineError } from './InlineError';
import { SearchableSelect } from './SearchableSelect';
import { TaskStatusBadge } from './TaskStatusBadge';
import { Tooltip } from './Tooltip';

const AUTO_FOCUS_INPUT =
  typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

interface SubtaskSectionProps {
  /** Task parent (sumber warisan priority/milestone + batas rentang tanggal). */
  task: Task;
  canEdit: boolean;
  /** Tampilkan tombol tambah (Focus: canEdit && judul tak kosong; modal: canEdit). */
  allowAdd: boolean;
  members: TeamMember[];
  userId?: string | null;
  onNavigate?: (taskId: string) => void;
  /** Status buka composer dikendalikan parent (eksklusif vs checklist). */
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

/**
 * SubtaskSection — daftar subtask + composer inline + "Make subtask of…".
 * Satu komponen dipakai FocusTaskDetail + TaskDetail (modal): baris mini
 * (checkbox 14, judul, tanggal + chip danger, badge status — tanpa assignee),
 * composer transparan icon-only, tombol + hanya saat draft terisi, toggle
 * eksklusif via [data-composer-toggle], outside-close bubble yang
 * mengecualikan panel portal .ss-panel/.dp-panel.
 */
export function SubtaskSection({ task, canEdit, allowAdd, members, userId, onNavigate, open, onOpen, onClose }: SubtaskSectionProps) {
  const { t } = useTranslation('tracker');
  const { state, dispatch } = useProject();
  const [subDraft, setSubDraft] = useState('');
  const [subAssignee, setSubAssignee] = useState<string | null>(null);
  const [subPriority, setSubPriority] = useState<TaskPriority | null>(null);
  const [subStart, setSubStart] = useState<string | null>(null);
  const [subDue, setSubDue] = useState<string | null>(null);
  const [subRangeErr, setSubRangeErr] = useState<string | null>(null);
  const [subDatesOpen, setSubDatesOpen] = useState(false);
  const [parentPicking, setParentPicking] = useState(false);
  const subCardRef = useRef<HTMLDivElement>(null);
  const subDatesTriggerRef = useRef<HTMLButtonElement>(null);
  const parentBtnRef = useRef<HTMLButtonElement>(null);

  // Klik di luar kartu composer menutup + reset total (panel portal
  // .ss-panel/.dp-panel dikecualikan agar pilih assignee/tanggal tak menutup).
  // Sengaja memakai 'click' (bubble) bukan 'pointerdown': handler klik target
  // jalan DULU baru outside-close. Klik pada tombol pembuka
  // ([data-composer-toggle]) diabaikan: listener terpasang mid-dispatch dan
  // event pembuka masih mencapai document.
  useEffect(() => {
    if (!open) return;
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
      onClose();
    };
    document.addEventListener('click', onDown);
    return () => document.removeEventListener('click', onDown);
  }, [open, onClose]);

  if (!state) return null;

  const resetAll = () => {
    setSubDraft('');
    setSubAssignee(null);
    setSubPriority(null);
    setSubStart(null);
    setSubDue(null);
    setSubRangeErr(null);
    setSubDatesOpen(false);
    onClose();
  };

  const subtasks = state.tasks.filter((tt) => tt.parentTaskId === task.id);
  const subDone = subtasks.filter((tt) => tt.status === 'done').length;
  const parentOptions = state.tasks.filter(
    (tt) => tt.id !== task.id && !tt.parentTaskId && subtasks.every((ss) => ss.id !== tt.id),
  );

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
    // Chain ala Asana/Linear: judul dikosongkan, assignee+tanggal dipertahankan.
    setSubDraft('');
    return true;
  };

  return (
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
          subtasks.length > 0 ? (
            <Tooltip
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
        {allowAdd &&
          (open ? (
            <div ref={subCardRef} style={{ marginTop: 4 }}>
              <ComposerTextarea
                autoFocus={AUTO_FOCUS_INPUT}
                value={subDraft}
                onChange={setSubDraft}
                onSubmit={() => { addSubtask(); }}
                onCancel={resetAll}
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
                      ...(userId
                        ? (() => {
                            const me = members.find((m) => m.id === userId);
                            const n =
                              me?.displayName ||
                              me?.email ||
                              t('board.taskModal.assignToMe', {
                                defaultValue: 'Assign to me',
                              });
                            return [
                              {
                                value: userId,
                                label: t('board.taskModal.assignToMe', {
                                  defaultValue: 'Assign to me',
                                }),
                                icon: (
                                  <Avatar
                                    src={me?.avatarUrl ?? null}
                                    name={n}
                                    email={me?.email}
                                    id={userId}
                                    size={20}
                                    alt=""
                                  />
                                ),
                              },
                            ];
                          })()
                        : []),
                      ...members
                        .filter((m) => m.id !== userId)
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
              onClick={onOpen}
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
              dispatch({ type: 'task/update', id: task.id, patch: { parentTaskId: v } });
              setParentPicking(false);
              parentBtnRef.current?.focus();
            }}
            triggerEmptyLabel={t('board.taskModal.setParent', {
              defaultValue: 'Make subtask of…',
            })}
          />
      )}
    </div>
  );
}
