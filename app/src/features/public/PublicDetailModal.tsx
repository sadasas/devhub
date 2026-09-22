import { Bug, Clock, FileText, LinkSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { DetailShell } from '../../components/DetailShell';
import { DetailEmpty } from '../../components/DetailList';
import { PropRow } from '../../components/PropRow';
import { MarkdownBlocks } from '../../lib/markdown';
import {
  ISSUE_SEVERITY,
  ISSUE_STATUS,
  TASK_PRIORITY,
  TASK_STATUS,
  findLabelDef,
  labelChipStyleFor,
} from '../../lib/labels';
import { taskDueChip } from '../../lib/due-dates';
import { formatDate, formatRelative, linkedTestCases } from '../../lib/utils';
import type { Issue, State, Task } from '../../lib/types';

interface PublicTaskDetailModalProps {
  task: Task;
  state: State;
  onClose: () => void;
  onOpenTask?: (taskId: string) => void;
}

interface PublicIssueDetailModalProps {
  issue: Issue;
  state: State;
  onClose: () => void;
  onOpenTask?: (taskId: string) => void;
}

const noopHot = () => {};

/**
 * Modal detail task untuk halaman publik (/p/*).
 * Layout SAMA dengan TaskModal internal (DetailShell + sidebar PropRow +
 * detail-main), tapi read-only penuh: canEdit=false, tanpa dispatch,
 * tanpa fetch member/presence/activity.
 */
export function PublicTaskDetailModal({ task, state, onClose, onOpenTask }: PublicTaskDetailModalProps) {
  const { t } = useTranslation(['tracker', 'project']);
  const milestone = task.milestoneId
    ? state.milestones.find((m) => m.id === task.milestoneId)
    : undefined;
  const blockedTasks = [...new Set(task.blockedBy)]
    .map((id) => state.tasks.find((tk) => tk.id === id))
    .filter((tk): tk is Task => tk !== undefined);
  const testCases = linkedTestCases(task.id, state.testCases);

  return (
    <DetailShell
      title={t('board.taskModal.viewTitle')}
      onClose={onClose}
      sidebarHead={t('board.taskModal.propertiesLabel')}
      sidebar={(
        <>
          <PropRow
            propKey="status"
            label={t('board.taskModal.statusLabel')}
            hot={false}
            setHot={noopHot}
            canEdit={false}
            view={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 6, background: task.status === 'done' ? 'var(--status-success-dim)' : task.status === 'review' ? 'var(--status-warn-dim)' : task.status === 'inProgress' ? 'var(--status-info-dim)' : 'var(--bg-inset)', fontSize: 12 }}>
                {TASK_STATUS[task.status].label}
              </span>
            )}
            control={<span />}
          />
          <PropRow
            propKey="priority"
            label={t('board.newTaskModal.priorityLabel')}
            hot={false}
            setHot={noopHot}
            canEdit={false}
            view={(
              <span style={{ padding: '2px 8px', borderRadius: 6, background: task.priority === 'urgent' ? 'var(--status-danger-dim)' : task.priority === 'high' ? 'var(--status-warn-dim)' : task.priority === 'medium' ? 'var(--status-info-dim)' : 'var(--bg-inset)', fontSize: 11, color: task.priority === 'urgent' ? 'var(--status-danger)' : task.priority === 'high' ? 'var(--status-warn)' : task.priority === 'medium' ? 'var(--status-info)' : 'var(--text-secondary)' }}>
                {TASK_PRIORITY[task.priority].label}
              </span>
            )}
            control={<span />}
          />
          <PropRow
            propKey="dates"
            label={t('board.taskModal.dateLabel')}
            hot={false}
            setHot={noopHot}
            canEdit={false}
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
                    <span className={`task-due task-due-${taskDueChip(task).tone}`} title={taskDueChip(task).title}>{taskDueChip(task).label}</span>
                  </span>
                )}
                {task.status === 'done' && task.completedAt && (
                  <span style={{ display: 'block', color: 'var(--text-muted)', marginTop: 4 }}>· {t('board.taskModal.doneDateLabel')}: {formatDate(task.completedAt)}</span>
                )}
              </span>
            )}
            control={<span />}
          />
          <PropRow
            propKey="labels"
            label={t('board.taskModal.labelsLabel')}
            hot={false}
            setHot={noopHot}
            canEdit={false}
            view={task.labels.length > 0 ? (
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {task.labels.map((l, i) => {
                  const style = labelChipStyleFor(l, state.labelDefs);
                  const title = findLabelDef(l, state.labelDefs)?.description || l;
                  return <span key={`${l}-${i}`} title={title} style={{ padding: '2px 8px', borderRadius: 6, background: style.background, fontSize: 11, color: style.color }}>{l}</span>;
                })}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
            )}
            control={<span />}
          />
          <PropRow
            propKey="milestone"
            label={t('board.taskModal.milestoneLabel')}
            hot={false}
            setHot={noopHot}
            canEdit={false}
            view={(
              <span style={{ fontSize: 13, color: milestone ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {milestone ? milestone.name : '—'}
              </span>
            )}
            control={<span />}
          />
          <PropRow
            propKey="estimate"
            label={t('board.taskModal.estimateLabel')}
            hot={false}
            setHot={noopHot}
            canEdit={false}
            view={(
              <span style={{ fontSize: 13, color: task.estimate != null ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {task.estimate != null ? `${task.estimate}h` : '—'}
              </span>
            )}
            control={<span />}
          />
          <PropRow
            propKey="actual"
            label={t('board.taskModal.actualLabel')}
            hot={false}
            setHot={noopHot}
            canEdit={false}
            view={(
              <span style={{ fontSize: 13, color: task.actualHours != null ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {task.actualHours != null ? `${task.actualHours}h` : '—'}
              </span>
            )}
            control={<span />}
          />
          <div className="prop" data-prop="blockedBy" style={{ fontSize: 13 }}>
            <span className="prop-label">{t('board.taskModal.blockedByLabel')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 0, alignItems: 'center', order: 2, flexBasis: '100%' }}>
              {blockedTasks.length > 0 ? blockedTasks.map((bt) => (
                onOpenTask ? (
                  <button
                    key={bt.id}
                    type="button"
                    onClick={() => onOpenTask(bt.id)}
                    aria-label={bt.title}
                    style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: 'inherit', fontFamily: 'inherit' }}
                  >
                    <LinkSimple size={10} aria-hidden="true" /> {bt.title}
                  </button>
                ) : (
                  <span key={bt.id} style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <LinkSimple size={10} aria-hidden="true" /> {bt.title}
                  </span>
                )
              )) : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
            </div>
          </div>
          <PropRow
            propKey="testCases"
            label={t('board.taskModal.testCasesLabel')}
            hot={false}
            setHot={noopHot}
            canEdit={false}
            view={(
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {testCases.length === 0 ? '—' : `${testCases.length} linked`}
              </span>
            )}
            control={<span />}
          />
        </>
      )}
    >
      <h3 className="detail-title">
        {task.title || <DetailEmpty>{t('board.taskModal.untitled')}</DetailEmpty>}
      </h3>
      <div className="detail-created" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
        <span style={{ width: 110, color: 'var(--text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Clock size={12} aria-hidden="true" /> {t('issues.modal.createdTimeLabel')}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>{formatDate(task.createdAt)} {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div className="md-bare">
        <div className="md-bare-head">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FileText size={12} aria-hidden="true" /> {t('board.taskModal.descriptionLabel')}
          </span>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: task.description.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', overflowWrap: 'anywhere' }}>
          {task.description.trim() ? (
            <MarkdownBlocks text={task.description} />
          ) : (
            t('board.taskModal.noDescription')
          )}
        </div>
      </div>
      <p className="field-helper">{t('board.taskModal.updated', { time: formatRelative(task.updatedAt) })}</p>
    </DetailShell>
  );
}

/**
 * Modal detail issue untuk halaman publik (/p/*).
 * Layout SAMA dengan IssueModal internal (DetailShell + sidebar PropRow +
 * detail-main), tapi read-only penuh: tanpa dispatch, tanpa activity,
 * tanpa member list.
 */
export function PublicIssueDetailModal({ issue, state, onClose, onOpenTask }: PublicIssueDetailModalProps) {
  const { t } = useTranslation(['tracker', 'project']);
  const linkedTask = issue.linkedTaskId
    ? state.tasks.find((taskItem) => taskItem.id === issue.linkedTaskId)
    : undefined;

  return (
    <DetailShell
      title={t('issues.modal.viewTitle')}
      onClose={onClose}
      sidebarHead={t('board.taskModal.propertiesLabel')}
      sidebar={(
        <>
          <PropRow
            propKey="severity"
            label={t('issues.modal.severityLabel')}
            hot={false}
            setHot={noopHot}
            canEdit={false}
            view={(
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background:
                    issue.severity === 'critical'
                      ? 'var(--status-danger-dim)'
                      : issue.severity === 'high'
                        ? 'var(--status-warn-dim)'
                        : issue.severity === 'medium'
                          ? 'var(--status-info-dim)'
                          : 'var(--bg-inset)',
                  border: issue.severity === 'low' ? '1px solid var(--border-hairline)' : 'none',
                  fontSize: 12,
                  color:
                    issue.severity === 'critical'
                      ? 'var(--status-danger)'
                      : issue.severity === 'high'
                        ? 'var(--status-warn)'
                        : issue.severity === 'medium'
                          ? 'var(--status-info)'
                          : 'var(--text-secondary)',
                }}
              >
                {ISSUE_SEVERITY[issue.severity].label}
              </span>
            )}
            control={<span />}
          />
          <PropRow
            propKey="status"
            label={t('issues.modal.statusLabel')}
            hot={false}
            setHot={noopHot}
            canEdit={false}
            view={(
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background:
                    issue.status === 'resolved'
                      ? 'var(--status-success-dim)'
                      : issue.status === 'fixing'
                        ? 'var(--accent-dim)'
                        : issue.status === 'reproduced'
                          ? 'var(--status-warn-dim)'
                          : issue.status === 'open'
                            ? 'var(--status-info-dim)'
                            : 'var(--bg-inset)',
                  border: issue.status === 'wontfix' ? '1px solid var(--border-hairline)' : 'none',
                  fontSize: 12,
                  color:
                    issue.status === 'resolved'
                      ? 'var(--status-success)'
                      : issue.status === 'fixing'
                        ? 'var(--accent)'
                        : issue.status === 'reproduced'
                          ? 'var(--status-warn)'
                          : issue.status === 'open'
                            ? 'var(--status-info)'
                            : 'var(--text-secondary)',
                }}
              >
                {ISSUE_STATUS[issue.status].label}
              </span>
            )}
            control={<span />}
          />
          <PropRow
            propKey="linkedTask"
            label={t('issues.modal.linkedTaskLabel')}
            hot={false}
            setHot={noopHot}
            canEdit={false}
            view={linkedTask ? (
              onOpenTask && issue.linkedTaskId ? (
                <button
                  type="button"
                  onClick={() => onOpenTask(issue.linkedTaskId!)}
                  aria-label={linkedTask.title}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--text-secondary)', overflowWrap: 'anywhere', maxWidth: '100%', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                >
                  {linkedTask.title}
                </button>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflowWrap: 'anywhere', maxWidth: '100%' }}>
                  {linkedTask.title}
                </span>
              )
            ) : issue.linkedTaskId ? (
              <span style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                {t('issues.modal.taskDeleted')}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
            )}
            control={<span />}
          />
        </>
      )}
    >
      <h3 className="detail-title">
        {issue.title || <DetailEmpty>{t('issues.modal.untitledIssue')}</DetailEmpty>}
      </h3>
      <div className="detail-created" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
        <span style={{ width: 110, color: 'var(--text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Clock size={12} aria-hidden="true" /> {t('issues.modal.createdTimeLabel')}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {formatDate(issue.createdAt)}{' '}
          {new Date(issue.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="md-bare">
        <div className="md-bare-head">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FileText size={12} aria-hidden="true" /> {t('issues.modal.descriptionLabel')}
          </span>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: issue.description.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', overflowWrap: 'anywhere' }}>
          {issue.description.trim() ? (
            <MarkdownBlocks text={issue.description} />
          ) : (
            t('issues.modal.noDescription')
          )}
        </div>
      </div>
      <div className="md-bare">
        <div className="md-bare-head">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Bug size={12} aria-hidden="true" /> {t('issues.modal.reproductionStepsLabel')}
          </span>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: issue.reproduction.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', overflowWrap: 'anywhere' }}>
          {issue.reproduction.trim() ? (
            <MarkdownBlocks text={issue.reproduction} />
          ) : (
            t('issues.modal.noReproduction')
          )}
        </div>
      </div>
      <p className="field-helper">{t('issues.modal.updated', { time: formatRelative(issue.updatedAt) })}</p>
    </DetailShell>
  );
}
