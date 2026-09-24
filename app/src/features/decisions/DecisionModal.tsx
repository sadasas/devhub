import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Trash, Scales, Clock, FileText, ListChecks, CheckCircle, Circle, CalendarBlank, Rocket, PencilSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatRelative } from '../../lib/utils';
import type { Decision, DecisionStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { ActivityList } from '../../components/ActivityList';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty } from '../../components/DetailList';
import { InlineError } from '../../components/InlineError';
import { PropRow } from '../../components/PropRow';
import { DetailShell } from '../../components/DetailShell';
import { DatePicker } from '../../components/DatePicker';
import { MarkdownField } from '../../components/MarkdownField';
import { SearchableSelect } from '../../components/SearchableSelect';
import { MarkdownBlocks } from '../../lib/markdown';
import { LIMITS } from '../../lib/limits';

const STATUS_OPTIONS: DecisionStatus[] = ['proposed', 'accepted', 'rejected', 'superseded'];

// autoFocus hanya desktop (hover) — di touch, keyboard virtual melonjak (pola Modal).

interface DecisionModalProps {
  decisionId: string | null;
  onClose: () => void;
}

export function DecisionModal({ decisionId, onClose }: DecisionModalProps) {
  const AUTO_FOCUS_INPUT = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;
  const { t } = useTranslation(['project', 'tracker']);
  const { state, dispatch, canEdit, projectId, saving, lastSavedAt } = useProject();
  const [hotProp, setHotProp] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const optionsRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setHotProp(null);
    setConfirmOpen(false);
  }, [decisionId]);

  // Judul autogrow tanpa batas — yang scroll .composer-scroll, bukan textarea.
  useLayoutEffect(() => {
    const ta = titleRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
    const opt = optionsRef.current;
    if (opt) {
      opt.style.height = 'auto';
      opt.style.height = `${opt.scrollHeight}px`;
    }
  });

  const decision = decisionId ? state?.decisions.find((d) => d.id === decisionId) : undefined;
  usePresenceStatus('Editing decision', decision != null);
  if (!state || !decision) return null;

  const update = (patch: UpdatePatch<Decision>) => {
    dispatch({ type: 'decision/update', id: decision.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'decision/remove', id: decision.id });
    onClose();
  };

  const milestone = decision.milestoneId
    ? state.milestones.find((m) => m.id === decision.milestoneId)
    : undefined;

  const titleEmpty = decision.title.trim() === '';

  return (
    <DetailShell
      title={t('decisions.modal.viewTitle')}
      onClose={onClose}
      footer={
        canEdit ? (
          <>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={14} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t('decisions.modal.delete')}
            </Button>
            {(saving || lastSavedAt) && !titleEmpty && (
              <span className="save-state" role="status">
                {saving ? (
                  t('tracker:board.taskModal.autosaveSaving')
                ) : (
                  <>
                    <CheckCircle size={13} weight="bold" aria-hidden="true" />
                    {t('tracker:board.taskModal.autosaveSaved')}
                  </>
                )}
              </span>
            )}
          </>
        ) : undefined
      }
      sidebarHead={t('tracker:board.taskModal.propertiesLabel')}
      sidebar={
        <>
          <PropRow
            propKey="status"
            label={t('decisions.modal.statusLabel')}
            icon={<Circle size={12} aria-hidden="true" />}
            hot={hotProp === 'status'}
            setHot={setHotProp}
            canEdit={canEdit}
            view={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 6, background: decision.status === 'accepted' ? 'var(--status-success-dim)' : decision.status === 'rejected' ? 'var(--status-danger-dim)' : decision.status === 'superseded' ? 'var(--bg-inset)' : 'var(--status-info-dim)', border: decision.status === 'superseded' ? '1px solid var(--border-hairline)' : 'none', fontSize: 12 }}>
                {t(`decisions.status.${decision.status}`)}
              </span>
            )}
            control={(
              <SearchableSelect defaultOpen searchable={false} id="decision-status" label="" ariaLabel={t('decisions.modal.statusLabel')} value={decision.status} allowEmpty={false} options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`decisions.status.${s}`) }))} onOpenChange={(o) => { if (!o) setHotProp(null); }} onChange={(v) => { if (v) { update({ status: v as DecisionStatus }); setHotProp(null); } }} />
            )}
          />
          <PropRow
            propKey="date"
            label={t('decisions.modal.dateLabel')}
            icon={<CalendarBlank size={12} aria-hidden="true" />}
            hot={hotProp === 'date'}
            setHot={setHotProp}
            canEdit={canEdit}
            view={(
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {decision.date ? formatDate(decision.date) : '—'}
              </span>
            )}
            control={(
              <DatePicker
                id="decision-date"
                mode="single"
                start={decision.date ? decision.date.slice(0, 10) : null}
                end={null}
                onApply={(s) => { update({ date: s ?? decision.date }); setHotProp(null); }}
                onClose={() => setHotProp(null)}
              />
            )}
          />
          <PropRow
            propKey="milestone"
            label={t('decisions.modal.milestoneLabel', { defaultValue: 'Milestone' })}
            icon={<Rocket size={12} aria-hidden="true" />}
            hot={hotProp === 'milestone'}
            setHot={setHotProp}
            canEdit={canEdit}
            view={(
              <span style={{ fontSize: 12, color: milestone ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {milestone ? milestone.name : '—'}
              </span>
            )}
            control={(
              <SearchableSelect defaultOpen id="decision-milestone" label="" ariaLabel={t('decisions.modal.milestoneLabel', { defaultValue: 'Milestone' })} value={decision.milestoneId ?? null} options={state.milestones.map((m) => ({ value: m.id, label: m.name }))} onOpenChange={(o) => { if (!o) setHotProp(null); }} onChange={(v) => { update({ milestoneId: v }); setHotProp(null); }} triggerEmptyLabel={t('decisions.modal.milestoneLabel', { defaultValue: 'Milestone' })} />
            )}
          />
        </>
      }
      after={(
        <ConfirmDeleteDialog
          open={confirmOpen}
          title={t('decisions.modal.deleteConfirmTitle')}
          description={t('decisions.modal.deleteConfirmBody')}
          onClose={() => setConfirmOpen(false)}
          onConfirm={remove}
        />
      )}
    >
      {canEdit ? (
        <div className="editable-field editable-field-title" style={{ position: 'relative' }}>
          <textarea
            ref={titleRef}
            className="composer-title"
            rows={1}
            value={decision.title}
            autoFocus={AUTO_FOCUS_INPUT}
            maxLength={LIMITS.DECISION_TITLE}
            onChange={(e) => update({ title: e.target.value })}
            aria-label={t('decisions.modal.titleLabel')}
            aria-invalid={titleEmpty}
            placeholder={t('decisions.newModal.titlePlaceholder')}
            style={{ paddingRight: 20 }}
          />
          <PencilSimple size={12} aria-hidden="true" className="editable-pencil" />
        </div>
      ) : (
        <h3 className="detail-title">
          {decision.title || <DetailEmpty>{t('decisions.modal.noContext')}</DetailEmpty>}
        </h3>
      )}
      {titleEmpty && <InlineError>{t('tracker:issues.modal.titleRequired')}</InlineError>}
      <div className="detail-created" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
        <span style={{ width: 110, color: 'var(--text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Clock size={12} aria-hidden="true" /> {t('tracker:issues.modal.createdTimeLabel')}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>{formatDate(decision.createdAt)} {new Date(decision.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {canEdit ? (
        <div className="editable-field" style={{ position: 'relative' }}>
          <MarkdownField
            label={t('decisions.modal.contextLabel')}
            icon={FileText}
            value={decision.context}
            onChange={(v) => update({ context: v })}
            placeholder={t('decisions.newModal.contextPlaceholder')}
            maxLength={LIMITS.DECISION_CONTEXT}
            rows={3}
            variant="bare"
            previewToggle
          />
        </div>
      ) : (
        <div className="md-bare">
          <div className="md-bare-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FileText size={12} aria-hidden="true" /> {t('decisions.modal.contextLabel')}
            </span>
          </div>
          <div className="md-preview">
            {decision.context.trim() ? <MarkdownBlocks text={decision.context} /> : t('decisions.modal.noContext')}
          </div>
        </div>
      )}

      {canEdit ? (
        <div className="editable-field" style={{ position: 'relative' }}>
          <div className="md-bare">
            <div className="md-bare-head">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ListChecks size={12} aria-hidden="true" /> {t('decisions.modal.optionsLabel')}
              </span>
              <span className="spacer" />
              <PencilSimple size={12} aria-hidden="true" className="editable-pencil" />
            </div>
            <textarea
              ref={optionsRef}
              className="textarea-bare"
              rows={3}
              value={decision.options.join('\n')}
              onChange={(e) => update({ options: e.target.value.split('\n').map((o) => o.trim()).filter(Boolean).slice(0, LIMITS.DECISION_OPTIONS) })}
              placeholder={t('decisions.newModal.optionsPlaceholder')}
              aria-label={t('decisions.modal.optionsLabel')}
              maxLength={LIMITS.DECISION_OPTION}
            />
          </div>
        </div>
      ) : (
        <div className="md-bare">
          <div className="md-bare-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ListChecks size={12} aria-hidden="true" /> {t('decisions.modal.optionsLabel')}
            </span>
          </div>
          <div className="md-preview">
            {decision.options.length > 0 ? (
              <MarkdownBlocks text={decision.options.map((o) => `- ${o}`).join('\n')} />
            ) : t('decisions.modal.noOptions')}
          </div>
        </div>
      )}

      {canEdit ? (
        <div className="editable-field" style={{ position: 'relative' }}>
          <MarkdownField
            label={t('decisions.modal.decisionLabel')}
            icon={Scales}
            value={decision.decision}
            onChange={(v) => update({ decision: v })}
            placeholder={t('decisions.newModal.decisionPlaceholder')}
            maxLength={LIMITS.DECISION_TEXT}
            rows={3}
            variant="bare"
            previewToggle
          />
        </div>
      ) : (
        <div className="md-bare">
          <div className="md-bare-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Scales size={12} aria-hidden="true" /> {t('decisions.modal.decisionLabel')}
            </span>
          </div>
          <div className="md-preview">
            {decision.decision.trim() ? <MarkdownBlocks text={decision.decision} /> : t('decisions.modal.noDecision')}
          </div>
        </div>
      )}

      {canEdit ? (
        <div className="editable-field" style={{ position: 'relative' }}>
          <MarkdownField
            label={t('decisions.modal.consequencesLabel')}
            icon={FileText}
            value={decision.consequences}
            onChange={(v) => update({ consequences: v })}
            placeholder={t('decisions.newModal.consequencesPlaceholder')}
            maxLength={LIMITS.DECISION_CONSEQUENCES}
            rows={2}
            variant="bare"
            previewToggle
          />
        </div>
      ) : (
        <div className="md-bare">
          <div className="md-bare-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FileText size={12} aria-hidden="true" /> {t('decisions.modal.consequencesLabel')}
            </span>
          </div>
          <div className="md-preview">
            {decision.consequences.trim() ? <MarkdownBlocks text={decision.consequences} /> : t('decisions.modal.noConsequences')}
          </div>
        </div>
      )}

      <h4 className="detail-subtitle">{t('decisions.modal.activity')}</h4>
      <ActivityList projectId={projectId} entity="decisions" entityId={decision.id} />
      <p className="field-helper">{t('decisions.modal.updated', { time: formatRelative(decision.updatedAt) })}</p>
    </DetailShell>
  );
}
