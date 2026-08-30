import { useEffect, useState } from "react";
import { FileText, Scales, ListChecks, ArrowsOutSimple } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { useProject } from "../../state/project-context";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { newId, nowIso } from "../../lib/utils";
import type { DecisionStatus } from "../../lib/types";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { MarkdownBlocks } from "../../lib/markdown";

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
  const [fullscreenField, setFullscreenField] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (fullscreenField) setFullscreenField(null);
  }, []);

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

  const mdTooltip = t("project:prd.mdTooltip");

  return (
    <>
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
          <Input label={t("decisions.newModal.titleLabel")} autoFocus placeholder={t("decisions.newModal.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
              <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Scales size={12} aria-hidden="true" /> {t("decisions.newModal.statusLabel")}
              </span>
              <select id="decision-status" className="select" style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value as DecisionStatus)}>
                <option value="proposed">{t("decisions.status.proposed")}</option>
                <option value="accepted">{t("decisions.status.accepted")}</option>
                <option value="rejected">{t("decisions.status.rejected")}</option>
                <option value="superseded">{t("decisions.status.superseded")}</option>
              </select>
              <input id="decision-date" className="input" type="date" style={{ width: 160 }} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
              <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
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

            {/* Context */}
            <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={12} aria-hidden="true" /> {t("decisions.newModal.contextLabel")}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {context.trim() && (
                    <span className="md-toggle" role="group" aria-label={t('project:prd.modeAria', { label: t("decisions.newModal.contextLabel") })}>
                      <button type="button" title={mdTooltip} className={`md-toggle-btn${preview.context ? '' : ' active'}`} aria-pressed={!preview.context} onClick={() => setPreview((p) => ({ ...p, context: false }))}>{t('project:prd.edit')}</button>
                      <button type="button" title={mdTooltip} className={`md-toggle-btn${preview.context ? ' active' : ''}`} aria-pressed={!!preview.context} onClick={() => setPreview((p) => ({ ...p, context: true }))}>{t('project:prd.preview')}</button>
                    </span>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('tracker:issues.modal.fullscreenAriaDescription')} title={t('tracker:issues.modal.fullscreenAriaDescription')} onClick={() => setFullscreenField('context')}>
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </span>
              </div>
              <textarea className="textarea" placeholder={t("decisions.newModal.contextPlaceholder")} rows={3} value={context} onChange={(e) => setContext(e.target.value)} maxLength={20000} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: context.length > 18000 ? 'var(--status-danger)' : context.length > 15000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {context.length.toLocaleString()} / {(20000).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Options */}
            <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ListChecks size={12} aria-hidden="true" /> {t("decisions.newModal.optionsLabel")}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {options.trim() && (
                    <span className="md-toggle" role="group" aria-label={t('project:prd.modeAria', { label: t("decisions.newModal.optionsLabel") })}>
                      <button type="button" title={mdTooltip} className={`md-toggle-btn${preview.options ? '' : ' active'}`} aria-pressed={!preview.options} onClick={() => setPreview((p) => ({ ...p, options: false }))}>{t('project:prd.edit')}</button>
                      <button type="button" title={mdTooltip} className={`md-toggle-btn${preview.options ? ' active' : ''}`} aria-pressed={!!preview.options} onClick={() => setPreview((p) => ({ ...p, options: true }))}>{t('project:prd.preview')}</button>
                    </span>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('tracker:issues.modal.fullscreenAriaDescription')} title={t('tracker:issues.modal.fullscreenAriaDescription')} onClick={() => setFullscreenField('options')}>
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </span>
              </div>
              <textarea className="textarea" placeholder={t("decisions.newModal.optionsPlaceholder")} rows={3} value={options} onChange={(e) => setOptions(e.target.value)} maxLength={1000} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: options.length > 900 ? 'var(--status-danger)' : options.length > 800 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {options.length.toLocaleString()} / {(1000).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Decision */}
            <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Scales size={12} aria-hidden="true" /> {t("decisions.newModal.decisionLabel")}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {decision.trim() && (
                    <span className="md-toggle" role="group" aria-label={t('project:prd.modeAria', { label: t("decisions.newModal.decisionLabel") })}>
                      <button type="button" title={mdTooltip} className={`md-toggle-btn${preview.decision ? '' : ' active'}`} aria-pressed={!preview.decision} onClick={() => setPreview((p) => ({ ...p, decision: false }))}>{t('project:prd.edit')}</button>
                      <button type="button" title={mdTooltip} className={`md-toggle-btn${preview.decision ? ' active' : ''}`} aria-pressed={!!preview.decision} onClick={() => setPreview((p) => ({ ...p, decision: true }))}>{t('project:prd.preview')}</button>
                    </span>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('tracker:issues.modal.fullscreenAriaDescription')} title={t('tracker:issues.modal.fullscreenAriaDescription')} onClick={() => setFullscreenField('decision')}>
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </span>
              </div>
              <textarea className="textarea" rows={3} value={decision} onChange={(e) => setDecision(e.target.value)} maxLength={20000} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: decision.length > 18000 ? 'var(--status-danger)' : decision.length > 15000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {decision.length.toLocaleString()} / {(20000).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Consequences */}
            <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={12} aria-hidden="true" /> {t("decisions.newModal.consequencesLabel")}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {consequences.trim() && (
                    <span className="md-toggle" role="group" aria-label={t('project:prd.modeAria', { label: t("decisions.newModal.consequencesLabel") })}>
                      <button type="button" title={mdTooltip} className={`md-toggle-btn${preview.consequences ? '' : ' active'}`} aria-pressed={!preview.consequences} onClick={() => setPreview((p) => ({ ...p, consequences: false }))}>{t('project:prd.edit')}</button>
                      <button type="button" title={mdTooltip} className={`md-toggle-btn${preview.consequences ? ' active' : ''}`} aria-pressed={!!preview.consequences} onClick={() => setPreview((p) => ({ ...p, consequences: true }))}>{t('project:prd.preview')}</button>
                    </span>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('tracker:issues.modal.fullscreenAriaDescription')} title={t('tracker:issues.modal.fullscreenAriaDescription')} onClick={() => setFullscreenField('consequences')}>
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </span>
              </div>
              <textarea className="textarea" placeholder={t("decisions.newModal.consequencesPlaceholder")} rows={2} value={consequences} onChange={(e) => setConsequences(e.target.value)} maxLength={10000} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: decision.length > 18000 ? 'var(--status-danger)' : decision.length > 15000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {decision.length.toLocaleString()} / {(20000).toLocaleString()}
                </span>
              </div>

            </div>

          </div>
        </div>
      </Modal>
      {fullscreenField && (
        <Modal open title={fullscreenField === "context" ? `${t('decisions.modal.contextLabel')} — Fullscreen` : fullscreenField === "options" ? `${t('decisions.modal.optionsLabel')} — Fullscreen` : fullscreenField === "decision" ? `${t('decisions.modal.decisionLabel')} - Fullscreen` : `${t('decisions.modal.consequencesLabel')} - Fullscreen`} onClose={() => setFullscreenField(null)} width="lg" className="modal-fullscreen">
          <div className="field">
            <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
                <textarea
                  className="textarea"
                  style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }}
                  value={
                    fullscreenField === 'context' ? context :
                      fullscreenField === 'options' ? options :
                        fullscreenField === 'decision' ? decision : consequences
                  }
                  autoFocus
                  onChange={(e) => {
                    if (fullscreenField === 'context') setContext(e.target.value);
                    else if (fullscreenField === 'options') setOptions(e.target.value);
                    else if (fullscreenField === 'decision') setDecision(e.target.value);
                    else setConsequences(e.target.value);
                  }}
                  maxLength={20000}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {(() => {
                    const text = fullscreenField === 'context' ? context : fullscreenField === 'options' ? options.split("\n").map((o) => `- ${o}`).join("\n") : fullscreenField === 'decision' ? decision : consequences;
                    return text.trim() ? <MarkdownBlocks text={text} /> : <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>;
                  })()}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{t('tracker:issues.modal.fullscreenHelper')}</p>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {(fullscreenField === 'context' ? context.length : fullscreenField === 'options' ? options.length : fullscreenField === 'decision' ? decision.length : consequences.length).toLocaleString()} / {(20000).toLocaleString()}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
