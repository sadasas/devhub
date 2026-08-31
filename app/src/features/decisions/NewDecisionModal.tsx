import { useState } from "react";
import { FileText, Scales, ListChecks } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { useProject } from "../../state/project-context";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { newId, nowIso } from "../../lib/utils";
import type { DecisionStatus } from "../../lib/types";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { MarkdownField } from "../../components/MarkdownField";

interface NewDecisionModalProps {
  onClose: () => void;
}

export function NewDecisionModal({ onClose }: NewDecisionModalProps) {
  const { t } = useTranslation(["project", "tracker"]);
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
      width="lg"
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
        <Input
          label={t("decisions.newModal.titleLabel")}
          autoFocus
          placeholder={t("decisions.newModal.titlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          required
          showCount
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span
              style={{
                width: 110,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
              }}
            >
              <Scales size={12} aria-hidden="true" /> {t("decisions.newModal.statusLabel")}
            </span>
            <select
              id="decision-status"
              className="select"
              style={{ width: 160 }}
              value={status}
              onChange={(e) => setStatus(e.target.value as DecisionStatus)}
            >
              <option value="proposed">{t("decisions.status.proposed")}</option>
              <option value="accepted">{t("decisions.status.accepted")}</option>
              <option value="rejected">{t("decisions.status.rejected")}</option>
              <option value="superseded">{t("decisions.status.superseded")}</option>
            </select>
            <input
              id="decision-date"
              className="input"
              type="date"
              style={{ width: 160 }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span
              style={{
                width: 110,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
              }}
            >
              <Scales size={12} aria-hidden="true" /> {t("decisions.modal.milestoneLabel", { defaultValue: "Milestone" })}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SearchableSelect
                id="decision-milestone"
                label=""
                value={milestoneId}
                options={(state?.milestones ?? []).map((m) => ({ value: m.id, label: m.name }))}
                onChange={setMilestoneId}
              />
            </div>
          </div>

          <MarkdownField
            label={t("decisions.newModal.contextLabel")}
            icon={FileText}
            value={context}
            onChange={setContext}
            placeholder={t("decisions.newModal.contextPlaceholder")}
            maxLength={20000}
            rows={3}
          />

          <MarkdownField
            label={t("decisions.newModal.optionsLabel")}
            icon={ListChecks}
            value={options}
            onChange={setOptions}
            placeholder={t("decisions.newModal.optionsPlaceholder")}
            helper={t("decisions.newModal.optionsHelper")}
            maxLength={1000}
            rows={3}
          />

          <MarkdownField
            label={t("decisions.newModal.decisionLabel")}
            icon={Scales}
            value={decision}
            onChange={setDecision}
            maxLength={20000}
            rows={3}
          />

          <MarkdownField
            label={t("decisions.newModal.consequencesLabel")}
            icon={FileText}
            value={consequences}
            onChange={setConsequences}
            placeholder={t("decisions.newModal.consequencesPlaceholder")}
            maxLength={10000}
            rows={2}
          />
        </div>
      </div>
    </Modal>
  );
}
