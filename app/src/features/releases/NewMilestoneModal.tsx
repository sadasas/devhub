import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CalendarBlank as CalendarIcon, FileText, Hash, Plus } from "@phosphor-icons/react";
import { useProject } from "../../state/project-context";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { formatDate, newId, nowIso } from "../../lib/utils";
import type { MilestoneStatus } from "../../lib/types";
import { Button } from "../../components/Button";
import { DatePicker } from "../../components/DatePicker";
import { Modal } from "../../components/Modal";
import { MarkdownField } from "../../components/MarkdownField";
import { SearchableSelect } from "../../components/SearchableSelect";
import { LIMITS } from "../../lib/limits";

interface NewMilestoneModalProps {
  onClose: () => void;
}

const STATUS_OPTIONS: MilestoneStatus[] = ["planned", "inProgress", "released"];

export function NewMilestoneModal({ onClose }: NewMilestoneModalProps) {
  const { t } = useTranslation("project");
  const { dispatch } = useProject();
  usePresenceStatus("Creating milestone");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState<MilestoneStatus | "">("");
  const [changelog, setChangelog] = useState("");
  const [datesOpen, setDatesOpen] = useState(false);
  const datePillRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionDraft, setVersionDraft] = useState("");
  const [versionAnchor, setVersionAnchor] = useState<{ top: number; bottom: number; left: number } | null>(null);
  const [versionPos, setVersionPos] = useState<{ top: number; left: number } | null>(null);
  const versionPillRef = useRef<HTMLButtonElement>(null);
  const versionPopRef = useRef<HTMLDivElement | null>(null);
  const versionCancelRef = useRef(false);

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
      if (versionPopRef.current?.contains(el as Node) || el?.closest?.('[data-pop-anchor="version"]')) return;
      setVersionOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        versionCancelRef.current = true;
        setVersionOpen(false);
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

  const openVersionPopup = (anchor: HTMLElement | null) => {
    setDatesOpen(false);
    versionCancelRef.current = false;
    setVersionDraft(version);
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      setVersionAnchor({ top: r.top, bottom: r.bottom, left: r.left });
    } else {
      setVersionAnchor({ top: 0, bottom: 0, left: 0 });
    }
    setVersionPos(null);
    setVersionOpen(true);
  };

  const commitVersionDraft = () => {
    if (versionCancelRef.current) {
      versionCancelRef.current = false;
      return;
    }
    setVersion(versionDraft);
    setVersionOpen(false);
  };

  const cancelVersionPopup = () => {
    versionCancelRef.current = true;
    setVersionOpen(false);
  };

  const statusLabels: Record<MilestoneStatus, string> = {
    planned: t("releases.optionStatus.planned"),
    inProgress: t("releases.optionStatus.inProgress"),
    released: t("releases.optionStatus.released"),
  };

  const statusDot =
    status === "released"
      ? "var(--status-success)"
      : status === "inProgress"
        ? "var(--status-info)"
        : "var(--text-muted)";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const ts = nowIso();
    const effectiveVersion = versionOpen ? versionDraft : version;
    dispatch({
      type: "milestone/add",
      milestone: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        version: effectiveVersion.trim().replace(/^v+/i, "") || null,
        targetDate: targetDate || null,
        status: status === "" ? "planned" : status,
        changelog: changelog.trim(),
      },
    });
    onClose();
  };

  return (
    <Modal
      open
      title={t("releases.newModal.title")}
      onClose={onClose}
      width="lg"
      className="modal-composer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("releases.newModal.cancel")}
          </Button>
          <Button variant="primary" type="submit" form="new-milestone-form" leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />} disabled={!name.trim()}>
            {t("releases.newModal.submit")}
          </Button>
        </>
      }
    >
      <form id="new-milestone-form" className="composer-form" onSubmit={submit} noValidate>
        <div className="composer-scroll">
          <textarea
            ref={titleRef}
            className="composer-title"
            rows={1}
            required
            autoFocus
            placeholder={t("releases.newModal.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.MILESTONE_NAME}
            aria-label={t("releases.newModal.nameLabel")}
          />
          <MarkdownField
            label={t("releases.newModal.changelogLabel")}
            icon={FileText}
            value={changelog}
            onChange={setChangelog}
            placeholder={t("releases.modal.changelogPlaceholder")}
            helper={t("releases.newModal.changelogHelper")}
            maxLength={LIMITS.MILESTONE_CHANGELOG}
            rows={4}
            variant="bare"
            previewToggle
          />
        </div>
        <div className="composer-propbar">
          <span
            className="prop"
            data-prop="status"
            data-label={t("releases.newModal.statusLabel")}
          >
            <span className="dot" style={{ background: statusDot }} aria-hidden="true" />
            <SearchableSelect
              id="new-milestone-status"
              label=""
              ariaLabel={t("releases.newModal.statusLabel")}
              searchable={false}
              value={status || null}
              allowEmpty={false}
              triggerEmptyLabel={t("releases.newModal.statusLabel")}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: statusLabels[s] }))}
              onChange={(v) => { if (v) setStatus(v as MilestoneStatus); }}
            />
          </span>

          <button
            type="button"
            className="prop"
            data-prop="version"
            data-label={t("releases.newModal.versionLabel")}
            data-pop-anchor="version"
            ref={versionPillRef}
            onClick={(e) => (versionOpen ? commitVersionDraft() : openVersionPopup(e.currentTarget))}
          >
            <span className="prop-ic" aria-hidden="true"><Hash size={14} /></span>
            <span className="prop-text">{version ? version : t("releases.newModal.versionLabel")}</span>
          </button>
          {versionOpen && createPortal(
            <div
              ref={versionPopRef}
              className="prop-menu prop-pop"
              role="dialog"
              tabIndex={-1}
              aria-label={t("releases.newModal.versionLabel")}
              style={versionPos ? { top: versionPos.top, left: versionPos.left } : { visibility: "hidden" }}
            >
              <div className="prop-pop-label">{t("releases.newModal.versionLabel")}</div>
              <input
                autoFocus
                id="new-milestone-version"
                className="input"
                placeholder={t("releases.newModal.versionLabel")}
                inputMode="decimal"
                value={versionDraft}
                maxLength={LIMITS.MILESTONE_VERSION}
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
                aria-label={t("releases.newModal.versionLabel")}
              />
            </div>,
            document.body,
          )}

          <button
            type="button"
            className="prop"
            data-prop="targetDate"
            data-label={t("releases.newModal.targetDateLabel")}
            data-pop-anchor="targetDate"
            ref={datePillRef}
            onClick={() => {
              if (versionOpen) commitVersionDraft();
              setDatesOpen((v) => !v);
            }}
          >
            <span className="prop-ic" aria-hidden="true"><CalendarIcon size={14} /></span>
            <span className="prop-text">{targetDate ? formatDate(targetDate) : t("releases.newModal.targetDateLabel")}</span>
          </button>
          {datesOpen && (
            <DatePicker
              id="new-milestone-targetDate"
              mode="single"
              start={targetDate ? targetDate.slice(0, 10) : null}
              end={null}
              anchorEl={datePillRef.current}
              onApply={(s) => { setTargetDate(s ?? ""); setDatesOpen(false); }}
              onClose={() => setDatesOpen(false)}
            />
          )}
        </div>
      </form>
    </Modal>
  );
}
