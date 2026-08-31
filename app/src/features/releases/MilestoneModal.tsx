import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatRelative } from "../../lib/utils";
import type { State, Milestone, MilestoneStatus } from "../../lib/types";
import type { UpdatePatch } from "../../state/project-context";
import { useProject } from "../../state/project-context";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { FileText, ArrowsOutSimple } from "@phosphor-icons/react";
import { LIMITS } from "../../lib/limits";

interface MilestoneModalProps {
  milestoneId: string | null;
  onClose: () => void;
}

export function MilestoneModal({ milestoneId, onClose }: MilestoneModalProps) {
  const { t } = useTranslation("project");
  const { state, dispatch } = useProject();
  const editSnapshot = useRef<State | null>(null);
  const changelogId = useId();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (milestoneId && state) {
      editSnapshot.current = structuredClone(state);
    }
  }, [milestoneId]);

  const milestone = milestoneId ? state?.milestones.find((m) => m.id === milestoneId) : undefined;
  usePresenceStatus("Editing milestone", milestone != null);

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
    <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FileText size={12} aria-hidden="true" /> {t("releases.modal.changelogLabel")}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          aria-label={t('tracker:issues.modal.fullscreenAriaDescription')}
          title={t('tracker:issues.modal.fullscreenAriaDescription')}
          onClick={() => setExpanded(true)}
        >
          <ArrowsOutSimple size={14} aria-hidden="true" />
        </button>
      </div>
      <textarea
        id={changelogId}
        className="textarea"
        rows={4}
        value={milestone.changelog}
        onChange={(e) => update({ changelog: e.target.value })}
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

  if (expanded) {
    return (
      <Modal
        open={milestoneId !== null}
        title={t("releases.modal.changelogLabel") + ` - Fullscreen`}
        onClose={() => setExpanded(false)}

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
                value={milestone.changelog}
                onChange={(e) => update({ changelog: e.target.value })}
                placeholder={t("releases.modal.changelogPlaceholder")}
                maxLength={20000}
                autoFocus
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
              <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                {milestone.changelog.trim() ? <div className="md-blocks" style={{ whiteSpace: 'pre-wrap' }}>{milestone.changelog}</div> : <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>}
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
        <Input label={t("releases.modal.nameLabel")} value={milestone.name} maxLength={LIMITS.MILESTONE_NAME} required showCount onChange={(e) => update({ name: e.target.value })} />
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
              maxLength={LIMITS.MILESTONE_VERSION}
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
