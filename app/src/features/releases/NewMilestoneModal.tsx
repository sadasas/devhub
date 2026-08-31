import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProject } from "../../state/project-context";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { newId, nowIso } from "../../lib/utils";
import type { MilestoneStatus } from "../../lib/types";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { FileText } from "@phosphor-icons/react";
import { MarkdownField } from "../../components/MarkdownField";

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
        <Input
          label={t("releases.newModal.nameLabel")}
          autoFocus
          placeholder={t("releases.newModal.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={300}
          required
          showCount
        />
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
        <MarkdownField
          label={t("releases.newModal.changelogLabel")}
          icon={FileText}
          value={changelog}
          onChange={setChangelog}
          placeholder={t("releases.modal.changelogPlaceholder")}
          helper={t("releases.newModal.changelogHelper")}
          maxLength={20000}
          rows={4}
        />
      </div>
    </Modal>
  );
}
