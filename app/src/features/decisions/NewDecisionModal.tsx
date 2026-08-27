import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProject } from "../../state/project-context";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { newId, nowIso } from "../../lib/utils";
import type { DecisionStatus } from "../../lib/types";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { Textarea } from "../../components/Textarea";

interface NewDecisionModalProps {
  onClose: () => void;
}

export function NewDecisionModal({ onClose }: NewDecisionModalProps) {
  const { t } = useTranslation("project");
  const { dispatch, state } = useProject();
  usePresenceStatus("Creating decision");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<DecisionStatus>("proposed");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [context, setContext] = useState("");
  const [options, setOptions] = useState("");
  const [decision, setDecision] = useState("");
  const [consequences, setConsequences] = useState("");
  const [milestoneId, setMilestoneId] = useState<string | null>(null);

  const submit = () => {
    if (!title.trim()) return;
    const ts = nowIso();
    dispatch({
      type: "decision/add",
      decision: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        title: title.trim(),
        status,
        date: date || ts.slice(0, 10),
        context: context.trim(),
        options: options.split("\n").map((o) => o.trim()).filter(Boolean).slice(0, 20),
        decision: decision.trim(),
        consequences: consequences.trim(),
        milestoneId: milestoneId ?? null,
      },
    });
    onClose();
  };

  return (
    <Modal
      open
      title={t("decisions.newModal.title")}
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("decisions.newModal.cancel")}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!title.trim()}>
            {t("decisions.newModal.submit")}
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <Input label={t("decisions.newModal.titleLabel")} autoFocus placeholder={t("decisions.newModal.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="decision-status">
              {t("decisions.newModal.statusLabel")}
            </label>
            <select id="decision-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as DecisionStatus)}>
              <option value="proposed">{t("decisions.status.proposed")}</option>
              <option value="accepted">{t("decisions.status.accepted")}</option>
              <option value="rejected">{t("decisions.status.rejected")}</option>
              <option value="superseded">{t("decisions.status.superseded")}</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="decision-date">
              {t("decisions.newModal.dateLabel")}
            </label>
            <input id="decision-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <SearchableSelect
            id="decision-milestone"
            label={t("decisions.modal.milestoneLabel", { defaultValue: "Milestone" })}
            value={milestoneId}
            options={(state?.milestones ?? []).map((m) => ({ value: m.id, label: m.name }))}
            onChange={setMilestoneId}
          />
        </div>
        <Textarea label={t("decisions.newModal.contextLabel")} placeholder={t("decisions.newModal.contextPlaceholder")} rows={3} value={context} onChange={(e) => setContext(e.target.value)} />
        <Textarea label={t("decisions.newModal.optionsLabel")} helper={t("decisions.newModal.optionsHelper")} placeholder={t("decisions.newModal.optionsPlaceholder")} rows={3} value={options} onChange={(e) => setOptions(e.target.value)} />
        <Textarea label={t("decisions.newModal.decisionLabel")} rows={3} value={decision} onChange={(e) => setDecision(e.target.value)} />
        <Textarea label={t("decisions.newModal.consequencesLabel")} placeholder={t("decisions.newModal.consequencesPlaceholder")} rows={2} value={consequences} onChange={(e) => setConsequences(e.target.value)} />
      </div>
    </Modal>
  );
}
