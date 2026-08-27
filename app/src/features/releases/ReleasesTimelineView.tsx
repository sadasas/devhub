import { Badge } from "../../components/Badge";
import { MarkdownBlocks } from "../../lib/markdown";
import { MILESTONE_STATUS } from "../../lib/labels";
import type { Milestone, Task } from "../../lib/types";
import { shortId } from "../../lib/utils";
import { Check, Rocket } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

interface Props {
  milestones: Milestone[];
  tasks: Task[];
  onSelect: (id: string) => void;
  unreadIds?: ReadonlySet<string>;
  showCta?: boolean;
}

function dotForStatus(status: Milestone["status"]) {
  if (status === "released") return "timeline-dot--released";
  if (status === "inProgress") return "timeline-dot--active";
  return "timeline-dot--planned";
}

function parseDateParts(iso?: string | null) {
  if (!iso) return null;
  try {
    const d = new Date(iso + "T00:00:00Z");
    return {
      month: d.toLocaleDateString("en-US", { month: "long" }),
      day: String(d.getUTCDate()).padStart(2, "0"),
      year: String(d.getUTCFullYear()),
    };
  } catch {
    return null;
  }
}

export function ReleasesTimelineView({ milestones, tasks, onSelect, unreadIds, showCta = true }: Props) {
  const { t } = useTranslation("project");
  if (milestones.length === 0) return null;
  const sorted = [...milestones].sort((a, b) => {
    const ta = a.targetDate ?? "9999-99-99";
    const tb = b.targetDate ?? "9999-99-99";
    if (ta !== tb) return ta.localeCompare(tb);
    return a.createdAt.localeCompare(b.createdAt);
  });
  const releasedCount = sorted.filter((m) => m.status === "released").length;
  const total = sorted.length;
  const fillPercent = total > 1 ? Math.round((releasedCount / total) * 100) : 0;
  return (
    <div className="timeline">
      <div className="timeline-spine" aria-hidden="true">
        <div className="timeline-spine-fill" style={{ height: fillPercent + "%" }} />
      </div>
      {sorted.map((m) => {
        const msTasks = tasks.filter((tt) => tt.milestoneId === m.id);
        const done = msTasks.filter((tt) => tt.status === "done").length;
        const tot = msTasks.length;
        const progress = tot > 0 ? Math.round((done / tot) * 100) : 0;
        const date = parseDateParts(m.targetDate);
        return (
          <div key={m.id} className="timeline-row">
            <div className="timeline-date-col">
              {date ? (
                <>
                  <span className="timeline-date-month">{date.month}</span>
                  <span className="timeline-date-day">{date.day}</span>
                  <span className="timeline-date-year">{date.year}</span>
                </>
              ) : (
                <span className="timeline-date-empty">{t("releases.noTargetDate")}</span>
              )}
            </div>
            <div className={"timeline-dot " + dotForStatus(m.status)} aria-hidden="true">
              {m.status === "released" ? <Check size={14} weight="bold" /> : m.status === "inProgress" ? <Rocket size={14} weight="fill" /> : null}
            </div>
            <button type="button" className="timeline-card" onClick={() => onSelect(m.id)} aria-label={m.name}>
              <div className="timeline-card-head">
                <Badge tone={MILESTONE_STATUS[m.status].tone}>{t("releases.statusBadge." + m.status)}</Badge>
                {m.version && <span className="font-mono tabular" style={{ fontSize: 11, color: "var(--text-muted)" }}>v{m.version.replace(/^v/i, "")}</span>}
                <span className="font-mono tabular" style={{ fontSize: 11, color: "var(--text-muted)" }}>#{shortId(m.id)}</span>
                {unreadIds?.has(m.id) && <span className="unread-pill">New</span>}
              </div>
              <div className="timeline-card-title">{m.name}</div>
              {m.changelog && <div className="timeline-card-sub md-blocks"><MarkdownBlocks text={m.changelog} /></div>}
              {tot > 0 && (
                <div className="milestone-progress" style={{ marginTop: 8 }}>
                  <div className="milestone-progress-track">
                    <div className="milestone-progress-fill" style={{ width: progress + "%" }} />
                  </div>
                  <span className="tabular">{done}/{tot} · {progress}%</span>
                </div>
              )}
              {showCta && <span className="timeline-cta">{t("releases.flow.viewDetail", { defaultValue: "Lihat detail alur →" })}</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}
