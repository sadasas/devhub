import { useEffect, useState } from "react";
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
import { DataErrorState } from "../../components/DataErrorState";
import { TaskModal } from "../board/TaskModal";
import { Clock, ListBullets, Plus } from "@phosphor-icons/react";

const MILESTONE_SORT_SPECS: SortSpec<Milestone>[] = [
  { key: "targetDate", label: "releases.sort.targetDate", get: (m) => m.targetDate ?? null },
  { key: "name", label: "releases.sort.name", get: (m) => m.name },
  { key: "createdAt", label: "releases.sort.createdAt", get: (m) => m.createdAt },
  { key: "version", label: "releases.sort.version", get: (m) => m.version ?? null, compare: compareVersions },
];

/** Header ringkas ≤640px sama seperti Issues (count hilang, sort icon-only, + Milestone). */
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

export function ReleasesPage({ unreadIds }: { unreadIds?: ReadonlySet<string> }) {
  const { t } = useTranslation("project");
  const { state, loading, error, loadError, canEdit, retryLoad } = useProject();
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [taskEditId, setTaskEditId] = useState<string | null>(null);
  useEntityDeepLink("milestones", setEditId);
  useNewParam(() => setOpenNew(true), "1", canEdit);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: "createdAt", dir: "desc" as const };
  const milestonesForHook = state?.milestones ?? [];
  const { rview, mid, setRview, setMid } = useRviewParam(milestonesForHook);
  const isNarrow = useIsReleasesNarrow();

  if (loading) {
    return (
      <>
      <div className="data-list-header releases-toolbar" aria-hidden="true">
        <span className="releases-header-left" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Skeleton style={{ width: 90, height: 13 }} />
          <span style={{ display: "flex", gap: 4 }}>
            <Skeleton style={{ width: 72, height: 28, borderRadius: 8 }} />
            <Skeleton style={{ width: 84, height: 28, borderRadius: 8 }} />
          </span>
        </span>
        <span className="data-list-actions" style={{ display: "flex", gap: 8 }}>
          <Skeleton style={{ width: 110, height: 28, borderRadius: 8 }} />
          <Skeleton style={{ width: 96, height: 28, borderRadius: 8 }} />
        </span>
      </div>
      {rview === "timeline" ? (
        <div className="timeline" role="status" aria-live="polite" aria-busy="true" aria-label="Loading timeline">
          <span className="sr-only">Loading timeline…</span>
          <div className="timeline-spine" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="timeline-row" style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
                <Skeleton style={{ width: 44, height: 32, flexShrink: 0 }} />
                <Skeleton style={{ width: 12, height: 12, borderRadius: 999, flexShrink: 0, marginTop: 10 }} />
                <Skeleton style={{ flex: 1, height: 74, borderRadius: 12 }} />
              </div>
            ))}
          </div>
        </div>
      ) : (
      <div className="releases-list-view">
        {[0, 1].map((g) => (
          <div key={g} className="milestone-group">
            <div className="milestone-group-header" aria-hidden="true" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <Skeleton style={{ width: 110, height: 14 }} />
              <Skeleton style={{ width: 28, height: 14 }} />
            </div>
            <div className="data-list" role="status" aria-live="polite" aria-busy="true" aria-label="Loading releases">
              <span className="sr-only">Loading releases…</span>
              <div aria-hidden="true">
                {[0, 1].map((i) => (
                  <div key={i} className="data-row" style={{ minHeight: 56 }}>
                    <div className="data-row-main" style={{ gap: 6 }}>
                      <div className="data-row-title" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Skeleton style={{ width: 56, height: 18, borderRadius: 6 }} />
                        <Skeleton style={{ width: "40%", height: 14 }} />
                        <Skeleton style={{ width: 48, height: 12 }} />
                      </div>
                      <Skeleton style={{ width: "65%", height: 11, opacity: 0.8 }} />
                      <div className="data-row-meta" style={{ display: "flex", gap: 8 }}>
                        <Skeleton style={{ width: 88, height: 11 }} />
                        <Skeleton style={{ width: 64, height: 11 }} />
                      </div>
                      <div className="milestone-progress" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Skeleton style={{ flex: 1, height: 6, borderRadius: 999 }} />
                        <Skeleton style={{ width: 56, height: 11 }} />
                      </div>
                    </div>
                    <div className="data-row-side">
                      <Skeleton style={{ width: 32, height: 32, borderRadius: 8 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
      </>
    );
  }

  if (error) return <DataErrorState error={loadError ?? error} onRetry={retryLoad} />;
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
    <div className="releases-page">
      <div className="data-list-header releases-toolbar">
        <span className="releases-header-left">
          <span className="data-list-count">{t("releases.count", { count: state.milestones.length })}</span>
          <div className="sub-tabs releases-view-toggle" role="tablist" aria-label={t("releases.viewToggle.aria", { defaultValue: "Releases view" })}>
            <button type="button" role="tab" className={"sub-tab " + (rview === "list" ? "sub-tab-active" : "")} aria-selected={rview === "list"} aria-controls="releases-panel" aria-label={t("releases.viewToggle.list", { defaultValue: "Daftar" })} title={t("releases.viewToggle.list", { defaultValue: "Daftar" })} onClick={() => setRview("list")}>
              <ListBullets size={13} aria-hidden="true" />
              <span className="sub-tab-label">{t("releases.viewToggle.list", { defaultValue: "Daftar" })}</span>
            </button>
            <button type="button" role="tab" className={"sub-tab " + (rview === "timeline" ? "sub-tab-active" : "")} aria-selected={rview === "timeline"} aria-controls="releases-panel" aria-label={t("releases.viewToggle.timeline", { defaultValue: "Timeline" })} title={t("releases.viewToggle.timeline", { defaultValue: "Timeline" })} onClick={() => setRview("timeline")}>
              <Clock size={13} aria-hidden="true" />
              <span className="sub-tab-label">{t("releases.viewToggle.timeline", { defaultValue: "Timeline" })}</span>
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
            <Button size="sm" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={() => setOpenNew(true)}>
              {isNarrow ? t("releases.newMilestoneShort", { defaultValue: "Milestone" }) : t("releases.newMilestone")}
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

