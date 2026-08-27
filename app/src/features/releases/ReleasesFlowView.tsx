import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { MILESTONE_STATUS, TASK_PRIORITY, TASK_STATUS } from '../../lib/labels';
import type { Decision, Milestone, SchemaVersion, Task, TechEntry } from '../../lib/types';
import { formatDate, formatRelative, shortId } from '../../lib/utils';
import { taskDueChip } from '../../lib/due-dates';
import { avatarColor, initialsOf } from '../../lib/avatar';
import { computeDag } from '../../lib/dag';
import { computeReadiness } from '../../lib/readiness';
import { CalendarBlank, CheckCircle, WarningCircle, XCircle, Rocket, Plus, ArrowRight } from '@phosphor-icons/react';

interface ReleasesFlowViewProps {
  milestones: Milestone[];
  tasks: Task[];
  issues: import('../../lib/types').Issue[];
  testCases: import('../../lib/types').TestCase[];
  decisions: Decision[];
  schemaVersions: SchemaVersion[];
  techEntries: TechEntry[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEditMilestone: (id: string) => void;
  onNewMilestone: () => void;
  onOpenTask: (id: string) => void;
  canEdit: boolean;
}

function Hero({
  milestone,
  tasks,
  issues,
  testCases,
  canEdit,
  onEdit,
}: {
  milestone: Milestone;
  tasks: Task[];
  issues: import('../../lib/types').Issue[];
  testCases: import('../../lib/types').TestCase[];
  canEdit: boolean;
  onEdit: () => void;
}) {
  // hero uses readiness
  const { t } = useTranslation('project');
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const readiness = computeReadiness(milestone, tasks, issues, testCases);
  const gatedReady = readiness.ready;

  return (
    <div className="release-flow-hero">
      <div className="release-flow-hero-top">
        <div className="release-flow-hero-main">
          <div className="data-row-title">
            <Badge tone={MILESTONE_STATUS[milestone.status].tone}>{t(`releases.statusBadge.${milestone.status}`)}</Badge>
            <span className="row-title-text" style={{ fontSize: 15, fontWeight: 600 }}>
              {milestone.name}
            </span>
            {milestone.version && <span className="data-row-meta font-mono">v{milestone.version.replace(/^v/i, '')}</span>}
          </div>
          <div className="data-row-meta" style={{ marginTop: 6 }}>
            <span>
              <CalendarBlank size={12} aria-hidden="true" /> {milestone.targetDate ? formatDate(milestone.targetDate) : t('releases.noTargetDate')}
            </span>
            <span>#{shortId(milestone.id)}</span>
            <span>{t('releases.modal.updated', { time: formatRelative(milestone.updatedAt) })}</span>
          </div>
          {milestone.changelog && <div className="data-row-sub" style={{ marginTop: 8 }}>{milestone.changelog}</div>}
        </div>
        <div className="release-flow-hero-side">
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={onEdit}>
              {t('releases.editAria')}
            </Button>
          )}
        </div>
      </div>

      <div className="release-flow-progress">
        <div className="milestone-progress release-flow-progress-track">
          <div className="milestone-progress-track" style={{ height: 8, flex: 1 }}>
            <div className="milestone-progress-fill" style={{ width: `${progress}%`, height: 8 }} />
          </div>
          <span className="tabular" style={{ marginLeft: 8 }}>
            {t('releases.progressDone', { done, total })} · {progress}%
          </span>
        </div>
        <div className="release-flow-gated">
          <span className={`badge ${gatedReady ? 'badge-success' : 'badge-warn'}`} style={{ fontSize: 11 }}>
            {gatedReady ? t('releases.flow.ready', { defaultValue: 'Ready to release' }) : t('releases.flow.notReady', { defaultValue: 'Not ready' })} · {readiness.passCount}/{readiness.total}
          </span>
        </div>
      </div>
    </div>
  );
}

