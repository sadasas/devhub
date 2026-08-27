import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatRelative } from "../../lib/utils";
import type { State, Milestone, MilestoneStatus } from "../../lib/types";
import type { UpdatePatch } from "../../state/project-context";
import { useProject } from "../../state/project-context";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { MarkdownBlocks } from "../../lib/markdown";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { ArrowsOutSimple, ArrowsInSimple } from "@phosphor-icons/react";

interface MilestoneModalProps {
  milestoneId: string | null;
  onClose: () => void;
}

export function MilestoneModal({ milestoneId, onClose }: MilestoneModalProps) {
  const { t } = useTranslation("project");
  const { state, dispatch } = useProject();
  const editSnapshot = useRef<State | null>(null);
  const [preview, setPreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const changelogId = useId();
  const helperId = useId();
  const countId = useId();
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (milestoneId && state) {
      editSnapshot.current = structuredClone(state);
    }
  }, [milestoneId]);

  useEffect(() => {
    setPreview(false);
    setExpanded(false);
  }, [milestoneId]);

  const milestone = milestoneId ? state?.milestones.find((m) => m.id === milestoneId) : undefined;
  usePresenceStatus("Editing milestone", milestone != null);

  useEffect(() => {
    if (!preview && !expanded && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 340) + "px";
      el.style.overflowY = el.scrollHeight > 340 ? "auto" : "hidden";
    }
  }, [milestone?.changelog, preview, expanded]);

  if (!state || !milestone) return null;

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

  const count = milestone.changelog.length;
  const limit = 20000;
  const countTone = count > limit * 0.95 ? "var(--status-danger)" : count > limit * 0.8 ? "var(--status-warn)" : "var(--text-muted)";

  const changelogField = (
    <div className="field" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div className="field-label-row">
        <label className="field-label" htmlFor={changelogId}>
          {t("releases.modal.changelogLabel")}
        </label>
        <span className="flex-1" />
        {!expanded && (
          <div className="md-toggle" role="group" aria-label={t("prd.modeAria", { label: t("releases.modal.changelogLabel") })}>
            <button type="button" title={t("prd.mdTooltip")} className={`md-toggle-btn${!preview ? " active" : ""}`} aria-pressed={!preview} onClick={() => setPreview(false)}>
              {t("prd.edit")}
            </button>
            <button type="button" title={t("prd.mdTooltip")} className={`md-toggle-btn${preview ? " active" : ""}`} aria-pressed={preview} onClick={() => setPreview(true)}>
              {t("prd.preview")}
            </button>
          </div>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="btn-icon"
          data-expand-trigger
          aria-label={expanded ? t("releases.modal.collapse", { defaultValue: "Collapse" }) : t("releases.modal.expand", { defaultValue: "Expand" })}
          title={expanded ? "Collapse — back to single" : "Expand — split edit & preview"}
          aria-expanded={expanded}
          aria-controls={`${changelogId}-expanded`}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ArrowsInSimple size={14} /> : <ArrowsOutSimple size={14} />}
        </Button>
      </div>
      {preview && !expanded ? (
        <div className="md-preview" style={{ maxHeight: 340, overflowY: "auto" }} tabIndex={0} role="region" aria-label={t("releases.modal.previewLabel", { defaultValue: "Preview changelog" })}>
          {milestone.changelog.trim() ? <MarkdownBlocks text={milestone.changelog} /> : <span className="md-preview-empty">{t("prd.nothingToPreview")}</span>}
        </div>
      ) : !expanded ? (
        <textarea
          ref={textareaRef}
          id={changelogId}
          className="textarea textarea-autosize"
          rows={4}
          value={milestone.changelog}
          onChange={(e) => update({ changelog: e.target.value })}
          placeholder={t("releases.modal.changelogPlaceholder", { defaultValue: "- bullet, **bold**, _italic_, `code`" })}
          aria-describedby={`${helperId} ${countId}`}
          style={{ minHeight: 96, maxHeight: 340, resize: "vertical", overflowY: "auto", fieldSizing: "content" } as React.CSSProperties}
        />
      ) : null}
      {!expanded && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <span id={countId} className="tabular" style={{ fontSize: 11, color: countTone }} aria-live="polite" aria-atomic="true">
              {count.toLocaleString()} / {limit.toLocaleString()}
            </span>
          </div>
          <p id={helperId} className="field-helper">{t("releases.modal.changelogHelp")}</p>
          <p id={`${helperId}-2`} className="field-helper">{t("releases.modal.changelogHelp2")}</p>
        </>
      )}
    </div>
  );

  if (expanded) {
    return (
      <Modal
        open={milestoneId !== null}
        title={t("releases.modal.editTitle") + " — " + milestone.name}
        onClose={() => setExpanded(false)}
        width="lg"
        className="modal-fullscreen modal-split"
        initialFocusRef={expandedTextareaRef}
        footer={
          <>
            <span className="flex-1" />
            <Button variant="primary" onClick={() => setExpanded(false)}>{t("releases.modal.done")}</Button>
          </>
        }
      >
        <div className="modal-split-grid">
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}>
            <label className="field-label" htmlFor={`${changelogId}-expanded`} style={{ fontWeight: 600 }}>{t("releases.modal.changelogLabel")} — Edit</label>
            <textarea
              ref={expandedTextareaRef}
              id={`${changelogId}-expanded`}
              className="textarea"
              value={milestone.changelog}
              onChange={(e) => update({ changelog: e.target.value })}
              placeholder={t("releases.modal.changelogPlaceholder")}
              aria-describedby={`${helperId} ${countId}`}
              style={{ flex: 1, minHeight: 0, resize: "none", overflowY: "auto" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span id={helperId} className="field-helper" style={{ margin: 0 }}>{t("releases.modal.changelogHelp")}</span>
              <span id={countId} className="tabular" style={{ fontSize: 11, color: countTone }} aria-live="polite" aria-atomic="true">{count.toLocaleString()} / {limit.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, borderLeft: "1px solid var(--border-hairline)", paddingLeft: 16 }}>
            <div className="field-label" style={{ fontWeight: 600 }} id={`${changelogId}-preview-heading`}>Preview</div>
            <div className="md-preview" style={{ flex: 1, overflowY: "auto" }} tabIndex={0} role="region" aria-labelledby={`${changelogId}-preview-heading`}>
              {milestone.changelog.trim() ? <MarkdownBlocks text={milestone.changelog} /> : <span className="md-preview-empty">{t("prd.nothingToPreview")}</span>}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={milestoneId !== null}
      title={t("releases.modal.editTitle")}
      onClose={onClose}
      width="md"
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" onClick={cancelEditing}>
            {t("releases.modal.cancel")}
          </Button>
          <Button variant="primary" onClick={finishEditing}>
            {t("releases.modal.done")}
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <Input label={t("releases.modal.nameLabel")} value={milestone.name} onChange={(e) => update({ name: e.target.value })} />
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="milestone-version">
              {t("releases.modal.versionLabel")}
            </label>
            <input
              id="milestone-version"
              className="input"
              placeholder={t("releases.modal.versionPlaceholder")}
              inputMode="decimal"
              value={milestone.version ?? ""}
              onChange={(e) => update({ version: e.target.value.replace(/[^0-9.]/g, "").trim() || null })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="milestone-target">
              {t("releases.modal.targetDateLabel")}
            </label>
            <input id="milestone-target" className="input" type="date" value={milestone.targetDate?.slice(0, 10) ?? ""} onChange={(e) => update({ targetDate: e.target.value || null })} />
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="milestone-status">
            {t("releases.modal.statusLabel")}
          </label>
          <select id="milestone-status" className="select" value={milestone.status} onChange={(e) => update({ status: e.target.value as MilestoneStatus })}>
            <option value="planned">{t("releases.optionStatus.planned")}</option>
            <option value="inProgress">{t("releases.optionStatus.inProgress")}</option>
            <option value="released">{t("releases.optionStatus.released")}</option>
          </select>
        </div>
        {changelogField}
        <p className="field-helper">{t("releases.modal.updated", { time: formatRelative(milestone.updatedAt) })}</p>
      </div>
    </Modal>
  );
}
