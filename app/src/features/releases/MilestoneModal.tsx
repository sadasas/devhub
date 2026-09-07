import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Check, FileText } from "@phosphor-icons/react";
import { formatDate, formatRelative } from "../../lib/utils";
import type { Milestone, MilestoneStatus, State } from "../../lib/types";
import type { UpdatePatch } from "../../state/project-context";
import { useProject } from "../../state/project-context";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { Button } from "../../components/Button";
import { InlineError } from "../../components/InlineError";
import { DatePicker } from "../../components/DatePicker";
import { DetailShell } from "../../components/DetailShell";
import { MarkdownField } from "../../components/MarkdownField";
import { PropRow } from "../../components/PropRow";
import { SearchableSelect } from "../../components/SearchableSelect";
import { LIMITS } from "../../lib/limits";

interface MilestoneModalProps {
  milestoneId: string | null;
  onClose: () => void;
}

const STATUS_OPTIONS: MilestoneStatus[] = ["planned", "inProgress", "released"];

export function MilestoneModal({ milestoneId, onClose }: MilestoneModalProps) {
  const { t } = useTranslation("project");
  const { state, dispatch, canEdit } = useProject();
  const editSnapshot = useRef<State | null>(null);
  const [hotProp, setHotProp] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionDraft, setVersionDraft] = useState("");
  const [versionAnchor, setVersionAnchor] = useState<{ top: number; bottom: number; left: number } | null>(null);
  const [versionPos, setVersionPos] = useState<{ top: number; left: number } | null>(null);
  const versionPopRef = useRef<HTMLDivElement | null>(null);
  const versionCancelRef = useRef(false);

  useEffect(() => {
    if (milestoneId && state) {
      editSnapshot.current = structuredClone(state);
    }
  }, [milestoneId]);

  useEffect(() => {
    setHotProp(null);
    setVersionOpen(false);
  }, [milestoneId]);

  // Judul autogrow tanpa batas — yang scroll .composer-scroll, bukan textarea.
  useLayoutEffect(() => {
    const ta = titleRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  });

  useEffect(() => {
    if (!versionOpen) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (versionPopRef.current?.contains(el as Node) || el?.closest?.("[data-pop-anchor]") || el?.closest?.('[data-prop="version"]')) return;
      setVersionOpen(false);
      setHotProp(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        versionCancelRef.current = true;
        setVersionOpen(false);
        setHotProp(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [versionOpen]);

  const measureVersionPopup = useCallback(() => {
    if (!versionAnchor) return;
    const h = versionPopRef.current?.offsetHeight ?? 0;
    const w = 240;
    const below = versionAnchor.bottom + 6;
    const fitsBelow = window.innerHeight - below >= h + 8;
    const next = {
      top: fitsBelow ? below : Math.max(8, versionAnchor.top - h - 6),
      left: Math.max(8, Math.min(versionAnchor.left, window.innerWidth - w - 8)),
    };
    setVersionPos((prev) => (prev && prev.top === next.top && prev.left === next.left ? prev : next));
  }, [versionAnchor]);

  useLayoutEffect(() => {
    if (versionOpen) measureVersionPopup();
  }, [versionOpen, measureVersionPopup]);

  useEffect(() => {
    if (!versionOpen) return;
    window.addEventListener("resize", measureVersionPopup);
    return () => window.removeEventListener("resize", measureVersionPopup);
  }, [versionOpen, measureVersionPopup]);

  const milestone = milestoneId ? state?.milestones.find((m) => m.id === milestoneId) : undefined;
  usePresenceStatus("Editing milestone", milestone != null);

  if (!state || !milestone) return null;

  const nameEmpty = milestone.name.trim() === '';

  const statusLabels: Record<MilestoneStatus, string> = {
    planned: t("releases.optionStatus.planned"),
    inProgress: t("releases.optionStatus.inProgress"),
    released: t("releases.optionStatus.released"),
  };

  const update = (patch: UpdatePatch<Milestone>) => {
    dispatch({ type: "milestone/update", id: milestone.id, patch });
  };

  const cancelEditing = () => {
    if (editSnapshot.current) {
      dispatch({ type: "replace", state: editSnapshot.current });
      editSnapshot.current = null;
    }
    onClose();
  };

  const finishEditing = () => {
    editSnapshot.current = null;
    onClose();
  };

  const openVersionPopup = () => {
    setHotProp(null);
    versionCancelRef.current = false;
    setVersionDraft(milestone.version ?? "");
    const el = document.querySelector('[data-prop="version"]');
    const r = el?.getBoundingClientRect();
    if (r) setVersionAnchor({ top: r.top, bottom: r.bottom, left: r.left });
    else setVersionAnchor({ top: 0, bottom: 0, left: 0 });
    setVersionPos(null);
    setVersionOpen(true);
  };

  const commitVersionDraft = () => {
    if (versionCancelRef.current) {
      versionCancelRef.current = false;
      return;
    }
    const next = versionDraft.replace(/[^0-9.]/g, "").trim() || null;
    const current = milestone.version ?? null;
    if (next !== current) update({ version: next });
    setVersionOpen(false);
    setHotProp(null);
  };

  const cancelVersionPopup = () => {
    versionCancelRef.current = true;
    setVersionOpen(false);
    setHotProp(null);
  };

  const setVersionHot = (v: string | null) => {
    if (v === "version") {
      if (versionOpen) commitVersionDraft();
      else openVersionPopup();
    } else if (v === null) {
      if (!versionOpen) setHotProp(null);
    } else {
      versionCancelRef.current = true;
      setVersionOpen(false);
      setHotProp(v);
    }
  };

  return (
    <>
    <DetailShell
      title={t("releases.modal.editTitle")}
      onClose={onClose}
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" onClick={cancelEditing}>
            {t("releases.modal.cancel")}
          </Button>
          <Button variant="primary" leftIcon={<Check size={13} weight="bold" aria-hidden="true" />} onClick={finishEditing} disabled={nameEmpty}>
            {t("releases.modal.done")}
          </Button>
        </>
      }
      sidebar={<>
        <PropRow
          propKey="status"
          label={t("releases.modal.statusLabel")}
          hot={hotProp === "status"}
          setHot={setHotProp}
          canEdit={canEdit}
          view={(
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: milestone.status === "released" ? "var(--status-success-dim)" : milestone.status === "inProgress" ? "var(--status-info-dim)" : "var(--bg-inset)", fontSize: 12 }}>
              {statusLabels[milestone.status]}
            </span>
          )}
          control={(
            <SearchableSelect defaultOpen searchable={false} id="milestone-status" label="" ariaLabel={t("releases.modal.statusLabel")} value={milestone.status} allowEmpty={false} options={STATUS_OPTIONS.map((s) => ({ value: s, label: statusLabels[s] }))} onChange={(v) => { if (v) { update({ status: v as MilestoneStatus }); setHotProp(null); } }} />
          )}
        />
        <PropRow
          propKey="version"
          label={t("releases.modal.versionLabel")}
          hot={false}
          setHot={setVersionHot}
          canEdit={canEdit}
          view={milestone.version ? (
            <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{milestone.version}</span>
          ) : (
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>—</span>
          )}
          control={<span />}
        />
        <PropRow
          propKey="targetDate"
          label={t("releases.modal.targetDateLabel")}
          hot={hotProp === "targetDate"}
          setHot={setHotProp}
          canEdit={canEdit}
          view={(
            <span style={{ fontSize: 13, color: milestone.targetDate ? "var(--text-secondary)" : "var(--text-muted)" }}>
              {milestone.targetDate ? formatDate(milestone.targetDate) : "—"}
            </span>
          )}
          control={(
            <DatePicker
              id="milestone-targetDate"
              mode="single"
              start={milestone.targetDate?.slice(0, 10) ?? null}
              end={null}
              onApply={(s) => { update({ targetDate: s }); setHotProp(null); }}
              onClose={() => setHotProp(null)}
            />
          )}
        />
      </>}
    >
      {canEdit ? (
        <textarea
          ref={titleRef}
          className="composer-title"
          rows={1}
          value={milestone.name}
          autoFocus
          maxLength={LIMITS.MILESTONE_NAME}
          onChange={(e) => update({ name: e.target.value })}
          aria-label={t("releases.modal.nameLabel")}
          aria-invalid={nameEmpty}
        />
      ) : (
        <h3
          className="detail-title"
          style={{ padding: "4px 6px", margin: "-4px -6px" }}
        >
          {milestone.name}
        </h3>
      )}
      {nameEmpty && <InlineError>{t("tracker:issues.modal.titleRequired")}</InlineError>}
      <div className="detail-created" style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
        <span style={{ width: 110, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          {t("tracker:issues.modal.createdTimeLabel")}
        </span>
        <span style={{ color: "var(--text-secondary)" }}>{formatDate(milestone.createdAt)} {new Date(milestone.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <MarkdownField
        label={t("releases.modal.changelogLabel")}
        icon={FileText}
        value={milestone.changelog}
        onChange={(v) => update({ changelog: v })}
        placeholder={t("releases.modal.changelogPlaceholder")}
        maxLength={LIMITS.MILESTONE_CHANGELOG}
        rows={4}
        variant="bare"
        previewToggle
      />
      <p className="field-helper">{t("releases.modal.updated", { time: formatRelative(milestone.updatedAt) })}</p>
    </DetailShell>
      {versionOpen && createPortal(
        <div
          ref={versionPopRef}
          className="prop-menu prop-pop"
          role="dialog"
          tabIndex={-1}
          aria-label={t("releases.modal.versionLabel")}
          style={versionPos ? { top: versionPos.top, left: versionPos.left } : { visibility: "hidden" }}
        >
          <div className="prop-pop-label">{t("releases.modal.versionLabel")}</div>
          <input
            autoFocus
            id="milestone-version"
            className="input"
            value={versionDraft}
            onChange={(e) => setVersionDraft(e.target.value.replace(/[^0-9.]/g, ""))}
            onBlur={commitVersionDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitVersionDraft();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cancelVersionPopup();
              }
            }}
            placeholder={t("releases.modal.versionPlaceholder")}
            maxLength={LIMITS.MILESTONE_VERSION}
            inputMode="decimal"
            aria-label={t("releases.modal.versionLabel")}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
