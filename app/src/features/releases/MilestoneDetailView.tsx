import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { InlineError } from "../../components/InlineError";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { MILESTONE_STATUS, TASK_PRIORITY, TASK_STATUS } from "../../lib/labels";
import type { Decision, Milestone, SchemaVersion, Task, TechEntry, Issue, TestCase } from "../../lib/types";
import { formatDate, formatRelative, shortId } from "../../lib/utils";
import { taskDueChip } from "../../lib/due-dates";
import { avatarColor, initialsOf } from "../../lib/avatar";
import { computeDag } from "../../lib/dag";
import { computeReadiness } from "../../lib/readiness";
import { useProject } from "../../state/project-context";
import { MarkdownBlocks } from "../../lib/markdown";
import { ArrowLeft, CalendarBlank, CheckCircle, WarningCircle, XCircle, Trash, CaretRight } from "@phosphor-icons/react";
import { DecisionModal } from "../decisions/DecisionModal";

interface Props {
  milestone: Milestone;
  tasks: Task[];
  issues: Issue[];
  testCases: TestCase[];
  decisions: Decision[];
  schemaVersions: SchemaVersion[];
  techEntries: TechEntry[];
  onBack: () => void;
  onEdit: () => void;
  onOpenTask: (id: string) => void;
  canEdit: boolean;
}

function DagCard({ task, state, blockedBy, external, onOpen }: { task: Task; state: "ready" | "blocked" | "done"; blockedBy: Task[]; external?: string[]; onOpen: (id: string) => void }) {
  const { t } = useTranslation("project");
  const due = taskDueChip(task);
  const tone = state === "done" ? "success" : state === "ready" ? "info" : "danger";
  const label = state === "done" ? t("releases.taskStatus.done") : state === "ready" ? t("releases.flow.stateReady", { defaultValue: "Ready" }) : t("releases.flow.stateBlocked", { defaultValue: "Blocked" });
  return (
    <div className={"dag-card dag-card--" + state + (task.pinned ? " card-pinned" : "")}>
      <button type="button" className="dag-card-main" onClick={() => onOpen(task.id)} aria-label={task.title + " - " + label}>
        <div className="dag-card-top">
          <Badge tone={TASK_PRIORITY[task.priority].tone} dot>{TASK_PRIORITY[task.priority].label}</Badge>
          {state !== "done" && <Badge tone={tone as any} dot>{label}</Badge>}
          <span className="font-mono tabular" style={{ fontSize: 11, color: "var(--text-muted)" }}>#{shortId(task.id)}</span>
        </div>
        <div className="dag-card-title" title={task.title}>{task.title || "Untitled task"}</div>
        <div className="dag-card-meta">
          {due.label && <span className={"task-due task-due-" + due.tone}>{due.label}</span>}
          {task.assigneeId && (
            <span className="task-avatar">
              <span className="task-assignee-avatar" style={{ backgroundColor: avatarColor(task.assigneeId), width: 18, height: 18, fontSize: 9 }}>{initialsOf(task.assigneeId.slice(0, 2))}</span>
            </span>
          )}
          <Badge tone={TASK_STATUS[task.status].tone} dot>{TASK_STATUS[task.status].label}</Badge>
        </div>
        {(blockedBy.length > 0 || (external && external.length > 0)) && (
          <div className="dag-card-blocked">
            <span className="field-helper" style={{ fontSize: 11 }}>{t("releases.flow.blockedBy", { defaultValue: "Blocked by:" })} {blockedBy.map((b) => b.title).join(", ")}{external && external.length > 0 ? " + " + external.length + " external" : ""}</span>
          </div>
        )}
      </button>
    </div>
  );
}

