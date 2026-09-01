import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProject } from "../../state/project-context";
import { useEntityDeepLink } from "../../hooks/useEntityDeepLink";
import { useNewParam } from "../../hooks/useNewParam";
import { useSortParam } from "../../hooks/useSortParam";
import { useRviewParam } from "../../hooks/useRviewParam";
import { applySort, type SortSpec } from "../../lib/sort";
import { compareVersions } from "../../lib/compare-version";
import type { Milestone } from "../../lib/types";
import { Button } from "../../components/Button";
import { Skeleton } from "../../components/Skeleton";
import { SortControl } from "../../components/SortControl";
import { MilestoneModal } from "./MilestoneModal";
import { NewMilestoneModal } from "./NewMilestoneModal";
import { ReleasesListView } from "./ReleasesListView";
import { ReleasesTimelineView } from "./ReleasesTimelineView";
import { MilestoneDetailView } from "./MilestoneDetailView";
import { InlineError } from "../../components/InlineError";
import { TaskModal } from "../board/TaskModal";
import { Plus } from "@phosphor-icons/react";

const MILESTONE_SORT_SPECS: SortSpec<Milestone>[] = [
  { key: "targetDate", label: "releases.sort.targetDate", get: (m) => m.targetDate ?? null },
  { key: "name", label: "releases.sort.name", get: (m) => m.name },
  { key: "createdAt", label: "releases.sort.createdAt", get: (m) => m.createdAt },
  { key: "version", label: "releases.sort.version", get: (m) => m.version ?? null, compare: compareVersions },
];

export function ReleasesPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { t } = useTranslation("project");
  const { state, loading, error, canEdit } = useProject();
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [taskEditId, setTaskEditId] = useState<string | null>(null);
  useEntityDeepLink("milestones", setEditId);
  useNewParam(() => setOpenNew(true), "1", canEdit);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: "createdAt", dir: "desc" as const };
  const milestonesForHook = state?.milestones ?? [];
  const { rview, mid, setRview, setMid } = useRviewParam(milestonesForHook);

  if (loading) {
    return (
      <div className="data-list" role="status" aria-live="polite" aria-busy="true" aria-label="Loading releases">
        <span className="sr-only">Loading releases…</span>
        <div aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="data-row" style={{ height: 56 }}>
              <div className="data-row-main" style={{ gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Skeleton style={{ width: `${55 - i * 5}%`, height: 14 }} />
                  <Skeleton style={{ width: 48, height: 18, borderRadius: 6 }} />
                </div>
                <Skeleton style={{ width: '60%', height: 11, opacity: 0.8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Skeleton style={{ width: 64, height: 11, borderRadius: 999 }} />
                  <Skeleton style={{ width: 44, height: 11 }} />
                </div>
              </div>
              <div className="data-row-side">
                <Skeleton style={{ width: 56, height: 18, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (error) return <InlineError>{error}</InlineError>;
  if (!state) return null;

  const sortSpec = MILESTONE_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const sortedMilestones = applySort(state.milestones, sortSpec, effectiveSort.dir);

  // Detail inline: if mid selected, show detail full-width (page) regardless of rview
  const selectedMilestone = mid ? state.milestones.find((m) => m.id === mid) ?? null : null;
  if (selectedMilestone) {
    return (
      <div>
        <MilestoneDetailView
          milestone={selectedMilestone}
          tasks={state.tasks}
          issues={state.issues}
          testCases={state.testCases}
          decisions={state.decisions}
          schemaVersions={state.schemaVersions}
          onBack={() => setMid(null)}
          onEdit={() => setEditId(selectedMilestone.id)}
          onOpenTask={setTaskEditId}
          canEdit={canEdit}
        />
        <MilestoneModal milestoneId={editId} onClose={() => setEditId(null)} />
        {taskEditId && <TaskModal taskId={taskEditId} onClose={() => setTaskEditId(null)} />}
      </div>
    );
  }

  return (
    <div>
      <div className="data-list-header releases-toolbar">
        <span className="releases-header-left">
          <span className="data-list-count">{t("releases.count", { count: state.milestones.length })}</span>
          <div className="sub-tabs" role="tablist" aria-label={t("releases.viewToggle.aria", { defaultValue: "Releases view" })}>
            <button type="button" role="tab" className={"sub-tab " + (rview === "list" ? "sub-tab-active" : "")} aria-selected={rview === "list"} aria-controls="releases-panel" onClick={() => setRview("list")}>
              {t("releases.viewToggle.list", { defaultValue: "Daftar" })}
            </button>
            <button type="button" role="tab" className={"sub-tab " + (rview === "timeline" ? "sub-tab-active" : "")} aria-selected={rview === "timeline"} aria-controls="releases-panel" onClick={() => setRview("timeline")}>
              {t("releases.viewToggle.timeline", { defaultValue: "Timeline" })}
            </button>
          </div>
        </span>
        <span className="data-list-actions">
          {rview === "list" && (
            <SortControl
              options={MILESTONE_SORT_SPECS.filter((s) => s.key !== "createdAt").map((s) => ({ value: s.key, label: t(s.label) }))}
              value={sortValue}
              onChange={setSort}
            />
          )}
          {canEdit && (
            <Button size="sm" onClick={() => setOpenNew(true)}>
              <Plus size={14} aria-hidden="true" /> {t("releases.newMilestone")}
            </Button>
          )}
        </span>
      </div>

      <div id="releases-panel" role="tabpanel">
        {rview === "list" ? (
          <ReleasesListView
            milestones={sortedMilestones}
            tasks={state.tasks}
            unreadIds={unreadIds}
            canEdit={canEdit}
            onSelect={setMid} onEdit={setEditId}
            onNew={() => setOpenNew(true)}
          />
        ) : (
          <ReleasesTimelineView milestones={state.milestones} tasks={state.tasks} onSelect={setMid} unreadIds={unreadIds} />
        )}
      </div>

      {openNew && <NewMilestoneModal onClose={() => setOpenNew(false)} />}
      <MilestoneModal milestoneId={editId} onClose={() => setEditId(null)} />
      {taskEditId && <TaskModal taskId={taskEditId} onClose={() => setTaskEditId(null)} />}
    </div>
  );
}

