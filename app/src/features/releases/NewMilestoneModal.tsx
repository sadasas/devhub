import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProject } from "../../state/project-context";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { newId, nowIso } from "../../lib/utils";
import type { MilestoneStatus } from "../../lib/types";
import { MarkdownBlocks } from "../../lib/markdown";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { ArrowsOutSimple, ArrowsInSimple } from "@phosphor-icons/react";

interface NewMilestoneModalProps {
  onClose: () => void;
}

export function NewMilestoneModal({ onClose }: NewMilestoneModalProps) {
  const { t } = useTranslation("project");
  const { dispatch } = useProject();
  usePresenceStatus("Creating milestone");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState<MilestoneStatus>("planned");
  const [changelog, setChangelog] = useState("");
  const [preview, setPreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const changelogId = useId();
  const helperId = useId();
  const countId = useId();
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!preview && !expanded && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      const max = 340;
      el.style.height = Math.min(el.scrollHeight, max) + "px";
      el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
    }
  }, [changelog, preview, expanded]);

  const submit = () => {
    if (!name.trim()) return;
    const ts = nowIso();
    dispatch({
      type: "milestone/add",
      milestone: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        version: version.trim().replace(/^v+/i, "") || null,
        targetDate: targetDate || null,
        status,
        changelog: changelog.trim(),
      },
    });
    onClose();
  };

  const count = changelog.length;
  const limit = 20000;
  const countTone = count > limit * 0.95 ? "var(--status-danger)" : count > limit * 0.8 ? "var(--status-warn)" : "var(--text-muted)";

  const changelogField = (
    <div className="field" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div className="field-label-row">
        <label className="field-label" htmlFor={changelogId}>
          {t("releases.newModal.changelogLabel")}
        </label>
        <span className="flex-1" />
        {!expanded && (
          <div className="md-toggle" role="group" aria-label={t("prd.modeAria", { label: t("releases.newModal.changelogLabel") })}>
            <button type="button" title={t("prd.mdTooltip")} className={`md-toggle-btn${!preview ? " active" : ""}`} aria-pressed={!preview} onClick={() => setPreview(false)}>
              {t("prd.edit")}
            </button>
            <button type="button" title={t("prd.mdTooltip")} className={`md-toggle-btn${preview ? " active" : ""}`} aria-pressed={preview} onClick={() => setPreview(true)}>
              {t("prd.preview")}
            </button>
          </div>
        )}
        <Button size="sm" variant="ghost" className="btn-icon" data-expand-trigger aria-label={expanded ? t("releases.modal.collapse", { defaultValue: "Collapse" }) : t("releases.modal.expand", { defaultValue: "Expand" })} title={expanded ? "Collapse — back to single" : "Expand — split edit & preview"} aria-expanded={expanded} aria-controls={`${changelogId}-expanded`} onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ArrowsInSimple size={14} /> : <ArrowsOutSimple size={14} />}
        </Button>
      </div>
      {preview && !expanded ? (
        <div className="md-preview" style={{ maxHeight: 340, overflowY: "auto" }} tabIndex={0} role="region" aria-label={t("releases.modal.previewLabel", { defaultValue: "Preview changelog" })}>
          {changelog.trim() ? <MarkdownBlocks text={changelog} /> : <span className="md-preview-empty">{t("prd.nothingToPreview")}</span>}
        </div>
      ) : !expanded ? (
        <textarea
          ref={textareaRef}
          id={changelogId}
          className="textarea textarea-autosize"
          rows={4}
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder={t("releases.newModal.changelogHelper")}
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
        open
        title={t("releases.newModal.title") + " — " + (name || "New")}
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
            <label className="field-label" htmlFor={`${changelogId}-expanded`} style={{ fontWeight: 600 }}>{t("releases.newModal.changelogLabel")} — Edit</label>
            <textarea
              ref={expandedTextareaRef}
              id={`${changelogId}-expanded`}
              className="textarea"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder={t("releases.newModal.changelogHelper")}
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
              {changelog.trim() ? <MarkdownBlocks text={changelog} /> : <span className="md-preview-empty">{t("prd.nothingToPreview")}</span>}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      title={t("releases.newModal.title")}
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("releases.newModal.cancel")}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!name.trim()}>
            {t("releases.newModal.submit")}
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <Input label={t("releases.newModal.nameLabel")} autoFocus placeholder={t("releases.newModal.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="milestone-version">
              {t("releases.newModal.versionLabel")}
            </label>
            <input
              id="milestone-version"
              className="input"
              placeholder={t("releases.newModal.versionPlaceholder")}
              inputMode="decimal"
              value={version}
              onChange={(e) => setVersion(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="milestone-target">
              {t("releases.newModal.targetDateLabel")}
            </label>
            <input id="milestone-target" className="input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="milestone-status">
            {t("releases.newModal.statusLabel")}
          </label>
          <select id="milestone-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as MilestoneStatus)}>
            <option value="planned">{t("releases.optionStatus.planned")}</option>
            <option value="inProgress">{t("releases.optionStatus.inProgress")}</option>
            <option value="released">{t("releases.optionStatus.released")}</option>
          </select>
        </div>
        {changelogField}
      </div>
    </Modal>
  );
}
