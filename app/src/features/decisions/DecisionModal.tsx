import { useEffect, useState } from "react";
import { Trash, FileText, Scales, CalendarBlank as CalendarIcon, Tag, ArrowsOutSimple, ListChecks } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { DECISION_STATUS } from "../../lib/labels";
import { formatRelative } from "../../lib/utils";
import type { Decision, DecisionStatus } from "../../lib/types";
import type { UpdatePatch } from "../../state/project-context";
import { useProject } from "../../state/project-context";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { ActivityList } from "../../components/ActivityList";
import { Button } from "../../components/Button";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { DetailEmpty } from "../../components/DetailList";
import { Modal } from "../../components/Modal";
import { SearchableSelect } from "../../components/SearchableSelect";
import { MarkdownBlocks } from "../../lib/markdown";

type ActiveField = 'title' | 'status' | 'date' | 'milestone' | 'context' | 'options' | 'decision' | 'consequences' | null;

interface DecisionModalProps {
  decisionId: string | null;
  onClose: () => void;
}

export function DecisionModal({ decisionId, onClose }: DecisionModalProps) {
  const { t } = useTranslation(['project', 'tracker']);
  const { state, dispatch, canEdit, projectId } = useProject();
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fullscreenField, setFullscreenField] = useState<ActiveField>(null);

  useEffect(() => {
    setActiveField(null);
    setConfirmOpen(false);
    setFullscreenField(null);
  }, [decisionId]);

  const decision = decisionId ? state?.decisions.find((d) => d.id === decisionId) : undefined;
  usePresenceStatus("Editing decision", decision != null);
  if (!state || !decision) return null;

  const update = (patch: UpdatePatch<Decision>) => {
    dispatch({ type: "decision/update", id: decision.id, patch });
  };

  const remove = () => {
    dispatch({ type: "decision/remove", id: decision.id });
    onClose();
  };

  const milestone = decision.milestoneId ? state.milestones.find((m) => m.id === decision.milestoneId) : undefined;

  return (
    <>
      <Modal
        open={decisionId !== null}
        title={t("decisions.modal.viewTitle")}
        onClose={fullscreenField ? () => setFullscreenField(null) : onClose}
        width="lg"
        footer={
          canEdit ? (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t("decisions.modal.delete")}
            </Button>
          ) : undefined
        }
      >
        <div className="form-stack">
          <>
            {activeField === 'title' && canEdit ? (
              <input
                className="input"
                value={decision.title}
                autoFocus
                onChange={(e) => update({ title: e.target.value })}
                onBlur={() => setActiveField(null)}
                onKeyDown={(e) => { if (e.key === 'Enter') setActiveField(null); if (e.key === 'Escape') setActiveField(null); }}
                aria-label={t("decisions.modal.titleLabel")}
                maxLength={300}
              />
            ) : (
              <h3
                className="detail-title"
                onClick={() => canEdit && setActiveField('title')}
                style={{ cursor: canEdit ? 'text' : undefined, padding: '4px 6px', margin: '-4px -6px', borderRadius: 6 }}
                onMouseEnter={(e) => { if (canEdit) (e.currentTarget as HTMLElement).style.background = 'var(--bg-inset)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                title={canEdit ? t('issues.modal.clickToEdit') : undefined}
                role={canEdit ? 'button' : undefined}
                tabIndex={canEdit ? 0 : undefined}
                onKeyDown={(e) => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActiveField('title'); } }}
              >
                {decision.title || <DetailEmpty>{t("decisions.modal.noContext")}</DetailEmpty>}
              </h3>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Scales size={12} aria-hidden="true" /> {t("decisions.modal.statusLabel")}
                </span>
                {activeField === 'status' && canEdit ? (
                  <select className="select" style={{ width: 160 }} value={decision.status} autoFocus onChange={(e) => { update({ status: e.target.value as DecisionStatus }); setActiveField(null); }} onBlur={() => setActiveField(null)}>
                    <option value="proposed">{t("decisions.status.proposed")}</option>
                    <option value="accepted">{t("decisions.status.accepted")}</option>
                    <option value="rejected">{t("decisions.status.rejected")}</option>
                    <option value="superseded">{t("decisions.status.superseded")}</option>
                  </select>
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('status')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: decision.status === 'accepted' ? 'var(--status-success-dim)' : decision.status === 'rejected' ? 'var(--status-danger-dim)' : decision.status === 'superseded' ? 'var(--bg-inset)' : 'var(--status-info-dim)', border: decision.status === 'superseded' ? '1px solid var(--border-hairline)' : 'none', cursor: canEdit ? 'pointer' : 'default', fontSize: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: DECISION_STATUS[decision.status].tone === 'success' ? 'var(--status-success)' : DECISION_STATUS[decision.status].tone === 'danger' ? 'var(--status-danger)' : DECISION_STATUS[decision.status].tone === 'info' ? 'var(--status-info)' : 'var(--text-muted)', flexShrink: 0 }} />
                    {t(`decisions.status.${decision.status}`)}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <CalendarIcon size={12} aria-hidden="true" /> {t("decisions.modal.dateLabel")}
                </span>
                {activeField === 'date' && canEdit ? (
                  <input className="input" type="date" style={{ width: 160 }} value={decision.date.slice(0, 10)} autoFocus onChange={(e) => update({ date: e.target.value })} onBlur={() => setActiveField(null)} />
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('date')} style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {decision.date.slice(0, 10)}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <Tag size={12} aria-hidden="true" /> {t("decisions.modal.milestoneLabel", { defaultValue: "Milestone" })}
                </span>
                {activeField === 'milestone' && canEdit ? (
                  <SearchableSelect id="decision-milestone" label="" value={decision.milestoneId ?? null} options={state.milestones.map((m) => ({ value: m.id, label: m.name }))} onChange={(v) => { update({ milestoneId: v }); setActiveField(null); }} />
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('milestone')} style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', fontSize: 13, color: milestone ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {milestone ? milestone.name : t("decisions.modal.noMilestone", { defaultValue: "No milestone" })}
                  </button>
                )}
              </div>

              {/* Context */}
              <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16, marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={12} aria-hidden="true" /> {t("decisions.modal.contextLabel")}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('tracker:issues.modal.fullscreenAriaDescription')} title={t('tracker:issues.modal.fullscreenAriaDescription')} onClick={() => setFullscreenField('context')}>
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </div>
                {activeField === 'context' && canEdit ? (
                  <>
                    <textarea className="textarea" value={decision.context} autoFocus rows={3} placeholder={t("decisions.newModal.contextPlaceholder")} onChange={(e) => update({ context: e.target.value })} onBlur={() => setActiveField(null)} aria-label={t("decisions.modal.contextLabel")} maxLength={20000} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: decision.context.length > 18000 ? 'var(--status-danger)' : decision.context.length > 15000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {decision.context.length.toLocaleString()} / {(20000).toLocaleString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div onClick={() => canEdit && setActiveField('context')} role={canEdit ? 'button' : undefined} tabIndex={canEdit ? 0 : undefined} onKeyDown={(e) => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActiveField('context'); } }} style={{ cursor: canEdit ? 'text' : undefined, fontSize: 13, lineHeight: 1.6, color: decision.context.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', minHeight: 40, overflowWrap: 'anywhere' }}>
                    {decision.context.trim() ? <MarkdownBlocks text={decision.context} /> : t("decisions.modal.noContext")}
                  </div>
                )}
              </div>

              {/* Options */}
              <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ListChecks size={12} aria-hidden="true" /> {t("decisions.modal.optionsLabel")}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('tracker:issues.modal.fullscreenAriaDescription')} title={t('tracker:issues.modal.fullscreenAriaDescription')} onClick={() => setFullscreenField('options')}>
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </div>
                {activeField === 'options' && canEdit ? (
                  <>
                    <textarea className="textarea" value={decision.options.join("\n")} autoFocus rows={3} placeholder={t("decisions.newModal.optionsPlaceholder")} onChange={(e) => update({ options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean).slice(0, 20) })} onBlur={() => setActiveField(null)} aria-label={t("decisions.modal.optionsLabel")} maxLength={1000} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: decision.options.join("\n").length > 900 ? 'var(--status-danger)' : decision.options.join("\n").length > 800 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {decision.options.join("\n").length.toLocaleString()} / {(1000).toLocaleString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div onClick={() => canEdit && setActiveField('options')} role={canEdit ? 'button' : undefined} tabIndex={canEdit ? 0 : undefined} onKeyDown={(e) => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActiveField('options'); } }} style={{ cursor: canEdit ? 'text' : undefined, fontSize: 13, lineHeight: 1.6, color: decision.options.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', minHeight: 40, overflowWrap: 'anywhere' }}>
                    {decision.options.length > 0 ? (
                      <div className="md-preview"><MarkdownBlocks text={decision.options.map((o) => `- ${o}`).join("\n")} /></div>
                    ) : t("decisions.modal.noOptions")}
                  </div>
                )}
              </div>

              {/* Decision */}
              <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Scales size={12} aria-hidden="true" /> {t("decisions.modal.decisionLabel")}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('tracker:issues.modal.fullscreenAriaDescription')} title={t('tracker:issues.modal.fullscreenAriaDescription')} onClick={() => setFullscreenField('decision')}>
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </div>
                {activeField === 'decision' && canEdit ? (
                  <>
                    <textarea className="textarea" value={decision.decision} autoFocus rows={3} placeholder={t("decisions.newModal.decisionLabel")} onChange={(e) => update({ decision: e.target.value })} onBlur={() => setActiveField(null)} aria-label={t("decisions.modal.decisionLabel")} maxLength={20000} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: decision.decision.length > 18000 ? 'var(--status-danger)' : decision.decision.length > 15000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {decision.decision.length.toLocaleString()} / {(20000).toLocaleString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div onClick={() => canEdit && setActiveField('decision')} role={canEdit ? 'button' : undefined} tabIndex={canEdit ? 0 : undefined} onKeyDown={(e) => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActiveField('decision'); } }} style={{ cursor: canEdit ? 'text' : undefined, fontSize: 13, lineHeight: 1.6, color: decision.decision.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', minHeight: 40, overflowWrap: 'anywhere' }}>
                    {decision.decision.trim() ? <MarkdownBlocks text={decision.decision} /> : t("decisions.modal.noDecision")}
                  </div>
                )}
              </div>

              {/* Consequences */}
              <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={12} aria-hidden="true" /> {t("decisions.modal.consequencesLabel")}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('tracker:issues.modal.fullscreenAriaDescription')} title={t('tracker:issues.modal.fullscreenAriaDescription')} onClick={() => setFullscreenField('consequences')}>
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </div>
                {activeField === 'consequences' && canEdit ? (
                  <>
                    <textarea className="textarea" value={decision.consequences} autoFocus rows={2} placeholder={t("decisions.newModal.consequencesPlaceholder")} onChange={(e) => update({ consequences: e.target.value })} onBlur={() => setActiveField(null)} aria-label={t("decisions.modal.consequencesLabel")} maxLength={10000} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: decision.consequences.length > 9000 ? 'var(--status-danger)' : decision.consequences.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {decision.consequences.length.toLocaleString()} / {(10000).toLocaleString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div onClick={() => canEdit && setActiveField('consequences')} role={canEdit ? 'button' : undefined} tabIndex={canEdit ? 0 : undefined} onKeyDown={(e) => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActiveField('consequences'); } }} style={{ cursor: canEdit ? 'text' : undefined, fontSize: 13, lineHeight: 1.6, color: decision.consequences.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', minHeight: 40, overflowWrap: 'anywhere' }}>
                    {decision.consequences.trim() ? <MarkdownBlocks text={decision.consequences} /> : t("decisions.modal.noConsequences")}
                  </div>
                )}
              </div>
            </div>

            <h4 className="detail-subtitle">{t("decisions.modal.activity")}</h4>
            <ActivityList projectId={projectId} entity="decisions" entityId={decision.id} />
            <p className="field-helper">{t("decisions.modal.updated", { time: formatRelative(decision.updatedAt) })}</p>
          </>
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
                    fullscreenField === 'context' ? decision.context :
                      fullscreenField === 'options' ? decision.options.join("\n") :
                        fullscreenField === 'decision' ? decision.decision :
                          fullscreenField === 'consequences' ? decision.consequences : ""
                  }
                  autoFocus={canEdit}
                  readOnly={!canEdit}
                  onChange={(e) => {
                    if (!canEdit) return;
                    if (fullscreenField === 'context') update({ context: e.target.value });
                    else if (fullscreenField === 'options') update({ options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean).slice(0, 20) });
                    else if (fullscreenField === 'decision') update({ decision: e.target.value });
                    else if (fullscreenField === 'consequences') update({ consequences: e.target.value });
                  }}
                  maxLength={20000}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {(() => {
                    const text = fullscreenField === 'context' ? decision.context : fullscreenField === 'options' ? decision.options.map((o) => `- ${o}`).join("\n") : fullscreenField === 'decision' ? decision.decision : decision.consequences;
                    return text.trim() ? <MarkdownBlocks text={text} /> : <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>;
                  })()}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{canEdit ? t('tracker:issues.modal.fullscreenHelper') : t('tracker:issues.modal.fullscreenHelperReadOnly')}</p>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {(fullscreenField === 'context' ? decision.context.length : fullscreenField === 'options' ? decision.options.join("\n").length : fullscreenField === 'decision' ? decision.decision.length : decision.consequences.length).toLocaleString()} / {(20000).toLocaleString()}
              </span>
            </div>
          </div>
        </Modal>
      )}
      <ConfirmDeleteDialog
        open={confirmOpen}
        title={t("decisions.modal.deleteConfirmTitle")}
        description={t("decisions.modal.deleteConfirmBody")}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </>
  );
}