export function MilestoneDetailView({ milestone, tasks, issues, testCases, decisions, schemaVersions, techEntries, onBack, onEdit, onOpenTask, canEdit }: Props) {
  const { t } = useTranslation("project");
  const { dispatch } = useProject();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const flowTasks = useMemo(() => tasks.filter((t) => t.milestoneId === milestone.id), [tasks, milestone.id]);
  const linkedDecisions = useMemo(() => decisions.filter((d) => d.milestoneId === milestone.id), [decisions, milestone.id]);
  const linkedSchemas = useMemo(() => schemaVersions.filter((s) => s.milestoneId === milestone.id), [schemaVersions, milestone.id]);
  const readiness = useMemo(() => computeReadiness(milestone, flowTasks, issues, testCases), [milestone, flowTasks, issues, testCases]);
  const dag = useMemo(() => computeDag(flowTasks), [flowTasks]);
  const doneTasks = useMemo(() => flowTasks.filter((t) => t.status === "done"), [flowTasks]);
  const total = flowTasks.length;
  const done = doneTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const gatedReady = readiness.ready;

  const remove = () => {
    dispatch({ type: "milestone/remove", id: milestone.id });
    setConfirmOpen(false);
    onBack();
  };

  return (
    <div className="release-detail">
      <div className="release-detail-header">
        <Button variant="ghost" size="sm" onClick={onBack} leftIcon={<ArrowLeft size={13} />}>{t("releases.detail.back", { defaultValue: "Kembali ke Timeline" })}</Button>
        <span className="flex-1" />
        {canEdit && (
          <Button variant="danger" size="sm" leftIcon={<Trash size={13} aria-hidden="true" />} onClick={() => setConfirmOpen(true)}>
            {t("releases.modal.delete", { defaultValue: "Delete" })}
          </Button>
        )}
        {canEdit && <Button size="sm" variant="primary" onClick={onEdit}>{t("releases.editAria")}</Button>}
      </div>

      <div className="release-flow-hero">
        <div className="release-flow-hero-top">
          <div className="release-flow-hero-main">
            <div className="data-row-title">
              <Badge tone={MILESTONE_STATUS[milestone.status].tone}>{t("releases.statusBadge." + milestone.status)}</Badge>
              <span className="row-title-text" style={{ fontSize: 15, fontWeight: 600 }}>{milestone.name}</span>
              {milestone.version && <span className="data-row-meta font-mono">v{milestone.version.replace(/^v/i, "")}</span>}
            </div>
            <div className="data-row-meta" style={{ marginTop: 6 }}>
              <span><CalendarBlank size={12} aria-hidden="true" /> {milestone.targetDate ? formatDate(milestone.targetDate) : t("releases.noTargetDate")}</span>
              <span>#{shortId(milestone.id)}</span>
              <span>{t("releases.modal.updated", { time: formatRelative(milestone.updatedAt) })}</span>
            </div>
            {milestone.changelog.trim() ? <div className="md-blocks data-row-sub" style={{ marginTop: 8 }}><MarkdownBlocks text={milestone.changelog} /></div> : null}
          </div>
        </div>
        <div className="release-flow-progress">
          <div className="milestone-progress release-flow-progress-track">
            <div className="milestone-progress-track" style={{ height: 8, flex: 1 }}>
              <div className="milestone-progress-fill" style={{ width: progress + "%", height: 8 }} />
            </div>
            <span className="tabular" style={{ marginLeft: 8 }}>{t("releases.progressDone", { done, total })} · {progress}%</span>
          </div>
          <span className={"badge " + (gatedReady ? "badge-success" : "badge-warn")} style={{ fontSize: 11 }}>{gatedReady ? t("releases.flow.ready") : t("releases.flow.notReady")} · {readiness.passCount}/{readiness.total}</span>
        </div>
      </div>

      <div className="release-flow-checklist">
        <div className="release-flow-checklist-header">
          <span className="detail-subtitle" style={{ margin: 0 }}>{t("releases.flow.checklistTitle")}</span>
          <Badge tone={readiness.ready ? "success" : readiness.hasWarn ? "warn" : "danger"} dot>{readiness.passCount}/{readiness.total}</Badge>
        </div>
        <div className="release-flow-checklist-grid">
          {readiness.checks.map((c) => {
            const Icon = c.tone === "success" ? CheckCircle : c.tone === "danger" ? XCircle : WarningCircle;
            const color = c.tone === "success" ? "var(--status-success)" : c.tone === "danger" ? "var(--status-danger)" : c.tone === "warn" ? "var(--status-warn)" : "var(--text-muted)";
            return (
              <div key={c.id} className={"release-flow-check " + (c.pass ? "check-pass" : "check-fail")}>
                <Icon size={14} weight="fill" style={{ color }} aria-hidden="true" />
                <span className="release-flow-check-label">{c.label}</span>
                <span className="release-flow-check-detail tabular">{c.detail}</span>
              </div>
            );
          })}
        </div>
      </div>

      {dag.hasCycle && <InlineError>{t("releases.flow.cycleDetected")} {dag.cyclePath.join(" → ")}</InlineError>}
      {dag.allBlocked && total > 0 && (
        <div className="release-flow-banner release-flow-banner--danger" role="status">
          <WarningCircle size={16} weight="fill" /> <span>{t("releases.flow.allBlocked")}</span>
        </div>
      )}

      {total === 0 ? (
        <div className="release-flow-empty">
          <p className="field-helper">{t("releases.modal.noTasksAssigned")}</p>
        </div>
      ) : (
        <>
          <div className="dag-layers" role="list" aria-label={t("releases.flow.dagAria")}>
            {dag.layers.map((layer, idx) => {
              const isReady = idx === 0 && layer.some((tt) => dag.dagState.get(tt.id) === "ready");
              return (
                <div key={idx} className={"dag-layer " + (isReady ? "dag-layer--ready" : "")} role="listitem">
                  <div className="dag-layer-header">
                    <span className="dag-layer-title">{idx === 0 ? t("releases.flow.layerReady") : t("releases.flow.layerBlocked", { idx: idx + 1 })}</span>
                    <span className="tabular" style={{ fontSize: 11, color: "var(--text-muted)" }}>{layer.length}</span>
                  </div>
                  <div className="dag-layer-grid">
                    {layer.map((task) => {
                      const st = dag.dagState.get(task.id) ?? "blocked";
                      const blockedBy = (task.blockedBy ?? []).map((id) => flowTasks.find((x) => x.id === id)).filter((x): x is Task => !!x);
                      const ext = dag.externalBlocked.get(task.id);
                      return <DagCard key={task.id} task={task} state={st} blockedBy={blockedBy} external={ext} onOpen={onOpenTask} />;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {doneTasks.length > 0 && (
            <details className="dag-done">
              <summary className="dag-done-summary">{t("releases.flow.doneSection")} · {doneTasks.length}</summary>
              <div className="dag-layer-grid" style={{ marginTop: 8 }}>
                {doneTasks.map((tt) => <DagCard key={tt.id} task={tt} state="done" blockedBy={[]} onOpen={onOpenTask} />)}
              </div>
            </details>
          )}
          <div className="release-flow-context">
            <details open>
              <summary className="release-flow-context-toggle">{t("releases.flow.technicalContext")}</summary>
              <div className="release-flow-context-body">
                <div className="release-flow-context-section release-flow-context-section--wide">
                  <h4 className="field-label">{t("releases.flow.decisions")} · {linkedDecisions.length}</h4>
                  {linkedDecisions.length === 0 ? <span className="field-helper">{t("releases.flow.noLinkedDecisions", { defaultValue: "No decisions linked to this milestone. Link a decision in its edit form." })}</span> : (
                    <ul className="release-flow-context-list">
                      {linkedDecisions.slice(0,7).map((d) => (
                        <li key={d.id}>
                          <button type="button" className="context-decision-btn" onClick={() => setDecisionId(d.id)} aria-label={d.title}>
                            <span className="context-decision-title">{d.title}</span>
                            <span className="context-decision-meta">
                              <Badge tone={d.status === "accepted" ? "success" : d.status === "rejected" ? "danger" : "neutral"} dot>{d.status}</Badge>
                              <CaretRight size={12} aria-hidden="true" />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="release-flow-context-stack">
                  <div className="release-flow-context-section">
                    <h4 className="field-label">{t("releases.flow.schema")} · {linkedSchemas.length}</h4>
                    {linkedSchemas.length === 0 ? <span className="field-helper">{t("releases.flow.noLinkedSchemas", { defaultValue: "No schema linked to this milestone" })}</span> : <ul className="release-flow-context-list">{linkedSchemas.slice(0,3).map((s) => <li key={s.id} className="release-flow-context-item"><span className="font-mono tabular" style={{ fontSize: 12 }}>v{s.version}</span><span className="field-helper">{formatDate(s.appliedAt)}</span></li>)}</ul>}
                  </div>
                  <div className="release-flow-context-section">
                    <h4 className="field-label">{t("releases.flow.stack")} · {techEntries.length}</h4>
                    {techEntries.length === 0 ? <span className="field-helper">{t("stack.emptyDesc")}</span> : <ul className="release-flow-context-list">{techEntries.slice(0,5).map((e) => <li key={e.id} className="release-flow-context-item"><span style={{ fontSize: 13 }}>{e.name} v{e.version}</span><Badge tone={e.status === "current" ? "success" : e.status === "majorUpgrade" ? "danger" : "warn"}>{e.status}</Badge></li>)}</ul>}
                  </div>
                </div>
              </div>
            </details>
          </div>
        </>
      )}
      <ConfirmDeleteDialog open={confirmOpen} title={t("releases.modal.deleteConfirmTitle")} description={t("releases.modal.deleteConfirmBody")} onClose={() => setConfirmOpen(false)} onConfirm={remove} />
      {decisionId && <DecisionModal decisionId={decisionId} onClose={() => setDecisionId(null)} />}
    </div>
  );
}


