import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { MILESTONE_STATUS } from "../../lib/labels";
import type { Milestone, Task } from "../../lib/types";
import { formatDate, shortId } from "../../lib/utils";
import { todayIso } from "../../lib/due-dates";
import { CalendarBlank, PencilSimple, Plus, Rocket } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

interface ReleasesListViewProps {
  milestones: Milestone[];
  tasks: Task[];
  unreadIds?: ReadonlySet<string>;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onNew: () => void;
}

function MilestoneRow({ m, tasks, unread, canEdit, onSelect, onEdit }: { m: Milestone; tasks: Task[]; unread: boolean; canEdit: boolean; onSelect: (id: string) => void; onEdit: (id: string) => void }) {
  const { t } = useTranslation("project");
  const msTasks = tasks.filter((tt) => tt.milestoneId === m.id);
  const done = msTasks.filter((tt) => tt.status === "done").length;
  const total = msTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const overdue = m.targetDate ? m.targetDate < todayIso() && m.status !== "released" : false;
  return (
    <div className="data-row">
      <button type="button" className="data-row-main" onClick={() => onSelect(m.id)}>
        <div className="data-row-title">
          <Badge tone={MILESTONE_STATUS[m.status].tone}>{t("releases.statusBadge." + m.status)}</Badge>
          <span className="row-title-text">{m.name}</span>
          {m.version && <span className="data-row-meta">v{m.version.replace(/^v/i, "")}</span>}
          {overdue && <Badge tone="danger" dot>{t("releases.overdue", { defaultValue: "Overdue" })}</Badge>}
        </div>
        {m.changelog && <div className="data-row-sub">{m.changelog}</div>}
        <div className="data-row-meta">
          <span className={overdue ? "text-danger" : ""}><CalendarBlank size={12} aria-hidden="true" /> {m.targetDate ? formatDate(m.targetDate) : t("releases.noTargetDate")}</span>
          <span>#{shortId(m.id)}</span>
          {unread && <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">New</span>}
        </div>
        {total > 0 && (
          <div className="milestone-progress">
            <div className="milestone-progress-track"><div className="milestone-progress-fill" style={{ width: progress + "%" }} /></div>
            <span className="tabular">{t("releases.progressDone", { done, total })}</span>
          </div>
        )}
      </button>
      <div className="data-row-side">
        {canEdit && (
          <Button size="sm" variant="ghost" className="btn-icon" aria-label={t("releases.editAria")} onClick={() => onEdit(m.id)}>
            <PencilSimple size={14} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

function MilestoneGroup({ title, milestones, tasks, unreadIds, canEdit, onSelect, onEdit }: { title: string; milestones: Milestone[]; tasks: Task[]; unreadIds?: ReadonlySet<string>; canEdit: boolean; onSelect: (id: string) => void; onEdit: (id: string) => void }) {
  if (milestones.length === 0) return null;
  return (
    <div className="milestone-group">
      <div className="milestone-group-header"><span className="milestone-group-title">{title}</span><span className="milestone-group-count tabular">{milestones.length}</span></div>
      <div className="data-list">
        {milestones.map((mm) => <MilestoneRow key={mm.id} m={mm} tasks={tasks} unread={!!unreadIds?.has(mm.id)} canEdit={canEdit} onSelect={onSelect} onEdit={onEdit} />)}
      </div>
    </div>
  );
}

export function ReleasesListView({ milestones, tasks, unreadIds, canEdit, onSelect, onEdit, onNew }: ReleasesListViewProps) {
  const { t } = useTranslation("project");
  if (milestones.length === 0) {
    return (
      <EmptyState icon={<Rocket size={22} />} title={t("releases.emptyTitle")} description={t("releases.emptyDesc")} action={canEdit && <Button size="sm" onClick={onNew}><Plus size={14} /> {t("releases.newMilestone")}</Button>} />
    );
  }
  const active = milestones.filter((mm) => mm.status === "inProgress");
  const planned = milestones.filter((mm) => mm.status === "planned");
  const released = milestones.filter((mm) => mm.status === "released");
  return (
    <div className="releases-list-view">
      <MilestoneGroup title={t("releases.group.active")} milestones={active} tasks={tasks} unreadIds={unreadIds} canEdit={canEdit} onSelect={onSelect} onEdit={onEdit} />
      <MilestoneGroup title={t("releases.group.planned")} milestones={planned} tasks={tasks} unreadIds={unreadIds} canEdit={canEdit} onSelect={onSelect} onEdit={onEdit} />
      {released.length > 0 && (
        <details className="milestone-group milestone-group-collapsible" open={released.length <= 3}>
          <summary className="milestone-group-header milestone-group-summary"><span className="milestone-group-title">{t("releases.group.released")}</span><span className="milestone-group-count tabular">{released.length}</span></summary>
          <div className="data-list" style={{ marginTop: 8 }}>
            {released.map((mm) => <MilestoneRow key={mm.id} m={mm} tasks={tasks} unread={!!unreadIds?.has(mm.id)} canEdit={canEdit} onSelect={onSelect} onEdit={onEdit} />)}
          </div>
        </details>
      )}
    </div>
  );
}
