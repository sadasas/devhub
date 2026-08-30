import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProject } from "../../state/project-context";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { newId, nowIso } from "../../lib/utils";
import type { MilestoneStatus } from "../../lib/types";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { FileText, ArrowsOutSimple } from "@phosphor-icons/react";

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
  const [fullscreen, setFullscreen] = useState(false);

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
    <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FileText size={12} aria-hidden="true" /> {t("releases.newModal.changelogLabel")}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          aria-label={t('tracker:issues.modal.fullscreenAriaDescription')}
          title={t('tracker:issues.modal.fullscreenAriaDescription')}
          onClick={() => setFullscreen(true)}
        >
          <ArrowsOutSimple size={14} aria-hidden="true" />
        </button>
      </div>
      <textarea
        className="textarea"
        rows={4}
        value={changelog}
        onChange={(e) => setChangelog(e.target.value)}
        placeholder={t("releases.modal.changelogPlaceholder")}
        maxLength={20000}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: countTone, fontFamily: 'var(--font-mono)' }}>
          {count.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <Modal
        open
        title={t("releases.modal.changelogLabel") + ` - Fullscreen`}
        onClose={() => setFullscreen(false)}
        width="lg"
        className="modal-fullscreen"
      >
        <div className="field" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
              <textarea
                className="textarea"
                style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }}
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder={t("releases.modal.changelogPlaceholder")}
                maxLength={20000}
                autoFocus
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
              <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                {changelog.trim() ? <div className="md-blocks" style={{ whiteSpace: 'pre-wrap' }}>{changelog}</div> : <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <p className="field-helper" style={{ margin: 0 }}>{t('tracker:issues.modal.fullscreenHelper')}</p>
            <span style={{ fontSize: 11, color: countTone, fontFamily: 'var(--font-mono)' }}>{count.toLocaleString()} / {limit.toLocaleString()}</span>
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
        <Input label={t("releases.newModal.nameLabel")} autoFocus placeholder={t("releases.newModal.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} maxLength={300} />
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
              maxLength={100}
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