function ReadinessChecklist({
  milestone,
  tasks,
  issues,
  testCases,
}: {
  milestone: Milestone;
  tasks: Task[];
  issues: import('../../lib/types').Issue[];
  testCases: import('../../lib/types').TestCase[];
}) {
  const { t } = useTranslation('project');
  const readiness = useMemo(() => computeReadiness(milestone, tasks, issues, testCases), [milestone, tasks, issues, testCases]);

  return (
    <div className="release-flow-checklist">
      <div className="release-flow-checklist-header">
        <span className="detail-subtitle" style={{ margin: 0 }}>
          {t('releases.flow.checklistTitle', { defaultValue: 'Readiness Checklist' })}
        </span>
        <Badge tone={readiness.ready ? 'success' : readiness.hasWarn ? 'warn' : 'danger'} dot>
          {readiness.passCount}/{readiness.total}
        </Badge>
      </div>
      <div className="release-flow-checklist-grid">
        {readiness.checks.map((c) => {
          const Icon = c.tone === 'success' ? CheckCircle : c.tone === 'danger' ? XCircle : WarningCircle;
          const toneClass = c.tone === 'success' ? 'var(--status-success)' : c.tone === 'danger' ? 'var(--status-danger)' : c.tone === 'warn' ? 'var(--status-warn)' : 'var(--text-muted)';
          return (
            <div key={c.id} className={`release-flow-check ${c.pass ? 'check-pass' : 'check-fail'}`}>
              <Icon size={14} weight="fill" style={{ color: toneClass }} aria-hidden="true" />
              <span className="release-flow-check-label">{c.label}</span>
              <span className="release-flow-check-detail tabular">{c.detail}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DagTaskCard({
  task,
  state,
  blockedBy,
  externalBlocked,
  onOpen,
  unread,
}: {
  task: Task;
  state: 'ready' | 'blocked' | 'done';
  blockedBy: Task[];
  externalBlocked?: string[];
  onOpen: (id: string) => void;
  unread?: boolean;
}) {
  const { t } = useTranslation('tracker');
  const due = taskDueChip(task);
  const tone = state === 'done' ? 'success' : state === 'ready' ? 'info' : 'danger';
  const stateLabel =
    state === 'done'
      ? t('releases.taskStatus.done')
      : state === 'ready'
        ? (t('releases.flow.stateReady', { defaultValue: 'Ready' }) as string)
        : (t('releases.flow.stateBlocked', { defaultValue: 'Blocked' }) as string);

  return (
    <div className={`dag-card dag-card--${state} ${task.pinned ? 'card-pinned' : ''}`}>
      <button type="button" className="dag-card-main" onClick={() => onOpen(task.id)} aria-label={`${task.title} — ${stateLabel}`}>
        <div className="dag-card-top">
          <Badge tone={TASK_PRIORITY[task.priority].tone} dot>
            {TASK_PRIORITY[task.priority].label}
          </Badge>
          <Badge tone={tone as never} dot>
            {stateLabel}
          </Badge>
          <span className="font-mono tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            #{shortId(task.id)}
          </span>
          {unread && <span className="unread-pill">New</span>}
        </div>
        <div className="dag-card-title" title={task.title}>
          {task.title || 'Untitled task'}
        </div>
        <div className="dag-card-meta">
          {due.label && <span className={`task-due task-due-${due.tone}`}>{due.label}</span>}
          {task.assigneeId && (
            <span className="task-avatar" title={task.assigneeId}>
              <span className="task-assignee-avatar" style={{ backgroundColor: avatarColor(task.assigneeId), width: 18, height: 18, fontSize: 9 }}>
                {initialsOf(task.assigneeId.slice(0, 2))}
              </span>
            </span>
          )}
          <Badge tone={TASK_STATUS[task.status].tone} dot>
            {TASK_STATUS[task.status].label}
          </Badge>
        </div>
        {(blockedBy.length > 0 || (externalBlocked && externalBlocked.length > 0)) && (
          <div className="dag-card-blocked">
            <span className="field-helper" style={{ fontSize: 11 }}>
              {t('releases.flow.blockedBy', { defaultValue: 'Blocked by:' })} {blockedBy.map((b) => b.title).join(', ')}
              {externalBlocked && externalBlocked.length > 0 ? ` + ${externalBlocked.length} external` : ''}
            </span>
          </div>
        )}
      </button>
    </div>
  );
}

export function ReleasesFlowView({
  milestones,
  tasks,
  issues,
  testCases,
  decisions,
  schemaVersions,
  techEntries,
  selectedId,
  onSelect,
  onEditMilestone,
  onNewMilestone,
  onOpenTask,
  canEdit,
}: ReleasesFlowViewProps) {
  const { t } = useTranslation('project');
  const [contextOpen, setContextOpen] = useState(true);

  // Use full state for issues/testCases via context? We'll need to get from useProject instead
  // For simplicity, compute with empty arrays if not provided via props; caller should pass full
  // We'll fallback to empty via optional prop widening

  const selected = useMemo(() => {
    if (selectedId) return milestones.find((m) => m.id === selectedId) ?? null;
    return null;
  }, [milestones, selectedId]);

  if (milestones.length === 0) {
    return (
      <EmptyState
        icon={<Rocket size={22} />}
        title={t('releases.emptyTitle')}
        description={t('releases.flow.emptyDescFlow', { defaultValue: 'No releases yet. Create a milestone with status In Progress to see the step-by-step flow.' })}
        action={
          canEdit && (
            <Button size="sm" onClick={onNewMilestone}>
              <Plus size={14} /> {t('releases.newMilestone')}
            </Button>
          )
        }
      />
    );
  }

  if (!selected) {
    return (
      <div className="release-flow-invalid">
        <InlineError>
          {t('releases.flow.invalidMilestone', { defaultValue: 'Selected milestone not found. Choose one below.' })}
        </InlineError>
        <div className="release-flow-selector">
          {milestones.map((m) => (
            <Button key={m.id} size="sm" variant="ghost" onClick={() => onSelect(m.id)}>
              {m.name} {m.version ? `v${m.version}` : ''} — {t(`releases.statusBadge.${m.status}`)}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const flowTasks = useMemo(() => tasks.filter((t) => t.milestoneId === selected.id), [tasks, selected.id]);

  const dag = useMemo(() => computeDag(flowTasks), [flowTasks]);
  const doneTasks = useMemo(() => flowTasks.filter((t) => t.status === 'done'), [flowTasks]);

  return (
    <div className="release-flow">
      <div className="release-flow-selector-bar">
        <label className="field-label" htmlFor="flow-milestone-select" style={{ margin: 0 }}>
          {t('releases.flow.selectMilestone', { defaultValue: 'Milestone' })}
        </label>
        <select
          id="flow-milestone-select"
          className="select"
          value={selected.id}
          onChange={(e) => onSelect(e.target.value)}
          style={{ maxWidth: 360 }}
        >
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.version ? `· v${m.version.replace(/^v/i, '')}` : ''} · {t(`releases.statusBadge.${m.status}`)}
            </option>
          ))}
        </select>
      </div>

      <Hero milestone={selected} tasks={flowTasks} issues={issues} testCases={testCases} canEdit={canEdit} onEdit={() => onEditMilestone(selected.id)} />

      <ReadinessChecklist milestone={selected} tasks={flowTasks} issues={issues} testCases={testCases} />

      {dag.hasCycle && (
        <InlineError>
          {t('releases.flow.cycleDetected', { defaultValue: 'Cycle detected in blockedBy chain — showing fallback order.' })} {dag.cyclePath.join(' → ')}
        </InlineError>
      )}

      {dag.allBlocked && flowTasks.length > 0 && (
        <div className="release-flow-banner release-flow-banner--danger" role="status">
          <WarningCircle size={16} weight="fill" />
          <span>{t('releases.flow.allBlocked', { defaultValue: 'All tasks are blocked. Start with the tasks that block the most others.' })}</span>
        </div>
      )}

      {flowTasks.length === 0 ? (
        <div className="release-flow-empty">
          <p className="field-helper">{t('releases.modal.noTasksAssigned')}</p>
          {canEdit && (
            <Button size="sm" onClick={() => onOpenTask('NEW')}>
              <Plus size={14} /> {t('releases.flow.addTask', { defaultValue: 'Add task to this release' })}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="dag-layers" role="list" aria-label={t('releases.flow.dagAria', { defaultValue: 'Execution flow' })}>
            {dag.layers.map((layer, idx) => {
              const isReadyLayer = idx === 0 && layer.some((t) => dag.dagState.get(t.id) === 'ready');
              return (
                <div
                  key={idx}
                  className={`dag-layer ${isReadyLayer ? 'dag-layer--ready' : ''}`}
                  role="listitem"
                  aria-label={`Layer ${idx + 1} — ${layer.length} tasks`}
                >
                  <div className="dag-layer-header">
                    <span className="dag-layer-title">
                      {idx === 0
                        ? t('releases.flow.layerReady', { defaultValue: 'Ready Now' })
                        : t('releases.flow.layerBlocked', { defaultValue: `Blocked — Layer ${idx + 1}`, idx: idx + 1 })}
                    </span>
                    <span className="tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {layer.length}
                    </span>
                  </div>
                  <div className="dag-layer-grid">
                    {layer.map((task) => {
                      const state = dag.dagState.get(task.id) ?? 'blocked';
                      const blockedBy = (task.blockedBy ?? [])
                        .map((id) => flowTasks.find((t) => t.id === id))
                        .filter((x): x is Task => !!x);
                      const external = dag.externalBlocked.get(task.id);
                      return (
                        <DagTaskCard
                          key={task.id}
                          task={task}
                          state={state}
                          blockedBy={blockedBy}
                          externalBlocked={external}
                          onOpen={onOpenTask}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {doneTasks.length > 0 && (
            <details className="dag-done">
              <summary className="dag-done-summary">
                {t('releases.flow.doneSection', { defaultValue: 'Done' })} · {doneTasks.length}
              </summary>
              <div className="dag-layer-grid" style={{ marginTop: 8 }}>
                {doneTasks.map((task) => (
                  <DagTaskCard key={task.id} task={task} state="done" blockedBy={[]} onOpen={onOpenTask} />
                ))}
              </div>
            </details>
          )}

          <div className="release-flow-context">
            <button
              type="button"
              className="release-flow-context-toggle"
              aria-expanded={contextOpen}
              onClick={() => setContextOpen((v) => !v)}
            >
              <span>{t('releases.flow.technicalContext', { defaultValue: 'Technical Context' })}</span>
              <ArrowRight size={12} style={{ transform: contextOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 120ms' }} aria-hidden="true" />
            </button>
            {contextOpen && (
              <div className="release-flow-context-body">
                <div className="release-flow-context-section">
                  <h4 className="field-label">{t('releases.flow.decisions', { defaultValue: 'Decisions' })} · {decisions.length}</h4>
                  {decisions.length === 0 ? (
                    <span className="field-helper">{t('decisions.emptyTitle')}</span>
                  ) : (
                    <ul className="release-flow-context-list">
                      {decisions.slice(0, 5).map((d) => (
                        <li key={d.id} className="release-flow-context-item">
                          <span className="row-title-text" style={{ fontSize: 13 }}>{d.title}</span>
                          <Badge tone={d.status === 'accepted' ? 'success' : d.status === 'rejected' ? 'danger' : 'neutral'}>{d.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="release-flow-context-section">
                  <h4 className="field-label">{t('releases.flow.schema', { defaultValue: 'Schema Versions' })} · {schemaVersions.length}</h4>
                  {schemaVersions.length === 0 ? (
                    <span className="field-helper">{t('schema.empty.versionsDesc')}</span>
                  ) : (
                    <ul className="release-flow-context-list">
                      {schemaVersions.slice(0, 3).map((s) => (
                        <li key={s.id} className="release-flow-context-item">
                          <span className="font-mono tabular" style={{ fontSize: 12 }}>v{s.version}</span>
                          <span className="field-helper">{formatDate(s.appliedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="release-flow-context-section">
                  <h4 className="field-label">{t('releases.flow.stack', { defaultValue: 'Stack' })} · {techEntries.length}</h4>
                  {techEntries.length === 0 ? (
                    <span className="field-helper">{t('stack.emptyDesc')}</span>
                  ) : (
                    <ul className="release-flow-context-list">
                      {techEntries.slice(0, 5).map((e) => (
                        <li key={e.id} className="release-flow-context-item">
                          <span style={{ fontSize: 13 }}>{e.name} v{e.version}</span>
                          <Badge tone={e.status === 'current' ? 'success' : e.status === 'majorUpgrade' ? 'danger' : 'warn'}>{e.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
