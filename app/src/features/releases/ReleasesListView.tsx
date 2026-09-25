import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { MILESTONE_STATUS } from "../../lib/labels";
import type { Milestone, Task } from "../../lib/types";
import { formatDate, shortId } from "../../lib/utils";
import { todayIso } from "../../lib/due-dates";
import { CalendarBlank, PencilSimple, Plus, Rocket, Trash } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { RowMenu } from "../../components/RowMenu";

function useIsReleasesNarrow(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 640px)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = (): void => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);
  return matches;
}

interface ReleasesListViewProps {
  milestones: Milestone[];
  tasks: Task[];
  unreadIds?: ReadonlySet<string>;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

function MilestoneRow({ m, tasks, unread, canEdit, onSelect, onEdit, onDelete, isNarrow }: { m: Milestone; tasks: Task[]; unread: boolean; canEdit: boolean; onSelect: (id: string) => void; onEdit: (id: string) => void; onDelete: (id: string) => void; isNarrow: boolean }) {
  const { t } = useTranslation("project");
  const msTasks = tasks.filter((tt) => tt.milestoneId === m.id);
  const done = msTasks.filter((tt) => tt.status === "done").length;
  const total = msTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const overdue = m.targetDate ? m.targetDate < todayIso() && m.status !== "released" : false;
  return (
    <div className="data-row">
      <div className="data-row-top">
        <button
          type="button"
          className="data-row-btn"
          onClick={() => onSelect(m.id)}
          aria-label={m.name}
        >
          <span className="data-row-title">
            <Badge tone={MILESTONE_STATUS[m.status].tone}>{t("releases.statusBadge." + m.status)}</Badge>
            <span className="row-title-text">{m.name}</span>
            {m.version && <span className="data-row-meta">v{m.version.replace(/^v/i, "")}</span>}
            {overdue && <Badge tone="danger" dot>{t("releases.overdue", { defaultValue: "Overdue" })}</Badge>}
          </span>
        </button>
        <span className="data-row-props">
          {canEdit && !isNarrow && (
            <span className="row-swap">
              <span className="swap-group">
                <Button size="sm" variant="ghost" className="btn-icon" aria-label={t("releases.editAria")} onClick={() => onEdit(m.id)}>
                  <PencilSimple size={14} aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="btn-icon btn-danger swap-trash"
                  aria-label={`Delete milestone ${m.name}`}
                  title={`Delete milestone ${m.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const btn = e.currentTarget;
                    onDelete(m.id);
                    // Blur pointer-only agar :focus-within tidak nyangkut
                    // (pola IssuesPage).
                    if (e.detail !== 0) btn.blur();
                  }}
                >
                  <Trash size={14} aria-hidden="true" />
                </Button>
              </span>
            </span>
          )}
          {canEdit && isNarrow && (
            <RowMenu
              triggerLabel={`More actions for ${m.name}`}
              menuLabel={`More actions for ${m.name}`}
              menuId={`milestone-rowmenu-${m.id}`}
              actions={[
                {
                  key: "edit",
                  label: t("releases.editAria"),
                  icon: <PencilSimple size={14} aria-hidden="true" />,
                  onSelect: () => onEdit(m.id),
                },
                {
                  key: "delete",
                  label: t("releases.modal.delete"),
                  icon: <Trash size={14} aria-hidden="true" />,
                  danger: true,
                  onSelect: () => onDelete(m.id),
                },
              ]}
            />
          )}
        </span>
      </div>
      <button
        type="button"
        className="data-row-body"
        onClick={() => onSelect(m.id)}
        aria-label={`${m.name} — ${t("releases.openDetails", { defaultValue: "Open milestone details" })}`}
      >
        {m.changelog && <span className="data-row-sub">{m.changelog}</span>}
        <span className="data-row-meta">
          <span className={overdue ? "text-danger" : ""}><CalendarBlank size={12} aria-hidden="true" /> {m.targetDate ? formatDate(m.targetDate) : t("releases.noTargetDate")}</span>
          <span>#{shortId(m.id)}</span>
          {unread && <span className="unread-pill" role="status" aria-label={t('releases.unread')} title={t('releases.unread')}>{t('releases.unread')}</span>}
        </span>
        {total > 0 && (
          <span className="milestone-progress">
            <span className="milestone-progress-track"><span className="milestone-progress-fill" style={{ width: progress + "%" }} /></span>
            <span className="tabular">{t("releases.progressDone", { done, total })}</span>
          </span>
        )}
      </button>
    </div>
  );
}

function MilestoneGroup({ title, milestones, tasks, unreadIds, canEdit, onSelect, onEdit, onDelete, isNarrow }: { title: string; milestones: Milestone[]; tasks: Task[]; unreadIds?: ReadonlySet<string>; canEdit: boolean; onSelect: (id: string) => void; onEdit: (id: string) => void; onDelete: (id: string) => void; isNarrow: boolean }) {
  if (milestones.length === 0) return null;
  return (
    <div className="milestone-group">
      <div className="milestone-group-header"><span className="milestone-group-title">{title}</span><span className="milestone-group-count tabular">{milestones.length}</span></div>
      <div className="data-list">
        {milestones.map((mm) => <MilestoneRow key={mm.id} m={mm} tasks={tasks} unread={!!unreadIds?.has(mm.id)} canEdit={canEdit} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} isNarrow={isNarrow} />)}
      </div>
    </div>
  );
}

export function ReleasesListView({ milestones, tasks, unreadIds, canEdit, onSelect, onEdit, onDelete, onNew }: ReleasesListViewProps) {
  const { t } = useTranslation("project");
  const isNarrow = useIsReleasesNarrow();
  if (milestones.length === 0) {
    return (
      <EmptyState icon={<Rocket size={22} />} title={t("releases.emptyTitle")} description={t("releases.emptyDesc")} action={canEdit && <Button size="md" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={onNew}>{isNarrow ? t("releases.newMilestoneShort", { defaultValue: "Milestone" }) : t("releases.newMilestone")}</Button>} />
    );
  }
  const active = milestones.filter((mm) => mm.status === "inProgress");
  const planned = milestones.filter((mm) => mm.status === "planned");
  const released = milestones.filter((mm) => mm.status === "released");
  return (
    <div className="releases-list-view">
      <MilestoneGroup title={t("releases.group.active")} milestones={active} tasks={tasks} unreadIds={unreadIds} canEdit={canEdit} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} isNarrow={isNarrow} />
      <MilestoneGroup title={t("releases.group.planned")} milestones={planned} tasks={tasks} unreadIds={unreadIds} canEdit={canEdit} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} isNarrow={isNarrow} />
      {released.length > 0 && (
        <details className="milestone-group milestone-group-collapsible" open={released.length <= 3}>
          <summary className="milestone-group-header milestone-group-summary"><span className="milestone-group-title">{t("releases.group.released")}</span><span className="milestone-group-count tabular">{released.length}</span></summary>
          <div className="data-list" style={{ marginTop: 8 }}>
            {released.map((mm) => <MilestoneRow key={mm.id} m={mm} tasks={tasks} unread={!!unreadIds?.has(mm.id)} canEdit={canEdit} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} isNarrow={isNarrow} />)}
          </div>
        </details>
      )}
    </div>
  );
}
