import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Flag, Hash, Plus, Tag } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { useProject } from "../../state/project-context";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { newId, nowIso } from "../../lib/utils";
import type { TechEntryCategory, TechStatus } from "../../lib/types";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { MarkdownField } from "../../components/MarkdownField";
import { SearchableSelect } from "../../components/SearchableSelect";
import { FE_LIMITS } from "../../lib/limits";

interface NewTechModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_OPTIONS: TechEntryCategory[] = ["frontend", "backend", "database", "tooling"];
const STATUS_OPTIONS: TechStatus[] = ["current", "updateAvailable", "majorUpgrade"];

export function NewTechModal({ open, onClose }: NewTechModalProps) {
  const { t } = useTranslation(["project","tracker"]);
  const { dispatch } = useProject();
  usePresenceStatus("Creating tech entry", open);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [category, setCategory] = useState<TechEntryCategory>("frontend");
  const [status, setStatus] = useState<TechStatus | "">("");
  const [notes, setNotes] = useState("");
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const [popup, setPopup] = useState<{ key: "version"; anchor: { top: number; bottom: number; left: number } } | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [versionDraft, setVersionDraft] = useState("");
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setVersion("");
      setCategory("frontend");
      setStatus("");
      setNotes("");
      setPopup(null);
      setPopupPos(null);
      setVersionDraft("");
      cancelRef.current = false;
    }
  }, [open]);

  // Judul autogrow tanpa batas — yang scroll .composer-scroll, bukan textarea.
  useLayoutEffect(() => {
    const ta = titleRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  });

  useEffect(() => {
    if (!popup) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (popRef.current?.contains(target as Node) || target?.closest?.('[data-pop-anchor]')) return;
      setVersion(versionDraft);
      setPopup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelRef.current = true;
        setPopup(null);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [popup, versionDraft]);

  // Ukur tinggi asli panel setelah render (sebelum paint) lalu tempelkan ke pill.
  const measurePopup = useCallback(() => {
    if (!popup) return;
    const h = popRef.current?.offsetHeight ?? 0;
    const w = 240;
    const below = popup.anchor.bottom + 6;
    const fitsBelow = window.innerHeight - below >= h + 8;
    const next = {
      top: fitsBelow ? below : Math.max(8, popup.anchor.top - h - 6),
      left: Math.max(8, Math.min(popup.anchor.left, window.innerWidth - w - 8)),
    };
    setPopupPos((prev) => (prev && prev.top === next.top && prev.left === next.left ? prev : next));
  }, [popup]);

  useLayoutEffect(() => {
    measurePopup();
  }, [measurePopup]);

  useEffect(() => {
    if (!popup) return;
    window.addEventListener('resize', measurePopup);
    return () => window.removeEventListener('resize', measurePopup);
  }, [popup, measurePopup]);

  function openVersionPopup(anchor: HTMLElement) {
    cancelRef.current = false;
    setVersionDraft(version);
    const r = anchor.getBoundingClientRect();
    setPopup({ key: 'version', anchor: { top: r.top, bottom: r.bottom, left: r.left } });
    setPopupPos(null);
  }

  const commitVersion = () => {
    if (cancelRef.current) return;
    setVersion(versionDraft);
    setPopup(null);
  };

  const cancelVersion = () => {
    cancelRef.current = true;
    setPopup(null);
  };

  const submit = () => {
    if (!name.trim()) return;
    const ts = nowIso();
    dispatch({
      type: "tech/add",
      entry: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        version: version.trim().replace(/[^0-9.]/g, ""),
        category,
        status: status === "" ? "current" : status,
        notes: notes.trim(),
      },
    });
    setName("");
    setVersion("");
    setCategory("frontend");
    setStatus("");
    setNotes("");
    onClose();
  };

  const categoryLabel = t("stack.newTechModal.categoryLabel");
  const statusLabel = t("stack.newTechModal.statusLabel");
  const versionLabel = t("stack.newTechModal.versionLabel");

  const categoryControl = (
    <SearchableSelect
      id="new-tech-category"
      label=""
      ariaLabel={categoryLabel}
      value={category}
      allowEmpty={false}
      searchable={false}
      options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: t(`stack.optionCategory.${c}`) }))}
      onChange={(v) => { if (v) setCategory(v as TechEntryCategory); }}
    />
  );

  const statusControl = (
    <SearchableSelect
      id="new-tech-status"
      label=""
      ariaLabel={statusLabel}
      value={status === "" ? null : status}
      allowEmpty
      emptyLabel={statusLabel}
      triggerEmptyLabel={statusLabel}
      searchable={false}
      options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`stack.optionStatus.${s}`) }))}
      onChange={(v) => setStatus(v === null ? "" : (v as TechStatus))}
    />
  );

  const versionControl = (
    <input
      className="input"
      aria-label={versionLabel}
      placeholder={versionLabel}
      value={versionDraft}
      onChange={(e) => setVersionDraft(e.target.value.replace(/[^0-9.]/g, ""))}
      inputMode="decimal"
      pattern="[0-9.]*"
      maxLength={FE_LIMITS.TECH_VERSION}
      autoFocus
      onBlur={() => { if (!cancelRef.current) commitVersion(); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commitVersion(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelVersion(); }
      }}
    />
  );

  return (
    <Modal
      open={open}
      title={t("stack.newTechModal.title")}
      onClose={onClose}
      width="lg"
      className="modal-composer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("stack.newTechModal.cancel")}
          </Button>
          <Button variant="primary" leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />} onClick={submit} disabled={!name.trim()}>
            {t("stack.newTechModal.submit")}
          </Button>
        </>
      }
    >
      <div className="composer-scroll">
        <textarea
          ref={titleRef}
          className="composer-title"
          rows={1}
          required
          autoFocus
          placeholder={t("stack.newTechModal.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={FE_LIMITS.TECH_NAME}
          aria-label={t("stack.newTechModal.nameLabel")}
        />
        <MarkdownField
          label={t("stack.newTechModal.notesLabel")}
          icon={FileText}
          value={notes}
          onChange={setNotes}
          placeholder={t("stack.newTechModal.notesPlaceholder")}
          maxLength={FE_LIMITS.TECH_NOTES}
          rows={4}
          variant="bare"
          previewToggle
        />
      </div>
      <div className="composer-propbar">
        <span className="prop" data-prop="category" data-label={categoryLabel}>
          <span className="prop-ic" aria-hidden="true"><Tag size={14} /></span>
          <span className="sr-only">{categoryLabel}</span>
          {categoryControl}
        </span>
        <span className="prop" data-prop="status" data-label={statusLabel}>
          <span className="prop-ic" aria-hidden="true"><Flag size={14} /></span>
          <span className="sr-only">{statusLabel}</span>
          {statusControl}
        </span>
        <button
          type="button"
          className="prop"
          data-prop="version"
          data-label={versionLabel}
          data-pop-anchor="version"
          onClick={(e) => (popup ? (setVersion(versionDraft), setPopup(null)) : openVersionPopup(e.currentTarget))}
        >
          <span className="prop-ic" aria-hidden="true"><Hash size={14} /></span>
          <span className="prop-text">{version === "" ? versionLabel : version}</span>
        </button>
      </div>
      {popup && createPortal(
        <div
          ref={popRef}
          className="prop-menu prop-pop"
          role="dialog"
          tabIndex={-1}
          aria-label={versionLabel}
          style={popupPos ? { top: popupPos.top, left: popupPos.left } : { visibility: 'hidden' }}
        >
          <div className="prop-pop-label">{versionLabel}</div>
          {versionControl}
        </div>,
        document.body,
      )}
    </Modal>
  );
}
