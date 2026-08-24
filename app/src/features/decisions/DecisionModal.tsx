import { useEffect, useRef, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { DECISION_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { State, Decision, DecisionStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Badge } from '../../components/Badge';
import { ActivityList } from '../../components/ActivityList';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty, DetailList, DetailRow } from '../../components/DetailList';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface DecisionModalProps {
  decisionId: string | null;
  onClose: () => void;
}

export function DecisionModal({ decisionId, onClose }: DecisionModalProps) {
  const { t } = useTranslation('project');
  const { state, dispatch, canEdit, projectId } = useProject();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editSnapshot = useRef<State | null>(null);

  useEffect(() => {
    setEditing(false);
    setConfirmOpen(false);
  }, [decisionId]);

  const decision = decisionId
    ? state?.decisions.find((d) => d.id === decisionId)
    : undefined;
  usePresenceStatus('Editing decision', decision != null);
  if (!state || !decision) return null;

  const update = (patch: UpdatePatch<Decision>) => {
    dispatch({ type: 'decision/update', id: decision.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'decision/remove', id: decision.id });
    onClose();
  };

  const startEditing = () => {
    editSnapshot.current = structuredClone(state);
    setEditing(true);
  };

  const cancelEditing = () => {
    if (editSnapshot.current) {
      dispatch({ type: 'replace', state: editSnapshot.current });
      editSnapshot.current = null;
    }
    setEditing(false);
  };

  const finishEditing = () => {
    editSnapshot.current = null;
    setEditing(false);
    onClose();
  };

  return (
    <>
    <Modal
      open={decisionId !== null}
      title={editing ? t('decisions.modal.editTitle') : t('decisions.modal.viewTitle')}
      onClose={onClose}
      width="md"
      footer={
        <>
          {canEdit && !editing && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t('decisions.modal.delete')}
            </Button>
          )}
          <span className="flex-1" />
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEditing}>
                {t('decisions.modal.cancel')}
              </Button>
              <Button variant="primary" onClick={finishEditing}>
                {t('decisions.modal.done')}
              </Button>
            </>
          ) : (
            canEdit && (
              <Button variant="primary" onClick={startEditing}>
                {t('decisions.modal.edit')}
              </Button>
            )
          )}
        </>
      }
    >
      <div className="form-stack">
        {editing ? (
          <>
            <Input
              label={t('decisions.modal.titleLabel')}
              value={decision.title}
              onChange={(e) => update({ title: e.target.value })}
            />
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="decision-status">
                  {t('decisions.modal.statusLabel')}
                </label>
                <select
                  id="decision-status"
                  className="select"
                  value={decision.status}
                  onChange={(e) => update({ status: e.target.value as DecisionStatus })}
                >
                  <option value="proposed">{t('decisions.status.proposed')}</option>
                  <option value="accepted">{t('decisions.status.accepted')}</option>
                  <option value="rejected">{t('decisions.status.rejected')}</option>
                  <option value="superseded">{t('decisions.status.superseded')}</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="decision-date">
                  {t('decisions.modal.dateLabel')}
                </label>
                <input
                  id="decision-date"
                  className="input"
                  type="date"
                  value={decision.date.slice(0, 10)}
                  onChange={(e) => update({ date: e.target.value })}
                />
              </div>
            </div>
            <Textarea
              label={t('decisions.modal.contextLabel')}
              rows={3}
              value={decision.context}
              onChange={(e) => update({ context: e.target.value })}
            />
            <Textarea
              label={t('decisions.modal.optionsLabel')}
              rows={3}
              helper={t('decisions.modal.optionsHelper')}
              value={decision.options.join('\n')}
              onChange={(e) =>
                update({
                  options: e.target.value
                    .split('\n')
                    .map((o) => o.trim())
                    .filter(Boolean)
                    .slice(0, 20),
                })
              }
            />
            <Textarea
              label={t('decisions.modal.decisionLabel')}
              rows={3}
              value={decision.decision}
              onChange={(e) => update({ decision: e.target.value })}
            />
            <Textarea
              label={t('decisions.modal.consequencesLabel')}
              rows={2}
              value={decision.consequences}
              onChange={(e) => update({ consequences: e.target.value })}
            />
            <p className="field-helper">{t('decisions.modal.updated', { time: formatRelative(decision.updatedAt) })}</p>
          </>
        ) : (
          <>
            <h3 className="detail-title">{decision.title}</h3>
            <DetailList>
              <DetailRow label={t('decisions.modal.statusLabel')}>
                <Badge tone={DECISION_STATUS[decision.status].tone}>
                  {t(`decisions.status.${decision.status}`)}
                </Badge>
              </DetailRow>
              <DetailRow label={t('decisions.modal.dateLabel')}>
                <span className="font-mono"># {decision.date.slice(0, 10)}</span>
              </DetailRow>
              <DetailRow label={t('decisions.modal.contextLabel')}>
                {decision.context.trim() ? decision.context : <DetailEmpty>{t('decisions.modal.noContext')}</DetailEmpty>}
              </DetailRow>
              <DetailRow label={t('decisions.modal.optionsLabel')}>
                {decision.options.length > 0 ? (
                  <ol className="detail-options">
                    {decision.options.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ol>
                ) : (
                  <DetailEmpty>{t('decisions.modal.noOptions')}</DetailEmpty>
                )}
              </DetailRow>
              <DetailRow label={t('decisions.modal.decisionLabel')}>
                {decision.decision.trim() ? decision.decision : <DetailEmpty>{t('decisions.modal.noDecision')}</DetailEmpty>}
              </DetailRow>
              <DetailRow label={t('decisions.modal.consequencesLabel')}>
                {decision.consequences.trim() ? (
                  decision.consequences
                ) : (
                  <DetailEmpty>{t('decisions.modal.noConsequences')}</DetailEmpty>
                )}
              </DetailRow>
            </DetailList>
            <h4 className="detail-subtitle">{t('decisions.modal.activity')}</h4>
            <ActivityList projectId={projectId} entity="decisions" entityId={decision.id} />
            <p className="field-helper">{t('decisions.modal.updated', { time: formatRelative(decision.updatedAt) })}</p>
          </>
        )}
      </div>
    </Modal>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title={t('decisions.modal.deleteConfirmTitle')}
      description={t('decisions.modal.deleteConfirmBody')}
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    </>
  );
}