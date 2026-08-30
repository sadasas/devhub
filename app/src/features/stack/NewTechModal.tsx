import { useEffect, useState } from "react";
import { FileText, ArrowsOutSimple } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { useProject } from "../../state/project-context";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { newId, nowIso } from "../../lib/utils";
import type { TechEntryCategory, TechStatus } from "../../lib/types";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { MarkdownBlocks } from "../../lib/markdown";

interface NewTechModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewTechModal({ open, onClose }: NewTechModalProps) {
  const { t } = useTranslation(["project","tracker"]);
  const { dispatch } = useProject();
  usePresenceStatus("Creating tech entry", open);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [category, setCategory] = useState<TechEntryCategory>("frontend");
  const [status, setStatus] = useState<TechStatus>("current");
  const [notes, setNotes] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setVersion("");
      setCategory("frontend");
      setStatus("current");
      setNotes("");
      setFullscreen(false);
      setPreview(false);
    }
  }, [open]);

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
        status,
        notes: notes.trim(),
      },
    });
    setName("");
    setVersion("");
    setCategory("frontend");
    setStatus("current");
    setNotes("");
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        title={t("stack.newTechModal.title")}
        onClose={fullscreen ? () => setFullscreen(false) : onClose}
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              {t("stack.newTechModal.cancel")}
            </Button>
            <Button variant="primary" onClick={submit} disabled={!name.trim()}>
              {t("stack.newTechModal.submit")}
            </Button>
          </>
        }
      >
        <div className="form-stack">
          <Input label={t("stack.newTechModal.nameLabel")} required autoFocus placeholder={t("stack.newTechModal.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          <Input
            label={t("stack.newTechModal.versionLabel")}
            placeholder={t("stack.newTechModal.versionPlaceholder")}
            value={version}
            onChange={(e) => setVersion(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            pattern="[0-9.]*"
            maxLength={100}
          />
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="new-tech-category">
                {t("stack.newTechModal.categoryLabel")}
              </label>
              <select
                id="new-tech-category"
                className="select"
                value={category}
                onChange={(e) => setCategory(e.target.value as TechEntryCategory)}
              >
                <option value="frontend">{t("stack.optionCategory.frontend")}</option>
                <option value="backend">{t("stack.optionCategory.backend")}</option>
                <option value="database">{t("stack.optionCategory.database")}</option>
                <option value="tooling">{t("stack.optionCategory.tooling")}</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="new-tech-status">
                {t("stack.newTechModal.statusLabel")}
              </label>
              <select
                id="new-tech-status"
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value as TechStatus)}
              >
                <option value="current">{t("stack.optionStatus.current")}</option>
                <option value="updateAvailable">{t("stack.optionStatus.updateAvailable")}</option>
                <option value="majorUpgrade">{t("stack.optionStatus.majorUpgrade")}</option>
              </select>
            </div>
          </div>

          {/* Catatan card - disamakan dengan Task/Issue */}
          <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16, marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FileText size={12} aria-hidden="true" /> {t("stack.newTechModal.notesLabel")}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {notes.trim() && (
                  <span className="md-toggle" role="group" aria-label={t('project:prd.modeAria', { label: t("stack.newTechModal.notesLabel") })}>
                    <button
                      type="button"
                      title={t('project:prd.mdTooltip')}
                      className={`md-toggle-btn${preview ? '' : ' active'}`}
                      aria-pressed={!preview}
                      onClick={() => setPreview(false)}
                    >
                      {t('project:prd.edit')}
                    </button>
                    <button
                      type="button"
                      title={t('project:prd.mdTooltip')}
                      className={`md-toggle-btn${preview ? ' active' : ''}`}
                      aria-pressed={!!preview}
                      onClick={() => setPreview(true)}
                    >
                      {t('project:prd.preview')}
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  aria-label={t('tracker:issues.modal.fullscreenAriaDescription')}
                  title={t('tracker:issues.modal.fullscreenAriaDescription')}
                  onClick={() => setFullscreen(true)}
                >
                  <ArrowsOutSimple size={14} aria-hidden="true" />
                </button>
              </span>
            </div>
            {preview ? (
              <div className="md-preview">
                {notes.trim() ? <MarkdownBlocks text={notes} /> : <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>}
              </div>
            ) : (
              <textarea
                className="textarea"
                rows={4}
                placeholder={t("stack.newTechModal.notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={5000}
                aria-label={t("stack.newTechModal.notesLabel")}
              />
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: notes.length > 4500 ? 'var(--status-danger)' : notes.length > 4000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {notes.length.toLocaleString()} / {(5000).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </Modal>
      {fullscreen && (
        <Modal
          open
          title={`${t("stack.newTechModal.notesLabel")} — Fullscreen`}
          onClose={() => setFullscreen(false)}
          width="lg"
          className="modal-fullscreen"
        >
          <div className="field">
            <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
                <textarea
                  className="textarea"
                  style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }}
                  value={notes}
                  autoFocus
                  placeholder={t("stack.newTechModal.notesPlaceholder")}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={5000}
                  aria-label={t("stack.newTechModal.notesLabel")}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {notes.trim() ? <MarkdownBlocks text={notes} /> : <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{t('tracker:issues.modal.fullscreenHelper')}</p>
              <span style={{ fontSize: 11, color: notes.length > 4500 ? 'var(--status-danger)' : notes.length > 4000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {notes.length.toLocaleString()} / {(5000).toLocaleString()}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
